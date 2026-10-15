import { IMPORT_OR_NAMESPACE_LINE_PATTERN, findDriver, buildShortenedPlace, compareByPathAndLine, CodeWindowIndex, readDeclaredAbstractions, escapeForAPattern, createFingerprint, holdsCodeAt, isADecisionLine, isALanguageWordOrAnEverydayName, isOwnCodeAt, isTestPath, joinStatementTexts, LANGUAGE_WORDS, readStatementAt, RELATION_KINDS, readLanguageFamily, formatPlaceKey, collectStems, STRING_LITERAL_PATTERN, collectTypeNames, collectWindows, Scale } from "../../../../../code/index.mjs";
import { findDecisionPlacesNamingTheKeyOutsideTheOwnCode } from "./KeyPlaces.mjs";

export const OCCURRENCE_KINDS = Object.freeze({ LITERAL: "LITERAL", IDENTIFIER: "IDENTIFIER", WINDOW: "WINDOW", NAME_STEMS: "NAME_STEMS", READ_IDENTIFIER: "READ_IDENTIFIER", SHARED_READS: "SHARED_READS", DERIVED_VALUE: "DERIVED_VALUE", TWIN_MEMBERS: "TWIN_MEMBERS", MATCHING_KEY: "MATCHING_KEY" });

