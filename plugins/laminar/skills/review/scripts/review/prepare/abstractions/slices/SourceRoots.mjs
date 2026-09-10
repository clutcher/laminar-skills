import { findRepositoryToRead, isABuildFile, listFolderFileNames, readLanguageFamily } from "../../../../code/index.mjs";
import { readFileName, readFolderPath } from "../../../../files/paths.mjs";

const PACKAGE_DECLARING_EXTENSION_PATTERN = /\.(java|kt|kts|scala|groovy)$/;

const PACKAGE_LINE_PATTERN = /^\s*package\s+([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)\s*;?\s*$/;

const MAX_PACKAGE_FILES_READ = 5;

const BUILD_FOLDER_FILE_NAMES = Object.freeze(["go.mod"]);

const SOURCE_FOLDER_FILE_NAMES = Object.freeze(["Cargo.toml", "pyproject.toml", "setup.py", "setup.cfg"]);

const SOURCE_FOLDER = "src";

const JVM_BUILD_SOURCE_FOLDER = String.raw`src/[^/]+/(?:java|kotlin|scala|groovy)`;

const readLeadingFolderPattern = folders => new RegExp(`^(?:${folders})(?=/|$)`);

const BUILD_SOURCE_FOLDER_PATTERN_BY_BUILD_FILE_MAP = new Map([
  ["pom.xml", readLeadingFolderPattern(JVM_BUILD_SOURCE_FOLDER)],
  ["build.gradle", readLeadingFolderPattern(JVM_BUILD_SOURCE_FOLDER)],
  ["build.gradle.kts", readLeadingFolderPattern(JVM_BUILD_SOURCE_FOLDER)],
  ["build.sbt", readLeadingFolderPattern(JVM_BUILD_SOURCE_FOLDER)],
  ["mix.exs", readLeadingFolderPattern("lib|test")],
]);

const DEEPEST_JVM_BUILD_SOURCE_FOLDER_PATTERN = new RegExp(`^(?:.*/)?${JVM_BUILD_SOURCE_FOLDER}(?=/)`);

const PROJECT_FILE_PATTERN = /\.(csproj|fsproj|vbproj)$/;

const WILDCARD_PATTERN = /[*?{[]/;

const FILE_EXTENSION_PATTERN = /\.[A-Za-z0-9]+$/;

const COMPOSER_AUTOLOAD_SECTIONS = Object.freeze(["autoload", "autoload-dev"]);

const COMPOSER_NAMESPACE_STANDARDS = Object.freeze(["psr-4", "psr-0"]);

const STRING_OR_COMMENT_PATTERN = /("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;

const TRAILING_COMMA_PATTERN = /,(\s*[}\]])/g;

const joinFolders = (folder, relative) => [folder, relative].filter(Boolean).join("/");

const normalizeRelativeFolder = given => String(given || "").replace(/^\.\/?/, "").replace(/\/+$/, "");

export const liesUnder = (folder, root) => !root || folder === root || folder.startsWith(`${root}/`);

const liesStrictlyUnder = (folder, root) => folder !== root && liesUnder(folder, root);

const countSegments = filePath => filePath.split("/").length;

const listAncestorsUpTo = (folder, stop) => {
  const ancestors = [];
  let current = folder;
  while (liesUnder(current, stop)) {
    ancestors.push(current);
    if (current === stop || !current) break;
    current = readFolderPath(current);
  }
  return ancestors;
};

const readPathBelow = (folder, ancestor) => (ancestor ? folder.slice(ancestor.length + 1) : folder);

const findBuildSourceFolderHolding = (ancestor, folder, fileNames) => {
  const pathBelow = readPathBelow(folder, ancestor);
  const found = fileNames
    .filter(name => BUILD_SOURCE_FOLDER_PATTERN_BY_BUILD_FILE_MAP.has(name))
    .map(name => (BUILD_SOURCE_FOLDER_PATTERN_BY_BUILD_FILE_MAP.get(name).exec(pathBelow) || [])[0])
    .find(Boolean);
  return found ? joinFolders(ancestor, found) : null;
};

const findDeepestJvmBuildSourceFolderAbove = folder => (DEEPEST_JVM_BUILD_SOURCE_FOLDER_PATTERN.exec(folder) || [])[0] ?? null;

const findDeepestSourceFolderAbove = folder => {
  const foldersAbove = folder.split("/").slice(0, -1);
  const sourceFolderAt = foldersAbove.lastIndexOf(SOURCE_FOLDER);
  return sourceFolderAt < 0 ? null : foldersAbove.slice(0, sourceFolderAt + 1).join("/");
};

const findDeepestFolder = folders => (folders.length ? [...folders].sort((left, right) => countSegments(right) - countSegments(left))[0] : null);

const findDeepestCommonFolder = filePaths => {
  if (!filePaths.length) return "";
  const folders = filePaths.map(readFolderPath);
  let common = folders[0].split("/");
  for (const folder of folders.slice(1)) {
    const segments = folder.split("/");
    let shared = 0;
    while (shared < common.length && shared < segments.length && common[shared] === segments[shared]) shared++;
    common = common.slice(0, shared);
  }
  return common.join("/");
};

const readPackagePath = lines => {
  for (const line of lines || []) {
    const declared = PACKAGE_LINE_PATTERN.exec(line);
    if (declared) return declared[1].replace(/\./g, "/");
  }
  return "";
};

const countSharedTailSegments = (folderSegments, packageSegments) => {
  let shared = 0;
  while (shared < folderSegments.length && shared < packageSegments.length && folderSegments.at(-1 - shared) === packageSegments.at(-1 - shared)) shared++;
  return shared;
};

const removeThePackagePath = (fileFolder, packagePath) => {
  const folderSegments = fileFolder.split("/");
  const shared = countSharedTailSegments(folderSegments, packagePath.split("/"));
  return shared ? folderSegments.slice(0, folderSegments.length - shared).join("/") : null;
};

const parseLenientJson = text => {
  try {
    return JSON.parse(String(text).replace(STRING_OR_COMMENT_PATTERN, (found, quoted) => quoted || "").replace(TRAILING_COMMA_PATTERN, "$1"));
  } catch { return null; }
};

const readStaticFolderOfThePattern = pattern => {
  const segments = normalizeRelativeFolder(pattern).split("/");
  const fixed = [];
  for (const segment of segments) {
    if (WILDCARD_PATTERN.test(segment)) break;
    fixed.push(segment);
  }
  const folder = fixed.join("/");
  return FILE_EXTENSION_PATTERN.test(folder) && fixed.length === segments.length ? readFolderPath(folder) : folder;
};

const listTypeScriptSourceFolders = configuration => {
  const options = configuration.compilerOptions || {};
  return [
    ...(options.rootDir ? [normalizeRelativeFolder(options.rootDir)] : []),
    ...(options.rootDirs || []).map(normalizeRelativeFolder),
    ...(configuration.include || []).map(readStaticFolderOfThePattern),
  ].filter(Boolean);
};

const listComposerSourceFolders = configuration => COMPOSER_AUTOLOAD_SECTIONS
  .flatMap(section => COMPOSER_NAMESPACE_STANDARDS.map(standard => (configuration[section] || {})[standard] || {}))
  .flatMap(foldersByNamespace => Object.values(foldersByNamespace).flat())
  .filter(given => typeof given === "string")
  .map(normalizeRelativeFolder);

const SOURCE_FOLDER_LISTS_BY_CONFIGURATION = Object.freeze({ "tsconfig.json": listTypeScriptSourceFolders, "composer.json": listComposerSourceFolders });

export class SourceRoots {
  constructor({ applicationRoots = [], sourcePaths = [], readFileLines = () => null, listFileNamesIn = () => [], readsOnlyTheChange = false } = {}) {
    this.applicationRoots = [...applicationRoots].sort((left, right) => right.length - left.length);
    this.sourcePaths = [...new Set(sourcePaths)].filter(filePath => !isABuildFile(filePath));
    this.readFileLines = readFileLines;
    this.listFileNamesIn = listFileNamesIn;
    this.readsOnlyTheChange = readsOnlyTheChange;
    this.rootByFolderMap = new Map();
    this.packageRoots = null;
  }

  static createForTheChange(change, readFileLines, applicationRoots = [], walkedPaths = []) {
    const repository = findRepositoryToRead(change);
    const shownAfterTheChange = change.files.filter(file => file.existsAfterTheChange).map(file => file.path);
    const listFileNamesShownByTheChange = folder => shownAfterTheChange.filter(filePath => readFolderPath(filePath) === folder).map(readFileName);
    return new SourceRoots({
      applicationRoots,
      sourcePaths: [...walkedPaths, ...shownAfterTheChange],
      readFileLines,
      listFileNamesIn: folder => (repository ? listFolderFileNames(repository, folder) : listFileNamesShownByTheChange(folder)),
      readsOnlyTheChange: !repository,
    });
  }

  findSourceRootOf(folder) {
    if (!this.rootByFolderMap.has(folder)) this.rootByFolderMap.set(folder, this.chooseSourceRootOf(folder));
    return this.rootByFolderMap.get(folder);
  }

  chooseSourceRootOf(folder) {
    const application = this.findApplicationOf(folder);
    const found = this.findRootByThePackage(folder) ?? this.findRootByTheBuildConfiguration(folder, application) ?? this.guessRootOf(folder, application);
    return liesStrictlyUnder(folder, found) ? found : readFolderPath(folder);
  }

  findApplicationOf(folder) {
    return this.applicationRoots.find(root => liesUnder(folder, root)) || "";
  }

  listSourcePathsUnder(folder) {
    return this.sourcePaths.filter(filePath => liesStrictlyUnder(filePath, folder)).sort((left, right) => countSegments(left) - countSegments(right) || left.localeCompare(right));
  }

  findRootByThePackage(folder) {
    const declaring = this.listSourcePathsUnder(folder).filter(filePath => PACKAGE_DECLARING_EXTENSION_PATTERN.test(filePath)).slice(0, MAX_PACKAGE_FILES_READ);
    for (const filePath of declaring) {
      const root = this.readRootByThePackageOf(filePath);
      if (root !== null) return root;
    }
    return null;
  }

  readRootByThePackageOf(filePath) {
    const packagePath = readPackagePath(this.readFileLines(filePath));
    return packagePath ? removeThePackagePath(readFolderPath(filePath), packagePath) : null;
  }

  guessRootOf(folder, application) {
    return this.readsOnlyTheChange ? this.guessRootFromTheChangedPaths(folder, application) : this.findRootAboveEverySourceFolder(folder, application);
  }

  guessRootFromTheChangedPaths(folder, application) {
    return this.findRootByThePackageOfAnotherFolder(folder) ?? findDeepestJvmBuildSourceFolderAbove(folder) ?? findDeepestSourceFolderAbove(folder) ?? this.findRootAboveEverySourceFolder(folder, application);
  }

  findRootByThePackageOfAnotherFolder(folder) {
    return findDeepestFolder(this.listPackageRoots().filter(root => liesStrictlyUnder(folder, root)));
  }

  listPackageRoots() {
    if (!this.packageRoots) {
      const declaring = this.sourcePaths.filter(filePath => PACKAGE_DECLARING_EXTENSION_PATTERN.test(filePath));
      this.packageRoots = [...new Set(declaring.map(filePath => this.readRootByThePackageOf(filePath)).filter(root => root !== null))];
    }
    return this.packageRoots;
  }

  findRootByTheBuildConfiguration(folder, application) {
    for (const ancestor of listAncestorsUpTo(folder, application)) {
      const found = this.readRootDeclaredIn(ancestor, folder);
      if (found !== null) return found;
    }
    return null;
  }

  readRootDeclaredIn(ancestor, folder) {
    const fileNames = this.listFileNamesIn(ancestor);
    if (!fileNames.length) return null;
    const declared = this.findDeclaredSourceFolderHolding(ancestor, folder, fileNames);
    if (declared !== null) return declared;
    const buildSourceFolder = findBuildSourceFolderHolding(ancestor, folder, fileNames);
    if (buildSourceFolder !== null) return buildSourceFolder;
    if (fileNames.some(name => BUILD_FOLDER_FILE_NAMES.includes(name) || PROJECT_FILE_PATTERN.test(name))) return ancestor;
    if (fileNames.some(name => SOURCE_FOLDER_FILE_NAMES.includes(name))) {
      const sourceFolder = joinFolders(ancestor, SOURCE_FOLDER);
      return liesUnder(folder, sourceFolder) ? sourceFolder : ancestor;
    }
    return null;
  }

  findDeclaredSourceFolderHolding(ancestor, folder, fileNames) {
    const declared = Object.entries(SOURCE_FOLDER_LISTS_BY_CONFIGURATION)
      .filter(([configurationName]) => fileNames.includes(configurationName))
      .flatMap(([configurationName, listSourceFolders]) => this.listSourceFoldersDeclaredIn(joinFolders(ancestor, configurationName), listSourceFolders))
      .map(relative => joinFolders(ancestor, relative));
    return findDeepestFolder(declared.filter(root => liesUnder(folder, root)));
  }

  listSourceFoldersDeclaredIn(configurationPath, listSourceFolders) {
    const configuration = parseLenientJson((this.readFileLines(configurationPath) || []).join("\n"));
    return configuration ? listSourceFolders(configuration) : [];
  }

  findRootAboveEverySourceFolder(folder, application) {
    const sourcePaths = this.listSourcePathsOfTheFamilyOf(folder, application);
    if (!sourcePaths.length) return application;
    const deepestCommon = findDeepestCommonFolder(sourcePaths);
    const holdsASourceFile = sourcePaths.some(filePath => readFolderPath(filePath) === deepestCommon);
    return holdsASourceFile && deepestCommon !== application ? readFolderPath(deepestCommon) : deepestCommon;
  }

  listSourcePathsOfTheFamilyOf(folder, application) {
    const family = this.findLanguageFamilyOf(folder);
    return this.listSourcePathsUnder(application).filter(filePath => !family || readLanguageFamily(filePath) === family);
  }

  findLanguageFamilyOf(folder) {
    const sourcePath = this.listSourcePathsUnder(folder).find(filePath => readLanguageFamily(filePath));
    return sourcePath ? readLanguageFamily(sourcePath) : null;
  }
}
