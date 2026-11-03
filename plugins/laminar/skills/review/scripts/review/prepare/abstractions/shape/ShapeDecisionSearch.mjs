import { buildShortenedPlace, collectStems, collectTypeNames, compareByPathAndLine, IMPORT_OR_NAMESPACE_LINE_PATTERN, isALanguageWordOrAnEverydayName, isOwnCodeAt, isTestPath, readLanguageFamily, SHAPE_KINDS } from "../../../../code/index.mjs";
import { collectKeys, limitPlaces, MAX_SEARCHED_PLACES, MAX_SHARED_READ_PLACES, MIN_SHARED_READS, MIN_SHARED_STEMS, MIN_STEMS_SHARED_WITH_THE_NAME, OCCURRENCE_KINDS } from "../walks/decisions/SameDecisionWalk.mjs";

const CALLED_NAME_PATTERN = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g;

const isAnIdentifierKey = found => found.kind === OCCURRENCE_KINDS.IDENTIFIER;

const readLinesOfTheSpan = (renderedLines, { from, to }) => renderedLines.slice(from - 1, to).map((text, offset) => ({ line: from + offset, text }));

const listFieldDeclarations = placement => placement.shapeClass.fields.map((field, at) => ({ name: field.name, line: placement.lines.from + 1 + at, field }));

const listDeclarationsOf = placement => [
  { name: placement.shapeClass.name, line: placement.lines.from, isAType: true },
  ...listFieldDeclarations(placement),
  ...placement.methods.map(({ method, lines }) => ({ name: method.name, line: lines.from })),
];

const measureStemRank = (declaredName, nameStems, everyStem) => {
  const declaredStems = collectStems(declaredName);
  const shared = declaredStems.filter(stem => everyStem.has(stem)).length;
  return { sharedWithTheName: declaredStems.filter(stem => nameStems.has(stem)).length, shared, notShared: declaredStems.length - shared };
};

const compareByStemRank = (left, right) => right.rank.sharedWithTheName - left.rank.sharedWithTheName
  || right.rank.shared - left.rank.shared
  || left.rank.notShared - right.rank.notShared
  || compareByPathAndLine(left.place, right.place);

const collectCalledNames = lines => {
  const found = new Set();
  for (const { text } of lines) for (const called of String(text).matchAll(CALLED_NAME_PATTERN)) found.add(called[1]);
  return found;
};

const collectOwnTypeNames = typeText => collectTypeNames([typeText]).filter(name => !isALanguageWordOrAnEverydayName(name));

