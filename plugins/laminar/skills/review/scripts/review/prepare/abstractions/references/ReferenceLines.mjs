import { isACallKind, namesAReceiver, REFERENCE_FORMS, RELATION_KINDS } from "../../../../code/index.mjs";

export const NAMING_KINDS = new Set([RELATION_KINDS.CALLS, RELATION_KINDS.READS_FIELD, RELATION_KINDS.WRITES_FIELD, RELATION_KINDS.USES_TYPE]);

const compareByNumber = (left, right) => left - right;

const isBare = reference => !reference.receiver;

const isQualified = reference => namesAReceiver(reference.receiver);

const keepOnceEach = names => [...new Set(names)];

export class ReferenceLines {
  constructor(graph) {
    this.graph = graph;
    this.namesByFileMap = new Map();
    this.referencesByLineByFileMap = new Map();
  }

  collectNamesInFile(filePath) {
    if (!this.namesByFileMap.has(filePath)) {
      this.namesByFileMap.set(filePath, new Set(this.graph.findWalkedReferencesIn(filePath).filter(reference => NAMING_KINDS.has(reference.kind)).map(reference => reference.name)));
    }
    return this.namesByFileMap.get(filePath);
  }

  groupReferencesByLineInFile(filePath) {
    if (!this.referencesByLineByFileMap.has(filePath)) {
      const referencesByLineMap = new Map();
      for (const reference of this.graph.findWalkedReferencesIn(filePath)) {
        if (!referencesByLineMap.has(reference.place.startLine)) referencesByLineMap.set(reference.place.startLine, []);
        referencesByLineMap.get(reference.place.startLine).push(reference);
      }
      this.referencesByLineByFileMap.set(filePath, referencesByLineMap);
    }
    return this.referencesByLineByFileMap.get(filePath);
  }

  findReferencesAtLine(filePath, line) {
    return this.groupReferencesByLineInFile(filePath).get(line) || [];
  }

  findNamingReferencesAtLine(filePath, line) {
    return this.findReferencesAtLine(filePath, line).filter(reference => NAMING_KINDS.has(reference.kind));
  }

  listBareNamesAtLine(filePath, line) {
    return keepOnceEach(this.findNamingReferencesAtLine(filePath, line).filter(isBare).map(reference => reference.name));
  }

  listQualifiedNamesAtLine(filePath, line) {
    return this.findNamingReferencesAtLine(filePath, line).filter(isQualified).map(reference => ({ name: reference.name, importedAs: reference.receiver }));
  }

  listCalledNamesAtLine(filePath, line) {
    return keepOnceEach(this.findNamingReferencesAtLine(filePath, line).filter(isACallKind).map(reference => reference.name));
  }

  listCallLinesInFile(filePath, name) {
    return keepOnceEach(this.graph.findWalkedReferencesIn(filePath).filter(reference => isACallKind(reference) && reference.name === name).map(reference => reference.place.startLine)).sort(compareByNumber);
  }

  collectNamesAtLines(filePath, lines) {
    return new Set(lines.flatMap(line => this.findReferencesAtLine(filePath, line).map(reference => reference.name)));
  }

  listLinesNaming(filePath, name) {
    return keepOnceEach(this.graph.findWalkedReferencesIn(filePath).filter(reference => NAMING_KINDS.has(reference.kind) && reference.name === name).map(reference => reference.place.startLine)).sort(compareByNumber);
  }

  listEveryNameAtLine(filePath, line) {
    return keepOnceEach(this.findReferencesAtLine(filePath, line).map(reference => reference.name));
  }

  isAQueryPlaceOf(place, name) {
    return this.findReferencesAtLine(place.path, place.line).some(reference => reference.form === REFERENCE_FORMS.QUERY && reference.name === name);
  }
}
