import { getOrReadAndRemember } from "../../../collections/memos.mjs";

export const listLinesSpannedBy = declaration => {
  const indexes = [];
  for (let at = declaration.line - 1; at <= declaration.to - 1; at++) indexes.push(at);
  return indexes;
};

export const SourceLayout = {
  listLinesOfMethod(method) {
    return listLinesSpannedBy(method);
  },

  findMethodHoldingTheLine(file, index) {
    return this.findMethodsInTheFile(file).find(method => method.line - 1 <= index && method.to - 1 >= index);
  },

  findMethodsInTheFile(file) {
    return this.readMethodsByPathMap().get(file.path) || [];
  },

  readMethodsByPathMap() {
    if (!this.methodsByPathMap) this.methodsByPathMap = this.groupByPath(this.methods);
    return this.methodsByPathMap;
  },

  groupByPath(declarations) {
    const declarationsByPathMap = new Map();
    for (const declaration of declarations) this.add(declarationsByPathMap, declaration.path, declaration);
    return declarationsByPathMap;
  },

  getOrReadLevelIndexes(file) {
    if (!file.levelIndexes) file.levelIndexes = this.readLevelIndexes(file);
    return file.levelIndexes;
  },

  readLevelIndexes(file) {
    const insideAMethod = new Uint8Array(file.code.length);
    for (const method of this.findMethodsInTheFile(file)) insideAMethod.fill(1, method.line, method.to);
    const levelIndexes = [];
    for (let at = 0; at < file.code.length; at++) if (!insideAMethod[at]) levelIndexes.push(at);
    return levelIndexes;
  },

  findFieldLines(method) {
    if (!method.enclosingTypeName) return [];
    return this.getOrReadFieldLines(method, () => {
      const insideAMethod = this.buildMethodLineMask(method.file);
      return this.findEnclosingTypeLines(method).filter(at => !insideAMethod[at]);
    });
  },

  getOrReadFieldLines(method, readFieldLines) {
    if (!this.fieldLinesByEnclosingTypeMap) this.fieldLinesByEnclosingTypeMap = new Map();
    return getOrReadAndRemember(this.fieldLinesByEnclosingTypeMap, `${method.path}\u0000${method.enclosingTypeName}`, readFieldLines);
  },

  buildMethodLineMask(file) {
    const insideAMethod = new Uint8Array(file.code.length);
    for (const method of this.findMethodsInTheFile(file)) insideAMethod.fill(1, method.line - 1, method.to);
    return insideAMethod;
  },

  findEnclosingTypeLines(method) {
    if (!method.enclosingTypeName) return [];
    const typeDeclaration = this.findTypeDeclarationInTheFile(method, method.enclosingTypeName);
    return typeDeclaration ? listLinesSpannedBy(typeDeclaration) : [];
  },
};