const namesACall = (text, name) => new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}\\s*\\(`).test(text);

const KINDS_WHOSE_TEXT_THE_SHAPE_GIVES = new Set([SHAPE_KINDS.CREATED, SHAPE_KINDS.MOVED, SHAPE_KINDS.MODIFIED]);

const isSearchable = placement => KINDS_WHOSE_TEXT_THE_SHAPE_GIVES.has(placement.kind) && !isTestPath(placement.path);

export class ShapeDecisionSearch {
  constructor(placements, readRenderedLinesOf) {
    this.placements = placements.filter(isSearchable);
    this.readRenderedLinesOf = readRenderedLinesOf;
  }

  findSameDecisionPlaces(placement, methodPlacement) {
    const searched = { placement, methodPlacement, ownLines: [[methodPlacement.lines.from, methodPlacement.lines.to]], lines: readLinesOfTheSpan(this.readRenderedLinesOf(placement.path), methodPlacement.lines) };
    return limitPlaces(MAX_SEARCHED_PLACES, [...this.findSameNameStems(searched), ...this.findSameLiterals(searched), ...this.findSharedReads(searched)]);
  }

  listPlacementsOfTheFamily(ownPath) {
    const family = readLanguageFamily(ownPath);
    return this.placements.filter(placement => readLanguageFamily(placement.path) === family);
  }

  buildPlace(filePath, line) {
    return buildShortenedPlace(filePath, line, this.readRenderedLinesOf(filePath)[line - 1] ?? "");
  }

  findSameNameStems({ placement, methodPlacement, ownLines, lines }) {
    const ownName = methodPlacement.method.name;
    const nameStems = new Set(collectStems(ownName));
    const usedTypeNames = new Set(collectTypeNames(lines.map(({ text }) => text)));
    const everyStem = new Set([...nameStems, ...[...usedTypeNames].flatMap(collectStems)]);
    if (everyStem.size < MIN_SHARED_STEMS) return [];
    const isLeftOut = (declared, declaringPlacement) => declared.name === ownName
      || (declared.isAType && usedTypeNames.has(declared.name))
      || (declared.field && declaringPlacement.path === placement.path)
      || isOwnCodeAt({ path: declaringPlacement.path, line: declared.line }, placement.path, ownLines);
    const places = this.listPlacementsOfTheFamily(placement.path)
      .flatMap(declaringPlacement => listDeclarationsOf(declaringPlacement)
        .filter(declared => !isLeftOut(declared, declaringPlacement))
        .map(declared => ({ place: this.buildPlace(declaringPlacement.path, declared.line), rank: measureStemRank(declared.name, nameStems, everyStem) })))
      .filter(({ rank }) => rank.shared >= MIN_SHARED_STEMS && rank.sharedWithTheName >= MIN_STEMS_SHARED_WITH_THE_NAME)
      .sort(compareByStemRank)
      .map(({ place }) => place);
    return places.length ? [{ key: ownName, kind: OCCURRENCE_KINDS.NAME_STEMS, places }] : [];
  }

  findSameLiterals({ placement, ownLines, lines }) {
    const literals = collectKeys(lines.map(({ text }) => text)).filter(found => !isAnIdentifierKey(found));
    const otherLines = this.listPlacementsOfTheFamily(placement.path)
      .flatMap(otherPlacement => readLinesOfTheSpan(this.readRenderedLinesOf(otherPlacement.path), otherPlacement.lines).map(numbered => ({ path: otherPlacement.path, ...numbered })))
      .filter(numbered => !IMPORT_OR_NAMESPACE_LINE_PATTERN.test(numbered.text) && !isOwnCodeAt(numbered, placement.path, ownLines));
    return literals
      .map(({ key, kind }) => ({ key, kind, places: otherLines.filter(numbered => collectKeys([numbered.text]).some(found => found.key === key)).map(numbered => this.buildPlace(numbered.path, numbered.line)) }))
      .filter(occurrence => occurrence.places.length);
  }

  collectReads(placement, methodPlacement) {
    const ownMethodNames = new Set(placement.shapeClass.methods.map(method => method.name));
    const called = [...collectCalledNames(readLinesOfTheSpan(this.readRenderedLinesOf(placement.path), methodPlacement.lines))]
      .filter(name => !ownMethodNames.has(name) && !isALanguageWordOrAnEverydayName(name));
    const usedFieldTypes = placement.shapeClass.fields
      .filter(field => methodPlacement.method.uses.includes(field.name))
      .flatMap(field => collectOwnTypeNames(field.type));
    return new Set([...called, ...usedFieldTypes]);
  }

  findSharedReads({ placement, methodPlacement }) {
    const ownReads = this.collectReads(placement, methodPlacement);
    if (ownReads.size < MIN_SHARED_READS) return [];
    const placesBySharedKeyMap = new Map();
    for (const otherPlacement of this.listPlacementsOfTheFamily(placement.path)) {
      for (const otherMethodPlacement of otherPlacement.methods) {
        if (otherMethodPlacement === methodPlacement) continue;
        const shared = [...this.collectReads(otherPlacement, otherMethodPlacement)].filter(read => ownReads.has(read)).sort();
        if (shared.length < MIN_SHARED_READS) continue;
        const key = shared.join(", ");
        placesBySharedKeyMap.set(key, [...(placesBySharedKeyMap.get(key) || []), ...this.listLinesReading(otherPlacement, otherMethodPlacement, shared)]);
      }
    }
    return limitPlaces(MAX_SHARED_READ_PLACES, [...placesBySharedKeyMap].map(([key, places]) => ({ key, kind: OCCURRENCE_KINDS.SHARED_READS, places: places.sort(compareByPathAndLine) })));
  }

  listLinesReading(placement, methodPlacement, shared) {
    const callLines = readLinesOfTheSpan(this.readRenderedLinesOf(placement.path), methodPlacement.lines)
      .filter(({ text }) => shared.some(read => namesACall(text, read)))
      .map(({ line }) => line);
    const fieldLines = listFieldDeclarations(placement)
      .filter(({ name, field }) => methodPlacement.method.uses.includes(name) && collectOwnTypeNames(field.type).some(typeName => shared.includes(typeName)))
      .map(({ line }) => line);
    return [...fieldLines, ...callLines].map(line => this.buildPlace(placement.path, line));
  }
}
