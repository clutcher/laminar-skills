import path from "node:path";
import { IMPORT_LINE_PATTERN } from "../reading/SourceFile.mjs";
import { readLastSegment } from "../../../../../inputs/source/names/QualifiedNames.mjs";
import { readImportConventions } from "../../../../finders/LanguageStrategies.mjs";
import { isVendored } from "../../../../../inputs/repository/RepositoryFileKinds.mjs";
import { escapeForAPattern } from "../../../../../inputs/source/text/PatternText.mjs";
import { FUNCTION_VALUE_PATTERN_SOURCE } from "../../../variable/generic/values/ValueForms.mjs";

const PATH_ALIAS_PATTERN = /^(?:[@~]\/|#)/;

const SCRIPT_EXTENSION_PATTERN = /\.(?:[cm]?[jt]sx?)$/;

const buildPythonRelativePath = (folder, container) => {
  const dots = /^\.*/.exec(container)[0].length;
  const segments = folder.split("/").filter(Boolean);
  const base = segments.slice(0, Math.max(0, segments.length - (dots - 1)));
  return [...base, ...container.slice(dots).split(".").filter(Boolean)].join("/");
};

const functionValueFormsByNameMap = new Map();

const buildFunctionValueForm = name => {
  if (!functionValueFormsByNameMap.has(name)) {
    functionValueFormsByNameMap.set(name, new RegExp(`^\\s*(?:export\\s+)?(?:(?:const|let|var)\\s+|(?:module\\.)?exports\\.)${escapeForAPattern(name)}\\s*(?::[^=]+)?=${FUNCTION_VALUE_PATTERN_SOURCE}`));
  }
  return functionValueFormsByNameMap.get(name);
};

const buildPathOfAContainer = container => container.split(/::|\\|\./).filter(Boolean).join("/");

const buildRepositoryPathOfAModuleName = dotted => (PATH_ALIAS_PATTERN.test(dotted) ? dotted.replace(PATH_ALIAS_PATTERN, "").replace(/\/(?:index)?$/, "") : buildPathOfAContainer(dotted));

const RELATIVE_PATH_PATTERN = /^\.{1,2}(?:\/|$)/;

const buildRelativeStem = (folder, container) => path.posix.normalize(path.posix.join(folder, container)).replace(SCRIPT_EXTENSION_PATTERN, "").replace(/\/$/, "");

const readAliasedStem = container => container.replace(PATH_ALIAS_PATTERN, "").replace(SCRIPT_EXTENSION_PATTERN, "");

const IMPORT_KINDS = Object.freeze({ NONE: "NONE", NAME_FOLDER: "NAME_FOLDER", RELATIVE: "RELATIVE", ALIAS: "ALIAS", BY_SPECIFIER: "BY_SPECIFIER", DOTTED_RELATIVE: "DOTTED_RELATIVE", BARE: "BARE" });

const readContainer = imported => String(imported.container || imported.full || "");

function readKindOfAnImport(file, imported) {
  const container = readContainer(imported);
  const conventions = readImportConventions(file.diffDriver);
  if (!container) return IMPORT_KINDS.NONE;
  if (conventions.importsNameFolders) return IMPORT_KINDS.NAME_FOLDER;
  if (RELATIVE_PATH_PATTERN.test(container)) return IMPORT_KINDS.RELATIVE;
  if (PATH_ALIAS_PATTERN.test(container)) return IMPORT_KINDS.ALIAS;
  if (imported.bySpecifier) return IMPORT_KINDS.BY_SPECIFIER;
  if (conventions.relativeImportsUseDots && container.startsWith(".")) return IMPORT_KINDS.DOTTED_RELATIVE;
  return IMPORT_KINDS.BARE;
}

const readTypeNameOfAContainer = container => readLastSegment(container.replace(/::|\\/g, "."), ".");

const namesAFolderContainer = imported => {
  const container = String(imported.container || "");
  return Boolean(container) && !/^\./.test(container) && !imported.bySpecifier;
};

const RUST_REPOSITORY_ROOT_PATTERN = /^(?:crate|super|self)::/;

const stripARepositoryRoot = imported => (RUST_REPOSITORY_ROOT_PATTERN.test(imported.full)
  ? { full: imported.full.replace(RUST_REPOSITORY_ROOT_PATTERN, ""), container: String(imported.container || "").replace(RUST_REPOSITORY_ROOT_PATTERN, ""), bySpecifier: false }
  : null);

const usesBeyondAnnotations = (file, word) => {
  const use = new RegExp(`(?<![\\w$@.])${escapeForAPattern(word)}(?![\\w$])`);
  return file.code.some((text, index) => !IMPORT_LINE_PATTERN.test(file.raw[index] || "") && use.test(text || ""));
};

export const ImportResolution = {
  collectImportsOfAFile(file) {
    const imports = new Set();
    const outside = new Set();
    file.findImport("");
    const hold = (imported, word) => {
      const inside = stripARepositoryRoot(imported);
      if (inside || this.importsFromTheRepository(file, imported)) {
        for (const target of this.findFilesOfAnImportedName(file, inside || imported)) if (target.path !== file.path) imports.add(target.path);
        return;
      }
      if (word && !usesBeyondAnnotations(file, word)) return;
      outside.add(imported.container || imported.full);
    };
    for (const [word, imported] of file.importPathsByWordMap) hold(imported, word);
    for (const imported of file.readWildcardImports()) hold(imported, "");
    return { path: file.path, imports: [...imports].sort(), outside: [...outside].sort() };
  },

  findFilesOfAnImportedName(file, imported) {
    return [
      ...this.findFilesOfAnImport(file, imported),
      ...this.findFilesOfTheImportAsAModule(file, imported),
      ...this.findFilesOfTheFolderAContainerNames(imported),
    ];
  },

  findFilesOfTheFolderAContainerNames(imported) {
    if (!namesAFolderContainer(imported)) return [];
    return this.findFilesOfTheFolderOfImport(buildPathOfAContainer(String(imported.container)));
  },

  findFilesOfTheFolderOfImport(importPath) {
    const folder = this.findFolderOfImport(importPath);
    return folder === null ? [] : this.filesByFolderMap.get(folder) || [];
  },

  findFolderOfImport(importPath) {
    if (!importPath) return null;
    if (!this.folderByImportPathMap.has(importPath)) {
      const segments = importPath.split("/");
      let found = null;
      for (let from = 0; from < segments.length && found === null; from++) {
        const suffix = segments.slice(from).join("/");
        if (this.filesByFolderMap.has(suffix) && !isVendored(`${suffix}/`)) found = suffix;
      }
      this.folderByImportPathMap.set(importPath, found);
    }
    return this.folderByImportPathMap.get(importPath);
  },

  findFilesAtExactlyTheStem(wanted) {
    if (!wanted) return [];
    return this.indexFilesByStem().get(wanted) || [];
  },

  findFilesAtStemsEndingIn(wanted) {
    if (!wanted) return [];
    this.indexFilesByStem();
    const stems = (this.stemsByLastSegmentMap.get(readLastSegment(wanted, "/")) || []).filter(stem => stem === wanted || stem.endsWith(`/${wanted}`));
    return stems.flatMap(stem => this.filesByStemMap.get(stem));
  },

  indexFilesByStem() {
    if (!this.filesByStemMap) {
      this.filesByStemMap = new Map();
      for (const file of this.files) {
        const stem = file.path.replace(/\.[^./]+$/, "");
        this.add(this.filesByStemMap, stem, file);
        const folderStem = stem.replace(/(?:^|\/)(?:index|__init__)$/, "");
        if (folderStem !== stem && folderStem) this.add(this.filesByStemMap, folderStem, file);
      }
      this.stemsByLastSegmentMap = new Map();
      for (const stem of this.filesByStemMap.keys()) this.add(this.stemsByLastSegmentMap, readLastSegment(stem, "/"), stem);
    }
    return this.filesByStemMap;
  },

  findFilesOfTheImportAsAModule(file, imported) {
    return this.findFilesOfAnImport(file, { ...imported, container: imported.full });
  },

  findFilesOfAnImport(file, imported) {
    const container = readContainer(imported);
    const kind = readKindOfAnImport(file, imported);
    if (kind === IMPORT_KINDS.NONE || kind === IMPORT_KINDS.BY_SPECIFIER) return [];
    if (kind === IMPORT_KINDS.NAME_FOLDER) return this.findFilesOfTheFolderOfImport(imported.full);
    if (kind === IMPORT_KINDS.RELATIVE) return this.findFilesAtExactlyTheStem(buildRelativeStem(file.folder, container));
    if (kind === IMPORT_KINDS.ALIAS) return this.findFilesAtStemsEndingIn(readAliasedStem(container));
    if (kind === IMPORT_KINDS.DOTTED_RELATIVE) return this.findFilesAtExactlyTheStem(buildPythonRelativePath(file.folder, container));
    return this.findFilesAtStemsEndingIn(buildPathOfAContainer(container));
  },

  findWildcardDeclaration(file, name) {
    for (const imported of file.readWildcardImports()) {
      if (!this.importsFromTheRepository(file, imported)) continue;
      const found = this.findDeclarationOfAnImport(file, { ...imported, full: `${imported.container}.${name}` }, new Set());
      if (found) return found;
    }
    return null;
  },

  findImportedDeclaration(file, word) {
    const imported = file.findImport(word);
    if (!imported || !this.importsFromTheRepository(file, imported)) return null;
    return this.findDeclarationOfAnImport(file, imported, new Set());
  },

  findDeclarationOfAnImport(file, imported, seen) {
    const whole = imported.full === imported.container;
    const name = whole ? "" : imported.full.slice(imported.container.length + 1);
    if (!whole) {
      const asModule = readImportConventions(file.diffDriver).importedNameMayBeAModule ? this.findFilesOfTheImportAsAModule(file, imported) : [];
      if (asModule.length) return { kind: "module", files: asModule };
    }
    const files = this.findFilesOfAnImport(file, imported);
    if (!files.length) return null;
    if (whole) {
      const exported = readImportConventions(file.diffDriver).defaultExportsNameTheModule && files.length === 1 ? files[0].readDefaultExport() : null;
      if (exported && exported.constructed) return { kind: "value", text: exported.name, file: files[0] };
      const found = exported ? this.findTheDeclarationThroughTheFile(files[0], exported.name, seen) : null;
      return found || { kind: "module", files };
    }
    for (const file of files) {
      const found = this.findTheDeclarationThroughTheFile(file, name, seen);
      if (found) return found;
    }
    const members = this.findMethodsOfTheImportedType(imported, name, files);
    return members.length ? { kind: "function", targets: members.map(member => member.id) } : null;
  },

  findMethodsOfTheImportedType(imported, name, files) {
    const paths = new Set(files.map(file => file.path));
    return this.findMethodsOfTheTypeNamed(readTypeNameOfAContainer(imported.container), name).filter(method => paths.has(method.path));
  },

  findTheDeclarationThroughTheFile(file, name, seen) {
    const key = `${file.path}\u0000${name}`;
    if (!name || seen.has(key)) return null;
    seen.add(key);
    return this.findTheDeclarationInTheFile(file, name)
      || this.findTheDeclarationThroughTheImportsOf(file, name, seen)
      || this.findTheOriginOfTheNameInTheFile(file, name);
  },

  findTheDeclarationInTheFile(file, name) {
    const functions = (this.topLevelByPathMap.get(file.path) || []).filter(method => method.name === name);
    if (functions.length) return { kind: "function", targets: functions.map(method => method.id) };
    const typeDeclaration = (this.typesByNameMap.get(name) || []).find(type => type.path === file.path);
    if (typeDeclaration) return { kind: "type", typeDeclaration };
    if (this.getOrReadLevelIndexes(file).some(index => buildFunctionValueForm(name).test(file.code[index] || ""))) return { kind: "function value" };
    const text = this.readFileLevelTypeText(file, name);
    return text ? { kind: "value", text, file: file } : null;
  },

  findTheDeclarationThroughTheImportsOf(file, name, seen) {
    const imported = file.findImport(name) || file.findNamedReExport(name);
    if (imported) {
      if (!this.importsFromTheRepository(file, imported)) return { kind: "outside", names: this.findNamesOfAnOutsideImport(file, imported, "full") };
      const further = this.findDeclarationOfAnImport(file, imported, seen);
      if (further) return further;
    }
    for (const star of file.readStarExports()) {
      for (const other of this.findFilesOfAnImport(file, star)) {
        const found = this.findTheDeclarationThroughTheFile(other, name, seen);
        if (found) return found;
      }
    }
    return null;
  },

  findTheOriginOfTheNameInTheFile(file, name) {
    const context = this.getOrAddContext(file, "");
    for (const index of this.getOrReadLevelIndexes(file)) {
      const found = this.findOriginOfTheNameAtTheLine(context, index, name);
      if (found && !found.element) return { kind: "origin", file: file, index, expression: found.expression };
    }
    return null;
  },

  importsFromTheRepository(file, imported) {
    const kind = readKindOfAnImport(file, imported);
    if (kind === IMPORT_KINDS.RELATIVE || kind === IMPORT_KINDS.DOTTED_RELATIVE) return true;
    if (kind === IMPORT_KINDS.BY_SPECIFIER) return false;
    if (kind === IMPORT_KINDS.NAME_FOLDER) return this.findFolderOfImport(imported.full) !== null;
    if (readImportConventions(file.diffDriver).packagesAreFoldersWithInitFiles) return this.namesAPythonModuleOfTheRepository(imported.container || imported.full);
    return this.namesARepositoryModule(imported);
  },

  namesARepositoryModule(imported) {
    const key = imported.container || imported.full;
    const answers = this.readRepositoryModuleAnswers();
    if (!answers.has(key)) answers.set(key, this.namesAModuleOfTheRepository(key) || this.namesAModuleOfTheRepository(imported.full));
    return answers.get(key);
  },

  readRepositoryModuleAnswers() {
    if (!this.repositoryModuleAnswersByNameMap) this.repositoryModuleAnswersByNameMap = new Map();
    return this.repositoryModuleAnswersByNameMap;
  },

  namesAPythonModuleOfTheRepository(dotted) {
    const segments = dotted.split(".").filter(Boolean);
    if (this.readPythonPackageNames().has(segments[0])) return true;
    return segments.length > 1 && this.findFilesAtStemsEndingIn(segments.join("/")).length > 0;
  },

  readPythonPackageNames() {
    if (!this.pythonPackages) {
      const paths = new Set(this.files.map(file => file.path));
      this.pythonPackages = new Set();
      for (const path of paths) {
        if (!path.endsWith(".py")) continue;
        const segments = path.replace(/\.py$/, "").split("/");
        if (segments[segments.length - 1] === "__init__") segments.pop();
        let first = segments.length - 1;
        while (first > 0 && paths.has(`${segments.slice(0, first).join("/")}/__init__.py`)) first--;
        if (segments.length) this.pythonPackages.add(segments[first]);
        if (first > 0) this.pythonPackages.add(segments[first - 1]);
      }
    }
    return this.pythonPackages;
  },

  namesAModuleOfTheRepository(dotted) {
    const wanted = buildRepositoryPathOfAModuleName(dotted);
    if (!wanted) return false;
    for (const stem of this.readModuleStemsOfTheRepository()) if (stem === wanted || stem.endsWith(`/${wanted}`)) return true;
    return false;
  },

  readModuleStemsOfTheRepository() {
    if (!this.moduleStems) {
      this.moduleStems = new Set();
      for (const file of this.files) {
        this.moduleStems.add(file.path.replace(/\.[^./]+$/, ""));
        this.moduleStems.add(file.folder);
      }
    }
    return this.moduleStems;
  },
};
