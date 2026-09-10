import { findDriver, isADeclaredType, isPlacedInSource, isTestPath, readLanguageFamily, readMemberNames, Scale } from "../../../../../code/index.mjs";
import { listLinesFromTo } from "../../lookups/FileLines.mjs";

const MAX_WHOLE_TYPE_LINES = 12;

const isAPlacedType = abstraction => isADeclaredType(abstraction) && isPlacedInSource(abstraction);

const compareByPathAndLine = (left, right) => (left.place.file < right.place.file ? -1 : left.place.file > right.place.file ? 1 : 0) || left.place.startLine - right.place.startLine;

const groupPlacedTypesByFile = codeGraph => {
  const typesByFileMap = new Map();
  for (const type of codeGraph.listAbstractionsAt(Scale.CLASS).filter(isAPlacedType).sort(compareByPathAndLine)) {
    if (!typesByFileMap.has(type.place.file)) typesByFileMap.set(type.place.file, []);
    typesByFileMap.get(type.place.file).push(type);
  }
  return typesByFileMap;
};

export class TypeAbstractions {
  constructor(codeGraph, fileLines) {
    this.fileLines = fileLines;
    this.typesByFileMap = groupPlacedTypesByFile(codeGraph);
  }

  findTypeStartingOnTheLine(filePath, line) {
    return (this.typesByFileMap.get(filePath) || []).find(type => type.place.startLine === line) || null;
  }

  readType({ name, path: filePath, from, to }) {
    const found = this.findTypeStartingOnTheLine(filePath, from);
    const members = found ? found.members : [];
    const shown = to - from < MAX_WHOLE_TYPE_LINES ? listLinesFromTo(from, to) : [from, ...members.map(member => member.line), to];
    return {
      name,
      path: filePath,
      from,
      to,
      members: readMemberNames(members),
      lines: this.fileLines.readUntrimmedLinesInOrder(filePath, shown),
    };
  }

  listTypesDeclaredInTheFile(filePath) {
    if (!findDriver(filePath)) return [];
    return (this.typesByFileMap.get(filePath) || []).map(type => ({ name: type.name, path: filePath, from: type.place.startLine, to: type.place.endLine }));
  }

  findProductionTypeNamed(name, family) {
    const paths = [...this.typesByFileMap.keys()].filter(filePath => readLanguageFamily(filePath) === family && !isTestPath(filePath)).sort();
    for (const filePath of paths) {
      const found = this.listTypesDeclaredInTheFile(filePath).find(declaredType => declaredType.name === name);
      if (found) return this.readType(found);
    }
    return null;
  }
}
