import { readDeclaredAbstractions, findDriver, endsADeclarationHead, isTestPath, namesAType, isACallKind, Scale } from "../../../code/index.mjs";
import { readFileStem } from "../../../files/paths.mjs";

const MAX_HEAD_LINES = 6;

const ABSTRACT_TYPE_HEAD_PATTERN = /\b(?:interface|abstract|trait|sealed)\b/;

export class RepositoryAbstractions {
  constructor(graph, repositoryText, readLinesOf) {
    this.graph = graph;
    this.repositoryText = repositoryText;
    this.readLinesOf = readLinesOf;
    this.typeNameByPathMap = new Map();
  }

  listAbstractionsOfTheFile(filePath) {
    return this.readAbstractionsByPath().get(filePath) || [];
  }

  listSupertypes(className, filePath) {
    const driver = findDriver(filePath);
    const known = this.listAbstractionsOfTheFile(filePath)
      .find(abstraction => abstraction.name === className && abstraction.scale === Scale.CLASS.name);
    if (!driver || !known) return [];
    return driver.listSupertypes(this.readTheDeclarationHead(filePath, known))
      .filter(name => name !== className && this.declaresTheName(name));
  }

  readTheDeclarationHead(filePath, known) {
    const head = [];
    for (const line of this.readLinesOf(filePath).slice(known.line - 1, known.line - 1 + MAX_HEAD_LINES)) {
      head.push(line);
      if (endsADeclarationHead(line)) break;
    }
    return head.join(" ");
  }

  findDeclaringPath(name, preferredPath) {
    const declaring = Boolean(preferredPath) && this.listAbstractionsOfTheFile(preferredPath).some(abstraction => abstraction.name === name);
    if (declaring) return preferredPath;
    const declaringPaths = this.collectDeclaringPaths().get(name) || [];
    return declaringPaths.find(filePath => readFileStem(filePath) === name) || declaringPaths[0] || "";
  }

  collectDeclaringPaths() {
    if (!this.pathsByDeclaredNameMap) {
      this.pathsByDeclaredNameMap = new Map();
      for (const [filePath, known] of this.readAbstractionsByPath()) this.addDeclaringPath(filePath, known);
    }
    return this.pathsByDeclaredNameMap;
  }

  addDeclaringPath(filePath, known) {
    if (!this.pathsByDeclaredNameMap || isTestPath(filePath)) return;
    for (const abstraction of known) {
      const paths = this.pathsByDeclaredNameMap.get(abstraction.name) || [];
      if (paths[paths.length - 1] !== filePath) paths.push(filePath);
      this.pathsByDeclaredNameMap.set(abstraction.name, paths);
    }
  }

  findTypeNameOfTheFile(filePath) {
    if (this.typeNameByPathMap.has(filePath)) return this.typeNameByPathMap.get(filePath);
    const known = this.listAbstractionsOfTheFile(filePath).map(abstraction => abstraction.name);
    const stem = readFileStem(filePath);
    const typeName = known.includes(stem) ? stem : (known.find(namesAType) || "");
    this.typeNameByPathMap.set(filePath, typeName);
    return typeName;
  }

  findClassDeclarationLine(className, filePath) {
    const known = this.listAbstractionsOfTheFile(filePath)
      .find(abstraction => abstraction.name === className && abstraction.scale === Scale.CLASS.name);
    return known ? known.line : null;
  }

  findTheMethodsCallingInto(filePath, calledFilePaths) {
    if (!this.graph) return [];
    const called = new Set(calledFilePaths.filter(calledFilePath => calledFilePath !== filePath));
    const callsInto = method => this.graph.findRelationsFrom(method).some(relation => isACallKind(relation) && relation.to.place && called.has(relation.to.place.file));
    return this.graph.findAbstractionsIn(filePath)
      .filter(walked => String(walked.scale) === Scale.METHOD.name && callsInto(walked))
      .map(method => ({ name: method.name, line: method.place.startLine }))
      .sort((left, right) => left.line - right.line);
  }

  isAnAbstractType(className, filePath) {
    const known = this.listAbstractionsOfTheFile(filePath)
      .find(abstraction => abstraction.name === className && abstraction.scale === Scale.CLASS.name);
    return Boolean(known) && ABSTRACT_TYPE_HEAD_PATTERN.test(this.readLinesOf(filePath)[known.line - 1] || "");
  }

  readAbstractions() {
    if (this.readNames) return;
    this.readNames = new Set();
    this.abstractionsByPathMap = new Map();
    for (const abstraction of readDeclaredAbstractions(this.graph, filePath => this.repositoryText.readFileLines(filePath))) {
      this.readNames.add(abstraction.name);
      if (!this.abstractionsByPathMap.has(abstraction.path)) this.abstractionsByPathMap.set(abstraction.path, []);
      this.abstractionsByPathMap.get(abstraction.path).push(abstraction);
    }
  }

  declaresTheName(name) {
    return this.readDeclaredNames().has(name);
  }

  readDeclaredNames() {
    this.readAbstractions();
    return this.readNames;
  }

  readAbstractionsByPath() {
    this.readAbstractions();
    return this.abstractionsByPathMap;
  }
}
