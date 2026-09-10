import { IMPORT_OR_NAMESPACE_LINE_PATTERN, buildShortenedPlace, compareByPathAndLine, CodeWindowIndex, readDeclaredAbstractions, escapeForAPattern, createFingerprint, holdsProseAt, isADecisionLine, isALanguageWordOrAnEverydayName, isOwnCodeAt, isTestPath, LANGUAGE_WORDS, readLanguageFamily, formatPlaceKey, collectStems, STRING_LITERAL_PATTERN, collectTypeNames, collectWindows, Scale } from "../../../../../code/index.mjs";
import { findDecisionPlacesNamingTheKeyOutsideTheOwnCode } from "./KeyPlaces.mjs";

export const OCCURRENCE_KINDS = Object.freeze({ LITERAL: "LITERAL", IDENTIFIER: "IDENTIFIER", WINDOW: "WINDOW", NAME_STEMS: "NAME_STEMS", READ_IDENTIFIER: "READ_IDENTIFIER", TWIN_MEMBERS: "TWIN_MEMBERS" });

const MAX_KEYS_PER_ABSTRACTION = 10;
const MAX_USES_PER_KEY = 5;
const USE_IS_COMMON_ABOVE = 20;
export const MIN_SHARED_STEMS = 2;
export const MIN_STEMS_SHARED_WITH_THE_NAME = 1;
export const MAX_SEARCHED_PLACES = 200;
export const MAX_LINES_PER_READ_IDENTIFIER = 12;
export const MAX_READ_IDENTIFIER_LINES = 36;

const NUMBER_LITERAL_PATTERN = /(?<![\w.$])-?\d+(?:\.\d+)?(?![\w.])/g;
const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]{3,}/g;
const PLAIN_NUMBERS = new Set(["0", "1", "-1"]);
const READ_VALUE_PATTERN = /[A-Za-z_$][\w$]{3,}(?![\w$])(?!\s*\()/g;
const TITLE_CASE_WORD_PATTERN = /^[A-Z][a-z0-9]/;

const selectPlacesInProductionCode = places => places.filter(place => !isTestPath(place.path) && !holdsProseAt(place.path));

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

const isATypeWordAt = (word, code, at) => TITLE_CASE_WORD_PATTERN.test(word) && code[at - 1] !== ".";

const collectIdentifiersReadInLines = (lines, ownName) => {
  const read = new Set();
  for (const line of lines) {
    const code = line.replace(STRING_LITERAL_PATTERN, " ");
    for (const found of code.matchAll(READ_VALUE_PATTERN)) {
      const word = found[0];
      if (word !== ownName && !isALanguageWordOrAnEverydayName(word) && !isATypeWordAt(word, code, found.index)) read.add(word);
    }
  }
  return [...read];
};

export const collectIdentifiersReadInDecisions = (lines, ownName) => collectIdentifiersReadInLines(lines.filter(isADecisionLine), ownName);

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

  findDecisionPlacesReading(identifier, ownPath, ownLines) {
    const memberRead = buildMemberReadPattern(identifier);
    const places = selectPlacesInProductionCode(this.references.findMemberReadPlaces(identifier))
      .filter(place => memberRead.test(place.text) && isADecisionLine(place.text) && !isOwnCodeAt(place, ownPath, ownLines));
    return places;
  }

  readValuePlacesOf({ name, path: ownPath, ownLines, addedLines }) {
    const occurrences = [];
    const budget = new ReadLineBudget();
    for (const identifier of collectIdentifiersReadInDecisions(addedLines, name)) {
      if (budget.isSpent) break;
      const places = dropACommonUse(this.findDecisionPlacesReading(identifier, ownPath, ownLines));
      const kept = budget.keepWithin(places);
      if (kept.length) occurrences.push({ key: identifier, kind: OCCURRENCE_KINDS.READ_IDENTIFIER, places: kept, ...markStopped(kept.length < places.length) });
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
