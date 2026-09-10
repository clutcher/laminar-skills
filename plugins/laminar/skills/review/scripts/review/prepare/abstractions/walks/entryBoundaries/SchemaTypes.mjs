import { readApplicationName, findDeployableFolder, findDriver, isADeclaredType, isASchemaFile, isATypesOnlyFile, isPlacedInSource, Scale } from "../../../../../code/index.mjs";

const isASchemaType = abstraction => isADeclaredType(abstraction) && isPlacedInSource(abstraction) && isATypesOnlyFile(abstraction.place.file);

const buildSchemaFields = (type, typeDisplayName) => type.children.filter(isPlacedInSource)
  .sort((left, right) => left.place.startLine - right.place.startLine)
  .map(field => ({ name: field.name, line: field.place.startLine, to: Math.max(field.place.startLine, field.place.endLine), displayName: `${typeDisplayName}#${field.name}` }));

const MAX_DECLARED_TYPE_LINES = 12;

const DECLARATION_KIND_PATTERN = /^\s*(?:extend\s+)?([a-z]+)\s/;

const readDeclarationKind = headText => (DECLARATION_KIND_PATTERN.exec(String(headText)) || [])[1] || "";

const buildDeclaredType = (type, lines) => {
  const to = Math.min(Math.max(type.place.startLine, type.place.endLine || type.place.startLine), type.place.startLine + MAX_DECLARED_TYPE_LINES - 1);
  const numberedLines = Array.from({ length: to - type.place.startLine + 1 }, (unused, at) => ({ line: type.place.startLine + at, text: String(lines[type.place.startLine + at - 1] ?? "") }));
  return { name: type.name, kind: readDeclarationKind(numberedLines[0].text), path: type.place.file, line: type.place.startLine, to, lines: numberedLines };
};

export class SchemaTypes {
  constructor(repositoryText, roots, codeGraph) {
    this.repositoryText = repositoryText;
    this.roots = roots;
    this.codeGraph = codeGraph;
    this.schemaFilesByApplicationMap = new Map();
  }

  listSchemaTypesOfTheApplication(applicationFolder) {
    if (!this.schemaFilesByApplicationMap.has(applicationFolder)) {
      this.schemaFilesByApplicationMap.set(applicationFolder, this.listSchemaFiles()
        .filter(file => findDeployableFolder(file.path, this.roots) === applicationFolder)
        .flatMap(file => this.readSchemaTypesOfTheFile(file)));
    }
    return this.schemaFilesByApplicationMap.get(applicationFolder);
  }

  findDeclaredType(applicationFolder, typeName) {
    for (const file of this.listSchemaFiles().filter(schemaFile => findDeployableFolder(schemaFile.path, this.roots) === applicationFolder)) {
      const type = this.groupSchemaTypesByFile().get(file.path).find(declared => declared.name === typeName);
      if (type) return buildDeclaredType(type, file.lines);
    }
    return null;
  }

  groupSchemaTypesByFile() {
    if (!this.cachedSchemaTypesByFileMap) {
      this.cachedSchemaTypesByFileMap = new Map();
      for (const type of this.codeGraph.listAbstractionsAt(Scale.CLASS).filter(isASchemaType)) {
        if (!this.cachedSchemaTypesByFileMap.has(type.place.file)) this.cachedSchemaTypesByFileMap.set(type.place.file, []);
        this.cachedSchemaTypesByFileMap.get(type.place.file).push(type);
      }
    }
    return this.cachedSchemaTypesByFileMap;
  }

  listSchemaFiles() {
    if (!this.everySchemaFile) {
      this.everySchemaFile = [...this.groupSchemaTypesByFile().keys()].sort()
        .map(filePath => ({ path: filePath, lines: this.repositoryText.readFileLines(filePath) || [] }))
        .filter(file => isASchemaFile(file.path, file.lines));
    }
    return this.everySchemaFile;
  }

  readSchemaTypesOfTheFile(file) {
    const application = readApplicationName(file.path, this.roots);
    return [...this.groupSchemaTypesByFile().get(file.path)]
      .sort((left, right) => left.place.startLine - right.place.startLine)
      .map(type => ({ type, read: findDriver(file.path).findSchemaType(String(file.lines[type.place.startLine - 1] ?? ""), type.name, application) }))
      .filter(({ read }) => read.holdsFields)
      .map(({ type, read }) => ({ name: type.name, line: type.place.startLine, ...read, fields: buildSchemaFields(type, read.displayName), path: file.path, lines: file.lines }));
  }
}
