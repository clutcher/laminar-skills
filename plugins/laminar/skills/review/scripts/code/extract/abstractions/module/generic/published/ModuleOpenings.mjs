import { Role, ROLE_KINDS } from "../../../../../graph/abstractions/Role.mjs";
import { Evidence, EVIDENCE_KINDS } from "../../../../../graph/Evidence.mjs";
import { getOrJoinModuleFinder } from "../../../../finders/LanguageStrategies.mjs";
import { findDriver } from "../../../../../inputs/source/drivers/LanguageRegistry.mjs";
import { readFileName, readFolderPath } from "../../../../../../files/paths.mjs";

const THE_PACKAGE_FILE_LANGUAGE = "javascript";

const findLanguageOfTheFile = filePath => {
  const driver = findDriver(filePath);
  if (driver) return driver.diffDriver;
  return readFileName(filePath) === "package.json" ? THE_PACKAGE_FILE_LANGUAGE : null;
};

const readPackageFolderBesideTheOpening = opening => {
  const sourceRoot = readFolderPath(opening.path);
  return sourceRoot ? `${sourceRoot}/${opening.packagePath}` : opening.packagePath;
};

export class ModuleOpenings {
  constructor({ change, walkedPaths, walker, shapes, moduleReading, repositoryText, applications }) {
    this.change = change;
    this.walkedPaths = walkedPaths;
    this.walker = walker;
    this.shapes = shapes;
    this.moduleReading = moduleReading;
    this.repositoryText = repositoryText;
    this.applications = applications;
  }

  findModuleRootAndDriverOfTheShape(shape) {
    const pathInsideTheShape = this.walkedPaths.find(filePath => filePath.startsWith(`${shape.root}/`));
    return pathInsideTheShape ? this.moduleReading.findRootAndDriver(readFolderPath(pathInsideTheShape)) : null;
  }

  readThePublishedSets() {
    const publishedSetByRootMap = new Map();
    for (const shape of this.shapes.shapes) {
      const moduleOfTheShape = this.findModuleRootAndDriverOfTheShape(shape);
      if (!moduleOfTheShape || !moduleOfTheShape.driver || publishedSetByRootMap.has(moduleOfTheShape.root)) continue;
      const { root, driver } = moduleOfTheShape;
      const publishedSet = this.moduleReading.findModuleFinder(driver, root).readPublishedSet(this.moduleReading, root, driver);
      publishedSetByRootMap.set(root, publishedSet);
    }
    return publishedSetByRootMap;
  }

  giveTheOpeningRoles(publishedSetByRootMap) {
    for (const publishedSet of publishedSetByRootMap.values()) {
      for (const opening of publishedSet.openings) this.giveTheOpeningRole(opening);
    }
  }

  giveTheOpeningRole(opening) {
    const folder = this.findTheFolderOpenedBy(opening);
    if (folder === null) return;
    const module = this.walker.findOrAddTheModule(folder);
    if (module.hasRole(ROLE_KINDS.OPENING)) return;
    module.addRole(new Role({ kind: ROLE_KINDS.OPENING, of: module, detail: `${opening.path}:${opening.line}`, evidence: new Evidence({ kind: EVIDENCE_KINDS.DECLARED, foundBy: "ModuleReading", detail: opening.text }) }));
  }

  findTheFolderOpenedBy(opening) {
    if (opening.packagePath) return this.findWalkedFolderOfThePackage(opening);
    return this.walkedPaths.some(filePath => filePath.startsWith(`${opening.opens}/`)) ? opening.opens : readFolderPath(opening.opens);
  }

  findWalkedFolderOfThePackage(opening) {
    const packageFolder = readPackageFolderBesideTheOpening(opening);
    return this.walkedPaths.some(filePath => readFolderPath(filePath) === packageFolder) ? packageFolder : null;
  }

  collectFoldersOpenedByTheChange() {
    const openedFolders = this.change.files
      .filter(file => file.existsAfterTheChange)
      .flatMap(file => this.findOpeningsAddedByTheFile(file))
      .map(opening => this.findTheFolderOpenedBy(opening))
      .filter(folder => folder !== null);
    return new Set(openedFolders);
  }

  findOpeningsAddedByTheFile(file) {
    const finder = this.findModuleFinderReadingOpenings(file.path);
    if (!finder) return [];
    return finder.findOpeningsAddedBy(file.path, file.hunks.flatMap(hunk => hunk.numberedAddedLines), this.repositoryText.readFileLines(file.path) || []);
  }

  findModuleFinderReadingOpenings(filePath) {
    const language = findLanguageOfTheFile(filePath);
    return language ? getOrJoinModuleFinder(language, this.applications.listFrameworkNamesAt(readFolderPath(filePath))) : null;
  }
}
