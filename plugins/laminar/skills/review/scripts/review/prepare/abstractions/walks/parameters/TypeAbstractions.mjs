import { findDriver, findTheTypeDeclarationsInScope, isADeclaredType, isPlacedInSource, isTestPath, readLanguageFamily, readMemberNames, RELATION_KINDS, Scale } from "../../../../../code/index.mjs";
import { readFolderPath } from "../../../../../files/paths.mjs";
import { listLinesFromTo } from "../../lookups/FileLines.mjs";

const MAX_WHOLE_TYPE_LINES = 12;

const isAPlacedType = abstraction => isADeclaredType(abstraction) && isPlacedInSource(abstraction);

const isNestedInAType = abstraction => Boolean(abstraction.parent) && isADeclaredType(abstraction.parent);

const compareByPathAndLine = (left, right) => (left.place.file < right.place.file ? -1 : left.place.file > right.place.file ? 1 : 0) || left.place.startLine - right.place.startLine;

const groupPlacedTypesBy = (codeGraph, readKey) => {
  const typesByKeyMap = new Map();
  for (const type of codeGraph.listAbstractionsAt(Scale.CLASS).filter(isAPlacedType).sort(compareByPathAndLine)) {
    const key = readKey(type);
    if (!typesByKeyMap.has(key)) typesByKeyMap.set(key, []);
    typesByKeyMap.get(key).push(type);
  }
  return typesByKeyMap;
};

const toTypeDeclaration = type => ({ type, path: type.place.file, folder: readFolderPath(type.place.file) });

const isVisibleFrom = (filePath, importedPaths) => typeDeclaration => !isNestedInAType(typeDeclaration.type) || typeDeclaration.path === filePath || importedPaths.has(typeDeclaration.path);

export class TypeAbstractions {
  constructor(codeGraph, fileLines) {
    this.codeGraph = codeGraph;
    this.fileLines = fileLines;
    this.typesByFileMap = groupPlacedTypesBy(codeGraph, type => type.place.file);
    this.typesByNameMap = groupPlacedTypesBy(codeGraph, type => type.name);
    this.importedPathsByFileMap = new Map();
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
    return (this.typesByFileMap.get(filePath) || []).map(type => this.toDeclaredType(type));
  }

  toDeclaredType(type) {
    return { name: type.name, path: type.place.file, from: type.place.startLine, to: type.place.endLine };
  }

  readImportedPaths(filePath) {
    if (!this.importedPathsByFileMap.has(filePath)) {
      const fileClass = this.codeGraph.findFileClassAt(filePath);
      const imports = fileClass ? this.codeGraph.findRelationsFrom(fileClass).filter(relation => relation.kind === RELATION_KINDS.IMPORTS) : [];
      this.importedPathsByFileMap.set(filePath, new Set(imports.map(relation => relation.to.place.file)));
    }
    return this.importedPathsByFileMap.get(filePath);
  }

  findTheTypesInScope(name, filePath) {
    const family = readLanguageFamily(filePath);
    const importedPaths = this.readImportedPaths(filePath);
    const typeDeclarations = (this.typesByNameMap.get(name) || [])
      .filter(type => readLanguageFamily(type.place.file) === family)
      .map(toTypeDeclaration)
      .filter(isVisibleFrom(filePath, importedPaths));
    return findTheTypeDeclarationsInScope(typeDeclarations, { path: filePath, folder: readFolderPath(filePath), importedPaths }).map(typeDeclaration => typeDeclaration.type);
  }

  isTheOnlyTypeOfItsName(declaredType) {
    const family = readLanguageFamily(declaredType.path);
    return (this.typesByNameMap.get(declaredType.name) || []).filter(type => readLanguageFamily(type.place.file) === family).length === 1;
  }

  isTheTypeInScopeAt(declaredType, filePath) {
    const inScope = this.findTheTypesInScope(declaredType.name, filePath);
    return inScope.length === 1 && inScope[0].place.file === declaredType.path && inScope[0].place.startLine === declaredType.from;
  }

  findTheProductionTypeInScope(name, filePath) {
    const inScope = this.findTheTypesInScope(name, filePath);
    if (inScope.length !== 1 || isTestPath(inScope[0].place.file)) return null;
    return this.readType(this.toDeclaredType(inScope[0]));
  }
}