const MAX_KEYS_PER_ABSTRACTION = 10;
const MAX_USES_PER_KEY = 5;
const USE_IS_COMMON_ABOVE = 20;
export const MIN_SHARED_STEMS = 2;
export const MIN_STEMS_SHARED_WITH_THE_NAME = 1;
export const MAX_SEARCHED_PLACES = 200;
export const MAX_LINES_PER_READ_IDENTIFIER = 12;
export const MAX_READ_IDENTIFIER_LINES = 36;
export const MIN_SHARED_READS = 2;
export const MAX_SHARED_READ_PLACES = 12;
const MAX_PLACES_SEARCHED_PER_READ = 200;
export const MIN_STEMS_SHARED_WITH_THE_WRITTEN_NAME = 2;
export const MAX_DERIVED_VALUE_PLACES = 6;
const WRITTEN_BY_A_CALL_PATTERN = /^\s*\.?([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)\s*[;,]?\s*$/;
const WRITTEN_BY_AN_ASSIGNMENT_PATTERN = /([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=(?!=)([\s\S]*)$/;
const ONLY_A_READ_PATTERN = /^[\w$.]+(?:\s*\(\s*\))?$/;

const NUMBER_LITERAL_PATTERN = /(?<![\w.$])-?\d+(?:\.\d+)?(?![\w.])/g;
const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]{3,}/g;
const PLAIN_NUMBERS = new Set(["0", "1", "-1"]);
const READ_WORD_PATTERN = /[A-Za-z_$][\w$]{3,}(?![\w$])/g;
const OPENS_A_CALL_PATTERN = /^\s*\(/;
const OPENS_A_CALL_WITH_NO_ARGUMENT_PATTERN = /^\s*\(\s*\)/;
const IS_ASSIGNED_PATTERN = /^\s*=(?!=)/;
const TITLE_CASE_WORD_PATTERN = /^[A-Z][a-z0-9]/;

const READ_KINDS = new Set([RELATION_KINDS.CALLS, RELATION_KINDS.READS_FIELD]);

const selectPlacesInProductionCode = places => places.filter(place => !isTestPath(place.path) && holdsCodeAt(place.path));

const markStopped = stopped => (stopped ? { stopped: true } : {});

const stemsByNameMap = new Map();

const readCachedStems = name => {
  if (!stemsByNameMap.has(name)) stemsByNameMap.set(name, collectStems(name));
  return stemsByNameMap.get(name);
};

const measureStemRank = (declaredName, nameStems, everyStem) => {
  const declaredStems = readCachedStems(declaredName);
  const shared = declaredStems.filter(stem => everyStem.has(stem)).length;
  return {
    sharedWithTheName: declaredStems.filter(stem => nameStems.has(stem)).length,
    shared,
    notShared: declaredStems.length - shared,
  };
};

const readTypeKey = (filePath, typeName) => `${filePath}\u0000${typeName}`;

const compareByStemRank = (left, right) => right.rank.sharedWithTheName - left.rank.sharedWithTheName
  || right.rank.shared - left.rank.shared
  || left.rank.notShared - right.rank.notShared
  || compareByPathAndLine(left.place, right.place);

export const mapToUses = occurrences => occurrences
  .filter(occurrence => occurrence.places.length <= USE_IS_COMMON_ABOVE)
  .map(({ key, kind, places }) => ({ key, kind, places: places.slice(0, MAX_USES_PER_KEY) }))
  .slice(0, MAX_KEYS_PER_ABSTRACTION);

export const isAReadIdentifierOccurrence = occurrence => occurrence.kind === OCCURRENCE_KINDS.READ_IDENTIFIER;

export const buildMemberReadPattern = identifier => new RegExp(`\\.${escapeForAPattern(identifier)}(?![\\w$])(?!\\s*\\()`);

export const buildReadPattern = identifier => new RegExp(`(?:(?<!\\.\\.)\\.|(?<![\\w$.]))${escapeForAPattern(identifier)}(?![\\w$])(?:(?!\\s*\\()|(?=\\s*\\(\\s*\\)))`, "g");

const TEXT_STANDING_IN = " _ ";

const QUALIFIED_TYPE_NAME_PATTERN = /(?<![\w$.])(?:[a-z_$][\w$]*\.){2,}[A-Z][\w$]*/g;

const readCodeOf = text => String(text).replace(STRING_LITERAL_PATTERN, TEXT_STANDING_IN).replace(QUALIFIED_TYPE_NAME_PATTERN, TEXT_STANDING_IN);

const countReads = (text, identifier) => (readCodeOf(text).match(buildReadPattern(identifier)) || []).length;

const isOnlyAReceiverIn = (text, identifier) => {
  const code = readCodeOf(text);
  const uses = [...code.matchAll(new RegExp(`(?<![\\w$])${escapeForAPattern(identifier)}(?![\\w$])`, "g"))];
  return uses.length > 0 && uses.every(use => /^\s*\.(?!\.)/.test(code.slice(use.index + identifier.length)));
};

const NO_FIELD = () => false;

const READ_FORMS = Object.freeze({ MEMBER: "MEMBER", MEMBER_CALL: "MEMBER_CALL", FIELD: "FIELD" });

const readFormAt = (code, word, at, isAnOwnField) => {
  const after = code.slice(at + word.length);
  if (IS_ASSIGNED_PATTERN.test(after)) return null;
  const afterADot = code[at - 1] === ".";
  if (afterADot && !OPENS_A_CALL_PATTERN.test(after)) return READ_FORMS.MEMBER;
  if (afterADot && OPENS_A_CALL_WITH_NO_ARGUMENT_PATTERN.test(after)) return READ_FORMS.MEMBER_CALL;
  if (!afterADot && !OPENS_A_CALL_PATTERN.test(after) && isAnOwnField(word)) return READ_FORMS.FIELD;
  return null;
};

const isATypeWordAt = (word, code, at) => TITLE_CASE_WORD_PATTERN.test(word) && code[at - 1] !== ".";

const collectReadsInLines = (lines, ownName, isAnOwnField) => {
  const crossesFamiliesByIdentifierMap = new Map();
  for (const line of lines) {
    const code = readCodeOf(line);
    for (const found of code.matchAll(READ_WORD_PATTERN)) {
      const word = found[0];
      const form = readFormAt(code, word, found.index, isAnOwnField);
      if (!form || word === ownName || isALanguageWordOrAnEverydayName(word) || isATypeWordAt(word, code, found.index)) continue;
      crossesFamiliesByIdentifierMap.set(word, crossesFamiliesByIdentifierMap.get(word) || form !== READ_FORMS.MEMBER_CALL);
    }
  }
  return [...crossesFamiliesByIdentifierMap].map(([identifier, crossesFamilies]) => ({ identifier, crossesFamilies }));
};

export const listDecisionStatements = lines => joinStatementTexts(lines).filter(isADecisionLine);

export const collectReadsInDecisions = (lines, ownName, isAnOwnField = NO_FIELD) => collectReadsInLines(listDecisionStatements(lines), ownName, isAnOwnField);

export const collectIdentifiersReadInDecisions = (lines, ownName, isAnOwnField = NO_FIELD) => collectReadsInDecisions(lines, ownName, isAnOwnField).map(read => read.identifier);

const readWrittenValue = text => {
  const code = readCodeOf(text).trim().replace(/^return\s+/, "");
  const byACall = WRITTEN_BY_A_CALL_PATTERN.exec(code);
  if (byACall && code.startsWith(".")) return { target: byACall[1], value: byACall[2].trim() };
  const byAnAssignment = WRITTEN_BY_AN_ASSIGNMENT_PATTERN.exec(code);
  return byAnAssignment ? { target: byAnAssignment[1], value: byAnAssignment[2].replace(/[;,]\s*$/, "").trim() } : null;
};

const isWrappedIn = (value, identifier) => countReads(value, identifier) > 0 && !ONLY_A_READ_PATTERN.test(value);

const sharesStemsWithTheName = (target, name) => readCachedStems(target).filter(stem => readCachedStems(name).includes(stem)).length >= MIN_STEMS_SHARED_WITH_THE_WRITTEN_NAME;

const saysMoreThanTheValue = (target, identifier) => readCachedStems(target).some(stem => !readCachedStems(identifier).includes(stem));

export const derivesTheValue = (text, identifier, ownName) => {
  const written = readWrittenValue(text);
  return Boolean(written) && written.target !== identifier && isWrappedIn(written.value, identifier) && sharesStemsWithTheName(written.target, ownName) && saysMoreThanTheValue(written.target, identifier);
};

const readsEveryValueOnBothSides = (text, identifiers) => identifiers.every(identifier => countReads(text, identifier) >= 2);

const selectPlacesStillListable = (places, listed, limit) => {
  const kept = [];
  for (const place of places) {
    const key = formatPlaceKey(place);
    if (!listed.has(key) && listed.size === limit) continue;
    listed.add(key);
    kept.push(place);
  }
  return kept;
};

export function limitPlaces(limit, occurrences) {
  const listed = new Set();
  const kept = [];
  for (const occurrence of occurrences) {
    const places = selectPlacesStillListable(occurrence.places, listed, limit);
    if (places.length) kept.push({ ...occurrence, places, ...markStopped(occurrence.stopped || places.length < occurrence.places.length) });
  }
  return kept;
}

const isAnIdentifierKey = found => found.kind === OCCURRENCE_KINDS.IDENTIFIER;

export function collectKeys(addedLines) {
  const countByKeyMap = new Map();
  const count = (key, kind) => {
    const seen = countByKeyMap.get(key) || { key, kind, times: 0 };
    seen.times++;
    countByKeyMap.set(key, seen);
  };
  for (const line of addedLines) {
    if (IMPORT_OR_NAMESPACE_LINE_PATTERN.test(line)) continue;
    for (const found of line.matchAll(STRING_LITERAL_PATTERN)) count(found[1] || found[2], OCCURRENCE_KINDS.LITERAL);
    const code = line.replace(STRING_LITERAL_PATTERN, " ");
    for (const found of code.matchAll(NUMBER_LITERAL_PATTERN)) if (!PLAIN_NUMBERS.has(found[0])) count(found[0], OCCURRENCE_KINDS.LITERAL);
    for (const found of code.matchAll(IDENTIFIER_PATTERN)) if (!LANGUAGE_WORDS.has(found[0])) count(found[0], OCCURRENCE_KINDS.IDENTIFIER);
  }
  const ranked = [...countByKeyMap.values()].sort((left, right) => right.times - left.times || (left.key < right.key ? -1 : 1));
  return [
    ...ranked.filter(found => found.kind === OCCURRENCE_KINDS.LITERAL),
    ...ranked.filter(isAnIdentifierKey).slice(0, MAX_KEYS_PER_ABSTRACTION),
  ];
}

export const collectIdentifierKeys = addedLines => collectKeys(addedLines).filter(isAnIdentifierKey);

const dropACommonUse = places => (places.length > USE_IS_COMMON_ABOVE ? [] : places);

class ReadLineBudget {
  constructor() {
    this.room = MAX_READ_IDENTIFIER_LINES;
  }

  get isSpent() {
    return !this.room;
  }

  keepWithin(places) {
    const kept = places.slice(0, Math.min(MAX_LINES_PER_READ_IDENTIFIER, this.room));
    this.room -= kept.length;
    return kept;
  }
}

export class SameDecisionWalk {
  constructor(graph, references, repositoryText) {
    this.graph = graph;
    this.references = references;
    this.repositoryText = repositoryText;
    this.abstractionsByFamilyMap = new Map();
    this.typeKeysByFamilyMap = new Map();
  }

  findDecisionPlacesReading(read, ownPath, ownLines) {
    return this.findStatementsReading(read, ownPath, ownLines)
      .filter(({ statement }) => isADecisionLine(statement.text))
      .map(({ place }) => place);
  }

  findStatementsReading({ identifier, crossesFamilies }, ownPath, ownLines) {
    const family = readLanguageFamily(ownPath);
    const memberRead = buildMemberReadPattern(identifier);
    const readsTheValue = (place, statement) => (readLanguageFamily(place.path) === family
      ? countReads(statement.text, identifier) > 0
      : crossesFamilies && memberRead.test(readCodeOf(statement.text)));
    return selectPlacesInProductionCode(this.references.collectPlaces(this.findReadReferences(identifier, family)))
      .filter(place => !isOwnCodeAt(place, ownPath, ownLines))
      .map(place => ({ place, statement: this.readStatementOfThePlace(place) }))
      .filter(({ place, statement }) => readsTheValue(place, statement));
  }

  readStatementOfThePlace(place) {
    const fileLines = this.repositoryText.readFileLines(place.path);
    return fileLines ? readStatementAt(fileLines, place.line) : { from: place.line, to: place.line, text: place.text };
  }

  findReadReferences(identifier, family) {
    return this.graph.findWalkedReferencesNamed(identifier)
      .filter(reference => READ_KINDS.has(reference.kind) && (reference.receiver || (readLanguageFamily(reference.place.file) === family && this.isAFieldOfTheEnclosingType(reference))));
  }

  isAFieldOfTheEnclosingType(reference) {
    return this.listFieldsOfTheTypesHolding(reference.place.file, reference.place.startLine).has(reference.name);
  }

  listFieldsOfTheTypesHolding(filePath, line) {
    return new Set(this.listTypesMeetingTheOwnCode(filePath, [[line, line]]).flatMap(abstraction => (abstraction.members || []).map(member => member.name)));
  }

  collectOwnReads(searched) {
    return collectReadsInDecisions(searched.addedLines, searched.name, this.buildOwnFieldTest(searched));
  }

  listTypesMeetingTheOwnCode(ownPath, ownLines) {
    return this.graph.findAbstractionsIn(ownPath)
      .filter(abstraction => abstraction.scale === Scale.CLASS && ownLines.some(([from, to]) => abstraction.place.startLine <= to && from <= abstraction.place.endLine));
  }

  buildOwnFieldTest({ path: ownPath, ownLines, addedLines }) {
    const types = this.listTypesMeetingTheOwnCode(ownPath, ownLines);
    const fields = new Set(types.flatMap(type => (type.members || []).map(member => member.name)));
    if (fields.size || types.some(type => type.members)) return word => fields.has(word);
    const driver = findDriver(ownPath);
    const locals = new Set(driver ? driver.findLocalVariables(addedLines) : []);
    return word => !locals.has(word);
  }

  buildOwnValueTest(searched) {
    const isAnOwnField = this.buildOwnFieldTest(searched);
    const driver = findDriver(searched.path);
    const locals = new Set(driver ? driver.findLocalVariables(searched.addedLines) : []);
    return word => isAnOwnField(word) || !locals.has(word);
  }

  findDerivedValuePlaces(searched) {
    const { name, path: ownPath, ownLines } = searched;
    const occurrences = [];
    const listed = new Set();
    for (const read of collectReadsInDecisions(searched.addedLines, name, this.buildOwnValueTest(searched))) {
      const places = this.findStatementsReading(read, ownPath, ownLines)
        .filter(({ place, statement }) => readLanguageFamily(place.path) === readLanguageFamily(ownPath) && !isADecisionLine(statement.text) && derivesTheValue(statement.text, read.identifier, name))
        .map(({ place }) => place)
        .filter(place => !listed.has(formatPlaceKey(place)))
        .slice(0, MAX_DERIVED_VALUE_PLACES - listed.size);
      places.forEach(place => listed.add(formatPlaceKey(place)));
      if (places.length) occurrences.push({ key: read.identifier, kind: OCCURRENCE_KINDS.DERIVED_VALUE, places });
      if (listed.size >= MAX_DERIVED_VALUE_PLACES) break;
    }
    return occurrences;
  }

  findSharedReadPlaces(searched) {
    const { name, path: ownPath, ownLines, addedLines } = searched;
    const isAnOwnField = this.buildOwnFieldTest(searched);
    const occurrences = [];
    const listed = new Set();
    for (const statement of listDecisionStatements(addedLines)) {
      const reads = collectReadsInLines([statement], name, isAnOwnField).filter(read => !isOnlyAReceiverIn(statement, read.identifier));
      if (reads.length < MIN_SHARED_READS) continue;
      const statementsByKeyMap = new Map();
      for (const read of reads) {
        for (const found of this.findStatementsReading(read, ownPath, ownLines).slice(0, MAX_PLACES_SEARCHED_PER_READ)) {
          const key = formatPlaceKey({ path: found.place.path, line: found.statement.from });
          if (!statementsByKeyMap.has(key)) statementsByKeyMap.set(key, found);
        }
      }
      const identifiers = reads.map(read => read.identifier);
      const places = [...statementsByKeyMap.values()]
        .filter(({ statement }) => isADecisionLine(statement.text))
        .map(({ place, statement }) => ({ place, shared: identifiers.filter(identifier => countReads(statement.text, identifier) > 0), statement }))
        .filter(({ shared, statement }) => shared.length >= MIN_SHARED_READS && !readsEveryValueOnBothSides(statement.text, shared))
        .filter(({ place }) => !listed.has(formatPlaceKey(place)))
        .sort((left, right) => compareByPathAndLine(left.place, right.place))
        .slice(0, MAX_SHARED_READ_PLACES - listed.size);
      places.forEach(({ place }) => listed.add(formatPlaceKey(place)));
      const shared = identifiers.filter(identifier => places.some(found => found.shared.includes(identifier)));
      if (places.length) occurrences.push({ key: shared.join(", "), kind: OCCURRENCE_KINDS.SHARED_READS, places: places.map(({ place }) => place) });
      if (listed.size >= MAX_SHARED_READ_PLACES) break;
    }
    return occurrences;
  }

  readValuePlacesOf(searched) {
    const { path: ownPath, ownLines } = searched;
    const occurrences = [];
    const budget = new ReadLineBudget();
    for (const read of this.collectOwnReads(searched)) {
      if (budget.isSpent) break;
      const places = dropACommonUse(this.findDecisionPlacesReading(read, ownPath, ownLines));
      const kept = budget.keepWithin(places);
      if (kept.length) occurrences.push({ key: read.identifier, kind: OCCURRENCE_KINDS.READ_IDENTIFIER, places: kept, ...markStopped(kept.length < places.length) });
    }
    return occurrences;
  }

  findWindowPlacesOf(form, family) {
    const places = this.getOrBuildCodeWindowIndex().findWindowsWithFingerprint(createFingerprint(form))
      .filter(({ method }) => readLanguageFamily(method.place.file) === family)
      .map(({ method, line }) => this.references.buildPlace(method.place.file, line));
    return [...new Map(places.map(place => [formatPlaceKey(place), place])).values()].sort(compareByPathAndLine);
  }

  getOrBuildCodeWindowIndex() {
    if (!this.cachedCodeWindowIndex) this.cachedCodeWindowIndex = CodeWindowIndex.createFromMethodsIn(this.graph);
    return this.cachedCodeWindowIndex;
  }

  findRankableAbstractions(family) {
    if (!this.abstractionsByFamilyMap.has(family)) {
      this.abstractionsByFamilyMap.set(family, readDeclaredAbstractions(this.graph, filePath => this.repositoryText.readFileLines(filePath))
        .filter(abstraction => readLanguageFamily(abstraction.path) === family && !isTestPath(abstraction.path)));
    }
    return this.abstractionsByFamilyMap.get(family);
  }

  collectTypeKeys(family) {
    if (!this.typeKeysByFamilyMap.has(family)) {
      this.typeKeysByFamilyMap.set(family, new Set(this.findRankableAbstractions(family)
        .filter(abstraction => abstraction.scale === Scale.CLASS.name)
        .map(abstraction => readTypeKey(abstraction.path, abstraction.name))));
    }
    return this.typeKeysByFamilyMap.get(family);
  }

  isTypeOrItsConstructor(abstraction, family) {
    return abstraction.scale === Scale.CLASS.name || this.collectTypeKeys(family).has(readTypeKey(abstraction.path, abstraction.name));
  }

  findSameNameStems({ name, path: ownPath, ownLines, addedLines }) {
    const family = readLanguageFamily(ownPath);
    const nameStems = new Set(collectStems(name));
    const usedTypeNames = new Set(collectTypeNames(addedLines));
    const everyStem = new Set([...nameStems, ...[...usedTypeNames].flatMap(collectStems)]);
    if (everyStem.size < MIN_SHARED_STEMS) return [];
    const isAUsedType = abstraction => usedTypeNames.has(abstraction.name) && this.isTypeOrItsConstructor(abstraction, family);
    const isAValueOfTheOwnFile = abstraction => abstraction.scale === Scale.VARIABLE.name && abstraction.path === ownPath;
    const isAFieldWithNoValue = abstraction => abstraction.scale === Scale.VARIABLE.name && abstraction.holdsNoValue;
    const places = this.findRankableAbstractions(family)
      .filter(abstraction => abstraction.name !== name && !isAUsedType(abstraction) && !isAValueOfTheOwnFile(abstraction) && !isAFieldWithNoValue(abstraction) && !isOwnCodeAt(abstraction, ownPath, ownLines))
      .map(abstraction => ({ abstraction, rank: measureStemRank(abstraction.name, nameStems, everyStem) }))
      .filter(({ rank }) => rank.shared >= MIN_SHARED_STEMS && rank.sharedWithTheName >= MIN_STEMS_SHARED_WITH_THE_NAME)
      .map(({ abstraction, rank }) => ({ place: buildShortenedPlace(abstraction.path, abstraction.line, abstraction.text), rank }))
      .sort(compareByStemRank)
      .map(({ place }) => place);
    return places.length ? [{ key: name, kind: OCCURRENCE_KINDS.NAME_STEMS, places }] : [];
  }

  findSameDecisionPlaces({ name, path: ownPath, ownLines, addedLines }) {
    const searched = this.findSameNameStems({ name, path: ownPath, ownLines, addedLines });
    const family = readLanguageFamily(ownPath);
    for (const { key, kind } of collectKeys(addedLines).filter(found => !isAnIdentifierKey(found))) {
      const decisionPlaces = selectPlacesInProductionCode(findDecisionPlacesNamingTheKeyOutsideTheOwnCode(this.references, key, ownPath, ownLines));
      if (decisionPlaces.length) searched.push({ key, kind, places: decisionPlaces });
    }
    for (const { form, firstLine } of collectWindows(addedLines)) {
      const places = selectPlacesInProductionCode(this.findWindowPlacesOf(form, family))
        .filter(place => !isOwnCodeAt(place, ownPath, ownLines));
      if (places.length) searched.push({ key: firstLine, kind: OCCURRENCE_KINDS.WINDOW, places });
    }
    return limitPlaces(MAX_SEARCHED_PLACES, searched);
  }
}
