import { findDriver, isOfTheFamilyOf } from "../../../../../inputs/source/drivers/LanguageRegistry.mjs";
import { readFileName } from "../../../../../../files/paths.mjs";
import { ModuleFolderFiles } from "./ModuleFolderFiles.mjs";
import { getOrJoinModuleFinder } from "../../../../finders/LanguageStrategies.mjs";
import { FinderContext } from "../../../../finders/FinderContext.mjs";
import { MODULE_FINDER_REGISTRY } from "../../index.mjs";
import { ROLE_KINDS } from "../../../../../graph/abstractions/Role.mjs";
import { findDeployableFolder } from "../../../application/generic/ApplicationFolders.mjs";
import { ModuleShapes } from "../shapes/ModuleShapes.mjs";

const MAX_TREE_LINES = 120;

const NO_READING = Object.freeze({ root: "", isRoot: false, rootForm: "", reason: "", exposed: [], boundaries: [], tree: [], references: [], modulePackage: "", applicationPackage: "" });

const NO_MODULE_FORM_READ = "no module form for this language";

const NO_REPOSITORY_READ = "mode: patch";

const NO_GRAPH_READING = Object.freeze({ findReferencesNamed: () => [], findApplicationStarts: () => [], findFrameworksAt: () => [] });

const buildGraphReading = (graph, roots) => ({
  findReferencesNamed: name => graph.findWalkedReferencesNamed(name)
    .map(reference => ({ path: reference.place.file, line: reference.place.startLine, kind: reference.kind, receiver: reference.receiver })),
  findApplicationStarts: language => graph.findAbstractionsWithRole(ROLE_KINDS.APPLICATION_START)
    .map(abstraction => abstraction.place.file)
    .filter(filePath => isOfTheFamilyOf(filePath, language)),
  findFrameworksAt: folder => graph.findFrameworksOfApplication(findDeployableFolder(folder, roots) ?? ""),
});

export class ModuleReading {
  static createFromGraph(repository, graph, roots = [], shapes = ModuleShapes.createNone()) {
    return new ModuleReading(repository, buildGraphReading(graph, roots), shapes);
  }

  constructor(repository, graphReading = NO_GRAPH_READING, shapes = ModuleShapes.createNone()) {
    this.repository = repository || null;
    this.shapes = shapes;
    this.graphReading = { ...NO_GRAPH_READING, ...graphReading };
    this.folderFiles = new ModuleFolderFiles(this.repository);
    this.rootAndDriverByFolderMap = new Map();
  }

  findApplicationStarts(language) {
    return this.graphReading.findApplicationStarts(language);
  }

  findModuleFinder(driver, folder) {
    return getOrJoinModuleFinder(driver.diffDriver, this.graphReading.findFrameworksAt(folder));
  }

  findLinesReferencing(name, receiver = null) {
    return this.graphReading.findReferencesNamed(name)
      .filter(reference => receiver === null || reference.receiver === receiver)
      .map(reference => ({ path: reference.path, line: reference.line, text: String(this.folderFiles.readFileLines(reference.path)[reference.line - 1] ?? "") }));
  }

  findModuleDriver(folder) {
    const hasAModuleForm = driver => Boolean(this.findModuleFinder(driver, folder).moduleRootForm);
    for (const file of this.folderFiles.listFiles(folder)) {
      const driver = findDriver(file.path);
      if (driver && hasAModuleForm(driver)) return driver;
    }
    for (const below of this.folderFiles.listFolders(folder)) {
      for (const file of this.folderFiles.listFiles(below.path)) {
        const driver = findDriver(file.path);
        if (driver && hasAModuleForm(driver)) return driver;
      }
    }
    return null;
  }

  readIdentity(folder) {
    if (!this.repository) return { root: "", rootForm: "", reason: NO_REPOSITORY_READ };
    const { root, rootForm, reason } = this.findRootAndDriver(folder);
    return { root, rootForm, reason };
  }

  findRootAndDriver(folder) {
    if (this.rootAndDriverByFolderMap.has(folder)) return this.rootAndDriverByFolderMap.get(folder);
    const found = this.readRootAndDriver(folder);
    this.rootAndDriverByFolderMap.set(folder, found);
    return found;
  }

  readRootAndDriver(folder) {
    const driver = this.findModuleDriver(folder);
    if (!driver) return { root: "", rootForm: "", reason: NO_MODULE_FORM_READ };
    const finder = this.findModuleFinder(driver, folder);
    const root = finder.findRoot(this, folder, driver);
    if (!root) return { root: "", rootForm: finder.moduleRootForm, reason: `not found as: ${finder.moduleRootForm}` };
    return { root, rootForm: finder.moduleRootForm, reason: "", driver };
  }

  buildReading(folder) {
    if (!this.repository) return { ...NO_READING, reason: NO_REPOSITORY_READ };
    const { root, rootForm, reason, driver } = this.findRootAndDriver(folder);
    if (!root) return { ...NO_READING, rootForm, reason };
    const { isRoot, applicationPackage, openings, exposed, boundaries } = this.findModuleFinder(driver, folder).findIn(folder, { reading: this, root, driver });
    const tree = this.buildTree(folder, exposed, openings);
    return {
      root,
      isRoot,
      rootForm,
      reason: "",
      exposed: exposed.map(exposedDeclaration => `${exposedDeclaration.path} · ${exposedDeclaration.head || exposedDeclaration.name}`),
      boundaries,
      tree: tree.lines,
      ...(tree.stopped ? { treeStopped: true } : {}),
      references: [],
      applicationPackage,
      modulePackage: applicationPackage ? `${applicationPackage}.${readFileName(root)}` : "",
    };
  }

  listCrossModuleReferenceLines(folder, readings, packages) {
    return readings.flatMap(({ file, driver }) => this.findCrossModuleImports(file, driver, folder, packages)
      .map(({ line, text }) => `${file.path}:${line}: ${text}`));
  }

  findCrossModuleImports(file, driver, folder, packages) {
    if (!driver) return [];
    const context = new FinderContext({ language: driver.diffDriver, frameworks: this.graphReading.findFrameworksAt(folder) });
    const { importLine } = getOrJoinModuleFinder(driver.diffDriver);
    return MODULE_FINDER_REGISTRY.findRelationFinders(context).flatMap(finder => finder.findCrossModuleImports(file.readNumberedLines(), importLine, packages));
  }

  buildTree(top, exposed, openings) {
    const openingByFolderMap = new Map(openings.map(opening => [opening.folder, opening]));
    const exposedNamesByPathMap = new Map();
    for (const exposedDeclaration of exposed) exposedNamesByPathMap.set(exposedDeclaration.path, [...(exposedNamesByPathMap.get(exposedDeclaration.path) || []), exposedDeclaration.head || exposedDeclaration.name]);
    const lines = [];
    let stopped = false;
    const listFolder = folder => {
      for (const child of this.folderFiles.listChildren(folder)) {
        if (lines.length >= MAX_TREE_LINES) {
          stopped = true;
          return;
        }
        if (!child.isFolder) {
          const names = exposedNamesByPathMap.get(child.path);
          lines.push(names ? `${child.path} · exposes ${names.join(", ")}` : child.path);
          continue;
        }
        const named = openingByFolderMap.get(child.path);
        lines.push(named ? `${child.path}/ · opened as a named interface ${named.name}` : `${child.path}/`);
      }
    };
    listFolder(top);
    for (const below of this.folderFiles.listFolders(top)) {
      if (lines.length >= MAX_TREE_LINES) {
        stopped = true;
        break;
      }
      listFolder(below.path);
    }
    return { lines, stopped };
  }
}
