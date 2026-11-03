import { findDriver, formatPlacedSliceLine, isTestPath, listHeadLineNumbers, readDeclarations, readLanguageFamily, readVisibilityOfDeclaration, Scale, SourceText, VISIBILITIES } from "../../../../code/index.mjs";
import { measureSharedFolderDepth, readFileStem } from "../../../../files/paths.mjs";
import { MAX_LINES_OF_A_TYPE_HEAD, MAX_TYPES_WITH_A_HEAD } from "./TypeHeads.mjs";

const keepOnceEach = numbers => [...new Set(numbers)].sort((left, right) => left - right);

const groupPathsByFileStem = filePaths => {
  const pathsByStemMap = new Map();
  for (const filePath of filePaths) {
    if (isTestPath(filePath)) continue;
    const stem = readFileStem(filePath);
    pathsByStemMap.set(stem, [...(pathsByStemMap.get(stem) || []), filePath]);
  }
  return pathsByStemMap;
};

const compareByNearness = usedFrom => (left, right) => measureSharedFolderDepth(right, usedFrom) - measureSharedFolderDepth(left, usedFrom) || (left < right ? -1 : 1);

const isAMemberOf = position => declaration => declaration.enclosingHeadOrder === position;

export class ExistingTypeHeads {
  constructor({ pathsOfExistingFiles, namesDeclaredByTheShape, readFileLines }) {
    this.pathsByStemMap = groupPathsByFileStem(pathsOfExistingFiles);
    this.namesDeclaredByTheShape = namesDeclaredByTheShape;
    this.readFileLines = readFileLines;
    this.declarationsByPathMap = new Map();
  }

  listHeads(typeNames, usedFrom) {
    return typeNames
      .filter(name => !this.namesDeclaredByTheShape.has(name))
      .map(name => this.findTheNearestDeclaration(name, usedFrom))
      .filter(Boolean)
      .slice(0, MAX_TYPES_WITH_A_HEAD)
      .map(found => this.listDeclaringLines(found));
  }

  findTheNearestDeclaration(typeName, usedFrom) {
    const family = readLanguageFamily(usedFrom);
    const filesOfTheName = (this.pathsByStemMap.get(typeName) || []).filter(filePath => readLanguageFamily(filePath) === family).sort(compareByNearness(usedFrom));
    for (const filePath of filesOfTheName) {
      const declarations = this.readDeclarationsOf(filePath);
      const position = declarations.findIndex(declaration => declaration.scale === Scale.CLASS.name && declaration.name === typeName);
      if (position >= 0) return { filePath, declarations, position };
    }
    return null;
  }

  readDeclarationsOf(filePath) {
    if (!this.declarationsByPathMap.has(filePath)) {
      const driver = findDriver(filePath);
      const lines = this.readFileLines(filePath);
      this.declarationsByPathMap.set(filePath, driver && lines.length ? readDeclarations(SourceText.createForFile(filePath, lines, driver)) : []);
    }
    return this.declarationsByPathMap.get(filePath);
  }

  listDeclaringLines({ filePath, declarations, position }) {
    const lines = this.readFileLines(filePath);
    const driver = findDriver(filePath);
    const type = declarations[position];
    const isAConstructor = member => member.name === type.name || driver.isAConstructor(member);
    const members = declarations.filter(isAMemberOf(position));
    const fieldLines = members.filter(member => member.scale === Scale.VARIABLE.name).map(member => member.line);
    const methodHeadLines = members
      .filter(member => member.scale === Scale.METHOD.name && !isAConstructor(member) && readVisibilityOfDeclaration(driver, member) !== VISIBILITIES.PRIVATE)
      .flatMap(member => listHeadLineNumbers(lines, member.line));
    return keepOnceEach([...listHeadLineNumbers(lines, type.line), ...fieldLines, ...methodHeadLines])
      .slice(0, MAX_LINES_OF_A_TYPE_HEAD)
      .map(line => formatPlacedSliceLine(filePath, line, String(lines[line - 1] ?? "").trim()));
  }
}
