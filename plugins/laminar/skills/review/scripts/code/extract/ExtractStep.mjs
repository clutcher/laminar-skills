import { AbstractionTree, formatDisplayName, VISIBILITIES, readVisibilityOfDeclaration } from "./tree/AbstractionTree.mjs";
import { doesSpanHoldLine } from "../graph/abstractions/Place.mjs";
import { Scale } from "../graph/abstractions/Scale.mjs";
import { findRepositoryToRead } from "../inputs/change/ChangeReader.mjs";
import { FILE_STATUS } from "../inputs/change/Hunk.mjs";
import { RepositoryText } from "../inputs/repository/RepositoryText.mjs";
import { CachedSourceIndex } from "../inputs/repository/index/CachedSourceIndex.mjs";
import { CHANGE_KINDS, readChangeKindFromEvents, readDeclaredMemberChangeKind, readFileChangeKind } from "../inputs/change/AbstractionChange.mjs";
import { readBoundaryRank } from "./tree/BoundaryRank.mjs";
import { BOUNDARY_RANKS } from "../graph/abstractions/Role.mjs";
import { ChangeMarker } from "../inputs/change/ChangeMarker.mjs";

import { findDriver, readLanguageFamily } from "../inputs/source/drivers/LanguageRegistry.mjs";
import { countBranches, measureMethod } from "./abstractions/method/generic/measures/MethodMeasures.mjs";
import { measureClass } from "./abstractions/class/generic/measures/ClassMeasures.mjs";
import { measureVariable } from "./abstractions/variable/generic/measures/VariableMeasures.mjs";
import { holdsCode } from "../inputs/source/SourceText.mjs";
import { ModuleShapes } from "./abstractions/module/generic/shapes/ModuleShapes.mjs";
import { ModuleBoundaries, ShapeFacts } from "./abstractions/module/generic/shapes/ShapeFacts.mjs";
import { namesALiteral } from "./abstractions/variable/generic/values/DeclaredValues.mjs";
import { ModuleReading } from "./abstractions/module/generic/reading/ModuleReading.mjs";
import { MODULE_FINDER_REGISTRY } from "./abstractions/module/index.mjs";
import { readReferenceFormsOf } from "./abstractions/module/generic/reading/SourceFile.mjs";
import { readFileName, readFolderPath } from "../../files/paths.mjs";
import { readApplicationName, findDeployableFolder } from "./abstractions/application/generic/ApplicationFolders.mjs";
import { findDeployableRoots } from "./abstractions/application/ApplicationDiscovery.mjs";
import { CreatedFolders } from "../inputs/change/CreatedFolders.mjs";
import { readDependencies } from "./abstractions/application/generic/dependencies/RepositoryDependencies.mjs";
import { isABuildFile } from "./abstractions/application/index.mjs";
import { ApplicationFrameworks } from "./abstractions/application/generic/frameworks/ApplicationFrameworks.mjs";
import { groupMemberItems } from "./abstractions/variable/generic/fields/FieldItems.mjs";
import { CallGraphs } from "./calls/CallGraphs.mjs";
import { RepositoryWalk } from "./walk/RepositoryWalk.mjs";
import { AbstractionWalker } from "./walk/AbstractionWalker.mjs";
import { CodeGraph } from "../graph/CodeGraph.mjs";
import { ModuleOpenings } from "./abstractions/module/generic/published/ModuleOpenings.mjs";
import { CommentPlacement } from "./tree/CommentPlacement.mjs";
import { TestRecognition } from "./tree/TestRecognition.mjs";
import { AbstractionFacts, INTERACTION_LINES } from "./tree/AbstractionFacts.mjs";

const BOUNDARY_MOVING_FILE_STATUS = new Set([FILE_STATUS.CREATED, FILE_STATUS.REMOVED, FILE_STATUS.RENAMED]);

const NO_FILES_OF_ITS_OWN = Object.freeze({ statuses: new Set(), readings: [] });

const NOTHING_OF_ITS_OWN_CHANGED = new Set([CHANGE_KINDS.INTERNALS_CHANGED, CHANGE_KINDS.REFERENCE]);

const searchesItsOwnDecisions = abstraction =>
  abstraction.scale === Scale.METHOD.name
  || (abstraction.scale === Scale.CLASS.name && !NOTHING_OF_ITS_OWN_CHANGED.has(abstraction.changeKind));

const isTheFilesOwnType = (reading, tag) => !tag.scope && tag.name === reading.typeName;

const findMethodHolding = (classAbstraction, uses) => {
  for (const { line } of uses) {
    const method = classAbstraction.children.find(child => child.scale === Scale.METHOD.name && doesSpanHoldLine(child.lines, line));
    if (method) return method.displayName;
  }
  return "";
};

const mayHoldRecordedConstants = abstraction => abstraction.scale === Scale.VARIABLE.name && !abstraction.isTest;

const joinSpans = spans => ({ from: Math.min(...spans.map(span => span.from)), to: Math.max(...spans.map(span => span.to)) });

const mapSpanToPair = span => [span.from, span.to];

const readScaleOfMembers = members => (members[0].tag.scale === Scale.METHOD.name ? Scale.METHOD.name : Scale.VARIABLE.name);

const measureExtentOfFields = fields => (fields.length === 1 ? { lines: fields[0].lines } : { lines: joinSpans(fields.map(field => field.lines)), fields });

export const holdsChangedCode = changedSpan => holdsCode(changedSpan.lines) || Boolean(changedSpan.removedCode);

const holdsOnlyCreatedSubfolders = (module, createdSubfolders) => createdSubfolders.length > 0 && module.readings.length === 0;

const holdsOnlyAnOpening = (module, createdSubfolders, openedFolders) => module.readings.length === 0 && createdSubfolders.length === 0 && openedFolders.has(module.folder);

const markTheTypeBoundaryChanged = typeAbstraction => {
  if (typeAbstraction.changeKind !== CHANGE_KINDS.CREATED) typeAbstraction.changeKind = CHANGE_KINDS.BOUNDARY_CHANGED;
};

const findMemberTypeNamed = (classAbstraction, name) => classAbstraction.children.find(child => child.scale === Scale.CLASS.name && child.name === name);

const buildFieldsOfTheMembers = (members, enclosingTypeName, reading) => members.map(({ tag, changedSpan }) => ({
  name: tag.name,
  displayName: formatDisplayName(Scale.VARIABLE.name, tag.name, enclosingTypeName),
  lines: reading.readSpan(tag),
  changedLines: { from: changedSpan.from, to: changedSpan.to },
}));

const chooseVisibilityOfTheMembers = members => (members.some(member => member.isExposed) ? VISIBILITIES.EXPOSED : VISIBILITIES.PRIVATE);

const clampWithinLines = (changedSpan, enclosingType) => (enclosingType
  ? { from: Math.max(changedSpan.from, enclosingType.from), to: Math.min(changedSpan.to, enclosingType.to) }
  : { from: changedSpan.from, to: changedSpan.to });

const cannotLocateTheHead = (child, enclosing) => !enclosing.tag || !child.lines;

const holdsTheHeadOf = (child, enclosing) => doesSpanHoldLine(child.lines, enclosing.tag.line);

const isTheEnclosingMethod = (child, enclosing) => child.scale === Scale.METHOD.name
  && child.name === enclosing.name
  && (cannotLocateTheHead(child, enclosing) || holdsTheHeadOf(child, enclosing));

const findDriverOfASourceFile = filePath => (isABuildFile(filePath) ? null : findDriver(filePath));

export const LEFT_OUT_REASONS = Object.freeze({ BUILD_FILE: "build file", NO_LANGUAGE_DRIVER: "no language driver", PROSE: "prose", TRIVIAL: "trivial", OUTSIDE_EVERY_TYPE: "outside every type" });

const NOT_PARSED_NOTE_BY_LEFT_OUT_REASON_MAP = new Map([
  [LEFT_OUT_REASONS.BUILD_FILE, "the file is a build file, so it holds no abstraction"],
  [LEFT_OUT_REASONS.NO_LANGUAGE_DRIVER, "no language driver reads this extension, so the file holds no abstraction"],
  [LEFT_OUT_REASONS.PROSE, "the file holds prose, so it holds no abstraction"],
]);

const findWhyTheFileIsLeftOut = ({ file, driver, reading }) => {
  if (isABuildFile(file.path)) return LEFT_OUT_REASONS.BUILD_FILE;
  if (!reading) return LEFT_OUT_REASONS.NO_LANGUAGE_DRIVER;
  if (driver.holdsProse) return LEFT_OUT_REASONS.PROSE;
  return null;
};

const countLeftOutFiles = (leftOutFiles, reason) => leftOutFiles.filter(leftOutFile => leftOutFile.reason === reason).length;

const holdsChangedCodeOutsideEveryType = reading => reading.members.length > 0 || reading.changedBodySpans.some(holdsChangedCode);

const groupTheReadingsByFolder = readings => {
  const modulesByFolderMap = new Map();
  for (const changedFileReading of readings) {
    const folder = readFolderPath(changedFileReading.file.path);
    if (!modulesByFolderMap.has(folder)) modulesByFolderMap.set(folder, { folder, statuses: new Set(), files: 0, readings: [] });
    const module = modulesByFolderMap.get(folder);
    module.statuses.add(changedFileReading.file.status);
    module.files++;
    module.readings.push(changedFileReading);
  }
  return modulesByFolderMap;
};

const holdsOnlyBuildFiles = module => module.readings.every(changedFileReading => isABuildFile(changedFileReading.file.path));

const leaveOutTheFoldersOfBuildFilesOnly = changedFolders => new Map([...changedFolders].filter(([, module]) => !holdsOnlyBuildFiles(module)));

export class ExtractStep {
  constructor(change, { indexCacheFolder } = {}) {
    this.change = change;
    this.tree = new AbstractionTree();
    this.cachedSourceIndex = new CachedSourceIndex(change.repository, { cacheFolder: indexCacheFolder });
    this.repositoryText = new RepositoryText(change.repository, change.mode, change.files, { cachedSourceIndex: this.cachedSourceIndex });
    this.createdFolders = CreatedFolders.createFromChange(change);
    this.decisionSearches = [];
    this.literalConstants = [];
    this.droppedAsTrivial = 0;
    this.trivialHunks = 0;
    this.notParsed = [];
    this.droppedFiles = [];
    this.leftOutFiles = [];
    this.addedLinesByPathMap = change.readAddedLinesByPath();
  }

  get buildFiles() {
    return countLeftOutFiles(this.leftOutFiles, LEFT_OUT_REASONS.BUILD_FILE);
  }

  get noLanguageDriver() {
    return countLeftOutFiles(this.leftOutFiles, LEFT_OUT_REASONS.NO_LANGUAGE_DRIVER);
  }

  run() {
    this.roots = findDeployableRoots(findRepositoryToRead(this.change));
    this.dependencies = readDependencies(this.change);
    this.applications = new ApplicationFrameworks(this.roots, this.dependencies.files);
    const families = this.listFamiliesOfTheRepository();
    this.walk = new RepositoryWalk(this.change, this.cachedSourceIndex, this.applications).run(families);
    this.testRecognition = new TestRecognition({ change: this.change, walk: this.walk, applications: this.applications });
    this.abstractionFacts = new AbstractionFacts({ walk: this.walk, addedLinesByPathMap: this.addedLinesByPathMap });
    this.callGraphs = new CallGraphs(this.repositoryText, this.change, this.walk, this.cachedSourceIndex).readEvery(families);
    this.importsOf = this.buildImportsOfTheWalkedFiles();
    this.shapes = this.readTheModuleShapes();
    this.walker = new AbstractionWalker(new CodeGraph(), { roots: this.roots, applications: this.applications, shapes: this.shapes }).walk(this.walk.listEveryFile());
    this.moduleReading = this.readTheModules();
    this.moduleOpenings = new ModuleOpenings({ change: this.change, walkedPaths: this.listWalkedPaths(), walker: this.walker, shapes: this.shapes, moduleReading: this.moduleReading, repositoryText: this.repositoryText, applications: this.applications });
    this.publishedSets = this.moduleOpenings.readThePublishedSets();
    this.moduleOpenings.giveTheOpeningRoles(this.publishedSets);
    this.shapeFacts = this.readTheShapeFacts();
    const readings = this.readTheChangedFiles();
    this.countTheTrivialHunks(readings);
    const changedFolders = groupTheReadingsByFolder(readings);
    const modules = leaveOutTheFoldersOfBuildFilesOnly(changedFolders);
    this.recordTheModuleFolders(modules);
    const parents = this.addTheModules(changedFolders, modules);
    for (const changedFileReading of readings) this.addFile(changedFileReading, parents);
    new CommentPlacement({ tree: this.tree, addedLinesByPathMap: this.addedLinesByPathMap, createMemberAbstraction: fields => this.createMemberAbstraction(fields), readBoundaryRankAtLine: (filePath, visibility, line) => this.readBoundaryRankAtLine(filePath, visibility, line) }).placeTheComments(readings, parents);
    this.leaveOutTheDroppedFilesWithNoAbstraction();
    return this.tree;
  }

  buildImportsOfTheWalkedFiles() {
    const importsByPathMap = new Map(this.callGraphs.listEveryCallGraph().flatMap(callGraph => (callGraph.files || []).map(file => [file.path, file.imports || []])));
    return filePath => importsByPathMap.get(filePath) || [];
  }

  listWalkedPaths() {
    return this.walk.listEveryFile().map(file => file.path);
  }

  readTheModules() {
    return new ModuleReading(findRepositoryToRead(this.change), {
      findReferencesNamed: name => this.walk.findReferencesNamed(name),
      findApplicationStarts: language => this.walk.findApplicationStarts(language),
      findFrameworksAt: folder => this.applications.listFrameworkNamesAt(folder),
    }, this.shapes);
  }

  readTheShapeFacts() {
    const paths = this.listWalkedPaths();
    const moduleBoundaries = new ModuleBoundaries({ shapes: this.shapes, moduleReading: this.moduleReading, publishedSets: this.publishedSets, importsOf: this.importsOf, paths });
    return new ShapeFacts({
      shapes: this.shapes,
      moduleBoundaries,
      importsOf: this.importsOf,
      types: this.callGraphs.listEveryCallGraph().flatMap(callGraph => callGraph.types || []),
      readFileLines: filePath => this.repositoryText.readFileLines(filePath),
      paths,
    });
  }

  readTheModuleShapes() {
    return ModuleShapes.findShapes(MODULE_FINDER_REGISTRY.shapeFinders, this.listWalkedPaths(), this.importsOf);
  }

  readBoundaryRankInFolder(folder, visibility, roles) {
    return readBoundaryRank(roles, this.walker.findOrAddTheModule(folder).roles, visibility);
  }

  readBoundaryRankAtLine(filePath, visibility, line) {
    return this.readBoundaryRankInFolder(readFolderPath(filePath), visibility, this.walk.findRolesAt(filePath, line));
  }

  readBoundaryRankOfEnclosing(filePath, enclosing) {
    return enclosing.tag ? this.readBoundaryRankAtLine(filePath, VISIBILITIES.EXPOSED, enclosing.tag.line) : this.readBoundaryRankInFolder(readFolderPath(filePath), VISIBILITIES.EXPOSED, []);
  }

  readTheChangedFiles() {
    const readings = this.change.files
      .map(file => ({ file, driver: findDriverOfASourceFile(file.path), reading: null }))
      .map(changedFileReading => ({ ...changedFileReading, reading: changedFileReading.driver ? this.createMarker(changedFileReading.file, changedFileReading.driver) : null }));
    return readings;
  }

  countTheTrivialHunks(readings) {
    for (const changedFileReading of readings) this.trivialHunks += changedFileReading.reading ? changedFileReading.reading.trivialHunkCount : 0;
  }

  createMarker(file, driver) {
    return new ChangeMarker(file, driver, readApplicationName(file.path, this.roots), this.walk.findDeclarationsAt(file.path));
  }

  listFamiliesOfTheRepository() {
    const ofTheChange = this.change.files.map(file => readLanguageFamily(file.path)).filter(Boolean);
    return [...new Set([...this.repositoryText.listFamilies(), ...ofTheChange])];
  }

  recordTheModuleFolders(modules) {
    const foldersWithReadings = new Set(modules.keys());
    this.createdSubfoldersByJoinedFolderMap = this.createdFolders.readCreatedSubfoldersByJoinedFolder(foldersWithReadings);
    this.pathEndFoldersReadAlone = this.createdFolders.findPathEndsReadAlone(foldersWithReadings);
    this.openedByTheChange = this.moduleOpenings.collectFoldersOpenedByTheChange();
    this.moduleFolders = new Set([...modules.keys(), ...this.pathEndFoldersReadAlone, ...this.createdSubfoldersByJoinedFolderMap.keys(), ...this.openedByTheChange]);
  }

  addTheModules(changedFolders, modules) {
    const systemsByFolderMap = new Map();
    const parentsByFolderMap = new Map();
    for (const folder of changedFolders.keys()) {
      if (modules.has(folder)) parentsByFolderMap.set(folder, this.addModule(modules.get(folder), systemsByFolderMap));
      else this.findOrAddSystemHolding(folder, systemsByFolderMap);
    }
    for (const folder of this.pathEndFoldersReadAlone) {
      this.addModule({ ...NO_FILES_OF_ITS_OWN, folder }, systemsByFolderMap);
    }
    const foldersWithAModule = new Set([...modules.keys(), ...this.pathEndFoldersReadAlone]);
    for (const folder of [...this.createdSubfoldersByJoinedFolderMap.keys(), ...this.openedByTheChange]) {
      if (foldersWithAModule.has(folder)) continue;
      foldersWithAModule.add(folder);
      this.addModule({ ...NO_FILES_OF_ITS_OWN, folder }, systemsByFolderMap);
    }
    return parentsByFolderMap;
  }

  addModule(module, systems) {
    const parent = this.findOrAddSystemHolding(module.folder, systems);
    const moduleAbstraction = this.tree.create({
      scale: Scale.MODULE.name,
      name: module.folder,
      path: module.folder,
      changeKind: this.readModuleChangeKind(module),
      visibility: VISIBILITIES.EXPOSED,
      boundaryRank: this.readBoundaryRankInFolder(module.folder, VISIBILITIES.EXPOSED, []),
      lines: null,
    });
    moduleAbstraction.module = this.buildModuleReading(module);
    return parent ? parent.add(moduleAbstraction) : this.tree.addRoot(moduleAbstraction);
  }

  findOrAddSystemHolding(folder, systems) {
    const deployable = findDeployableFolder(folder, this.roots);
    if (deployable === null) return null;
    if (!systems.has(deployable)) {
      systems.set(deployable, this.tree.addRoot(this.tree.create({
        scale: Scale.APPLICATION.name,
        name: readFileName(deployable) || ".",
        path: deployable,
        changeKind: CHANGE_KINDS.INTERNALS_CHANGED,
        visibility: VISIBILITIES.EXPOSED,
        boundaryRank: BOUNDARY_RANKS.SYSTEM_BOUNDARY,
        lines: null,
      })));
    }
    return systems.get(deployable);
  }

  readModuleChangeKind(module) {
    if (this.createdFolders.isCreated(module.folder)) return CHANGE_KINDS.CREATED;
    if (this.createdSubfoldersByJoinedFolderMap.has(module.folder) || this.openedByTheChange.has(module.folder)) return CHANGE_KINDS.BOUNDARY_CHANGED;
    return [...module.statuses].some(status => BOUNDARY_MOVING_FILE_STATUS.has(status))
      ? CHANGE_KINDS.BOUNDARY_CHANGED : CHANGE_KINDS.INTERNALS_CHANGED;
  }

  buildModuleReading(module) {
    const read = this.moduleReading.buildReading(module.folder);
    const references = this.moduleReading.listCrossModuleReferenceLines(module.folder, module.readings, read);
    const createdSubfolders = this.createdSubfoldersByJoinedFolderMap.get(module.folder) || [];
    const onlyCreatedSubfoldersFact = holdsOnlyCreatedSubfolders(module, createdSubfolders) ? { holdsOnlyCreatedSubfolders: true } : {};
    const onlyAnOpeningFact = holdsOnlyAnOpening(module, createdSubfolders, this.openedByTheChange) ? { holdsOnlyAnOpening: true } : {};
    const moduleShapeFacts = this.shapeFacts.readTheFactsOfTheFolder(module.folder, folder => this.moduleFolders.has(folder));
    return { ...read, references, joinsAFolder: this.createdFolders.joinsAFolder(module.folder), createdSubfolders, ...onlyCreatedSubfoldersFact, ...onlyAnOpeningFact, ...moduleShapeFacts };
  }

  dropAsTrivial(file, reason = LEFT_OUT_REASONS.TRIVIAL) {
    this.droppedAsTrivial++;
    this.droppedFiles.push({ path: file.path, reason });
  }

  dropTheFileWithNoChangedType(file, reading) {
    this.dropAsTrivial(file, holdsChangedCodeOutsideEveryType(reading) ? LEFT_OUT_REASONS.OUTSIDE_EVERY_TYPE : LEFT_OUT_REASONS.TRIVIAL);
  }

  leaveOutTheDroppedFilesWithNoAbstraction() {
    const pathsWithAnAbstraction = new Set(this.tree.listEveryAbstraction().map(abstraction => abstraction.path));
    this.leftOutFiles.push(...this.droppedFiles.filter(droppedFile => !pathsWithAnAbstraction.has(droppedFile.path)));
  }

  leaveOut(file, reason) {
    this.leftOutFiles.push({ path: file.path, reason });
    this.notParsed.push(`${file.path}: ${NOT_PARSED_NOTE_BY_LEFT_OUT_REASON_MAP.get(reason)}`);
  }

  addFile(changedFileReading, parents) {
    const leftOutReason = findWhyTheFileIsLeftOut(changedFileReading);
    if (leftOutReason) { this.leaveOut(changedFileReading.file, leftOutReason); return; }
    const { file, driver, reading } = changedFileReading;
    if (driver.fileHoldsTypesOnly && file.existsAfterTheChange) { this.addTypesOfFile({ file, driver, reading }, parents); return; }
    const kind = readFileChangeKind(file) || readChangeKindFromEvents(reading.events);
    if (!kind) { this.dropAsTrivial(file); return; }
    const parent = parents.get(readFolderPath(file.path));
    const { tag: typeTag, span, bodyLines } = reading.readTheFilesOwnTypeAndSpan();
    const classAbstraction = parent.add(this.tree.create({
      scale: Scale.CLASS.name,
      name: reading.typeName,
      path: file.path,
      changeKind: kind,
      visibility: VISIBILITIES.EXPOSED,
      boundaryRank: this.readBoundaryRankAtLine(file.path, VISIBILITIES.EXPOSED, typeTag ? typeTag.line : null),
      lines: span,
    }));
    classAbstraction.measures = measureClass(bodyLines, reading.tags.filter(tag => tag.scale === Scale.METHOD.name).length);
    classAbstraction.facts = AbstractionFacts.createNone();
    this.rememberSearch(classAbstraction, file, reading.createdTypes.flatMap(createdType => createdType.changedSpan.lines));
    for (const { tag, changedSpan } of reading.createdTypes) {
      if (isTheFilesOwnType(reading, tag)) continue;
      const typeAbstraction = this.addCreatedType(classAbstraction, file, driver, reading, tag, changedSpan);
      this.rememberSearch(typeAbstraction, file, changedSpan.lines);
      this.addLocals(typeAbstraction, file, driver, changedSpan);
    }
    for (const item of groupMemberItems(reading.members, { findEnclosingType: member => member.tag.scope || "", diffDriver: driver.diffDriver })) {
      this.recordTheMember(classAbstraction, file, driver, reading, item);
    }
    for (const changedSpan of reading.changedBodySpans) this.addChangedBodySpan(classAbstraction, file, driver, reading, changedSpan);
    for (const form of readReferenceFormsOf(file, driver)) this.addReferenceForm(classAbstraction, file, form);
  }

  addTypesOfFile({ file, driver, reading }, parents) {
    const moduleAbstraction = parents.get(readFolderPath(file.path));
    const addedTypesByEnclosingTypeMap = new Map();
    const getOrAddTypeAbstraction = (enclosingType, changeKind) => {
      const key = enclosingType.line || enclosingType.text;
      if (!addedTypesByEnclosingTypeMap.has(key)) addedTypesByEnclosingTypeMap.set(key, { abstraction: this.addTypeOfFile(moduleAbstraction, file, driver, reading, enclosingType, changeKind), addedLines: [] });
      return addedTypesByEnclosingTypeMap.get(key);
    };
    for (const { tag, changedSpan, reborn } of reading.createdTypes) {
      const enclosingType = { name: tag.name, text: tag.text, line: tag.line, lines: reading.readSpan(tag) };
      getOrAddTypeAbstraction(enclosingType, readDeclaredMemberChangeKind(reborn)).addedLines.push(...changedSpan.lines);
    }
    const placedMembers = this.placeTheMembersInTheirTypes(file, reading, getOrAddTypeAbstraction);
    this.addTheMembersOfTheTypes(file, driver, reading, placedMembers);
    for (const changedSpan of reading.changedBodySpans) {
      if (!holdsChangedCode(changedSpan)) continue;
      const enclosingType = reading.findTypeHoldingTheLine(changedSpan.from, changedSpan.context);
      if (!enclosingType) { this.notParsed.push(`${file.path} at line ${changedSpan.from}: no type holds the changed lines, so they have no abstraction`); continue; }
      getOrAddTypeAbstraction(enclosingType, CHANGE_KINDS.BOUNDARY_CHANGED).addedLines.push(...changedSpan.lines);
    }
    if (!addedTypesByEnclosingTypeMap.size) this.dropTheFileWithNoChangedType(file, reading);
    for (const { abstraction, addedLines } of addedTypesByEnclosingTypeMap.values()) this.rememberSearch(abstraction, file, addedLines);
  }

  placeTheMembersInTheirTypes(file, reading, getOrAddTypeAbstraction) {
    const placedMembers = [];
    for (const member of reading.members) {
      const enclosingType = reading.findTypeHoldingTheLine(member.tag.line, member.changedSpan.context);
      if (!enclosingType) { this.notParsed.push(`${file.path} at line ${member.tag.line}: no type holds the field \`${member.tag.name}\`, so the field has no abstraction`); continue; }
      const typeAbstraction = getOrAddTypeAbstraction(enclosingType, CHANGE_KINDS.BOUNDARY_CHANGED);
      typeAbstraction.addedLines.push(...member.changedSpan.lines);
      placedMembers.push({ member, typeAbstraction });
    }
    return placedMembers;
  }

  addTheMembersOfTheTypes(file, driver, reading, placedMembers) {
    for (const item of groupMemberItems(placedMembers, { readMember: placedMember => placedMember.member, findEnclosingType: placedMember => placedMember.typeAbstraction, diffDriver: driver.diffDriver })) {
      const typeAbstraction = item[0].typeAbstraction.abstraction;
      this.recordTheMember(typeAbstraction, file, driver, reading, item.map(placedMember => placedMember.member), typeAbstraction.displayName);
    }
  }

  addTypeOfFile(moduleAbstraction, file, driver, reading, enclosingType, changeKind) {
    const bodyLines = enclosingType.lines ? reading.readLinesOfSpan(enclosingType.lines) : [];
    const abstraction = moduleAbstraction.add(this.createMemberAbstraction({
      scale: Scale.CLASS.name,
      name: enclosingType.name,
      displayName: driver.findTypeDisplayName(enclosingType.text, enclosingType.name, reading.application),
      path: file.path,
      changeKind,
      visibility: VISIBILITIES.EXPOSED,
      boundaryRank: this.readBoundaryRankAtLine(file.path, VISIBILITIES.EXPOSED, enclosingType.line || null),
      lines: enclosingType.lines,
    }));
    abstraction.measures = measureClass(bodyLines, 0);
    abstraction.facts = this.abstractionFacts.build(abstraction, bodyLines, enclosingType.lines, INTERACTION_LINES.ANY);
    return abstraction;
  }

  addReferenceForm(classAbstraction, file, form) {
    const lines = form.lines.map(({ line }) => line);
    classAbstraction.add(this.createMemberAbstraction({
      scale: Scale.CLASS.name,
      name: form.bare,
      enclosingTypeName: form.enclosing,
      path: file.path,
      changeKind: CHANGE_KINDS.REFERENCE,
      visibility: VISIBILITIES.EXPOSED,
      boundaryRank: classAbstraction.boundaryRank,
      lines: { from: Math.min(...lines), to: Math.max(...lines) },
      referenceLines: form.lines.map(({ line, text }) => `${line}: ${text}`),
      usedIn: findMethodHolding(classAbstraction, form.lines.slice(1)),
    })).measures = { stepCount: 0, ...countBranches(form.lines.map(({ text }) => text)) };
  }

  addCreatedType(classAbstraction, file, driver, reading, tag, changedSpan) {
    const span = reading.readSpan(tag);
    const abstraction = classAbstraction.add(this.createMemberAbstraction({
      scale: Scale.CLASS.name,
      name: tag.name,
      enclosingTypeName: tag.scope,
      path: file.path,
      changeKind: CHANGE_KINDS.CREATED,
      visibility: readVisibilityOfDeclaration(driver, tag),
      boundaryRank: this.readBoundaryRankAtLine(file.path, VISIBILITIES.EXPOSED, tag.line),
      lines: span,
    }));
    abstraction.measures = measureClass(changedSpan.lines, 0);
    abstraction.facts = this.abstractionFacts.build(abstraction, changedSpan.lines, changedSpan);
    return abstraction;
  }

  addMember(parentAbstraction, file, driver, reading, members, enclosingTypeName = reading.chooseEnclosingTypeName(members[0].tag.scope, members[0].tag.line)) {
    const fields = buildFieldsOfTheMembers(members, enclosingTypeName, reading);
    const changedSpans = members.map(({ changedSpan }) => changedSpan);
    const changedLines = changedSpans.flatMap(changedSpan => changedSpan.lines);
    const scale = readScaleOfMembers(members);
    const visibility = chooseVisibilityOfTheMembers(members);
    const abstraction = parentAbstraction.add(this.createMemberAbstraction({
      scale,
      name: fields.map(field => field.name).join(", "),
      enclosingTypeName,
      path: file.path,
      changeKind: readDeclaredMemberChangeKind(members.some(member => member.reborn)),
      visibility,
      boundaryRank: this.readBoundaryRankAtLine(file.path, visibility, members[0].tag.line),
      ...measureExtentOfFields(fields),
      headLine: members[0].tag.line,
    }));
    abstraction.measures = scale === Scale.METHOD.name ? measureMethod(changedLines) : measureVariable(...members.map(({ tag }) => tag.text));
    abstraction.facts = this.abstractionFacts.build(abstraction, changedLines, joinSpans(changedSpans));
    abstraction.changedLines = joinSpans(fields.map(field => field.changedLines));
    return abstraction;
  }

  recordTheMember(parentAbstraction, file, driver, reading, members, enclosingTypeName) {
    const abstraction = this.addMember(parentAbstraction, file, driver, reading, members, enclosingTypeName);
    this.rememberSearch(abstraction, file, members.flatMap(({ changedSpan }) => changedSpan.lines));
    if (abstraction.scale === Scale.METHOD.name) this.addLocals(abstraction, file, driver, members[0].changedSpan);
    this.recordLiteralConstants(abstraction, reading, members);
  }

  recordLiteralConstants(abstraction, reading, members) {
    if (!mayHoldRecordedConstants(abstraction)) return;
    const constants = members
      .filter(({ tag }) => namesALiteral(tag.text))
      .map(({ tag, changedSpan }) => ({ name: tag.name, spans: [mapSpanToPair(reading.readSpan(tag)), mapSpanToPair(changedSpan)] }));
    if (constants.length) this.literalConstants.push({ abstraction, constants });
  }

  noteTheMissingEnclosingDeclaration(file, changedSpan) {
    this.notParsed.push(`${file.path} at line ${changedSpan.from}: the hunk header names no enclosing declaration, so the method whose body changed has no abstraction and its local variables are not listed`);
  }

  addChangedBodySpan(classAbstraction, file, driver, reading, changedSpan) {
    if (!holdsChangedCode(changedSpan)) return;
    const enclosing = reading.findEnclosingDeclaration(changedSpan);
    if (!enclosing) { this.noteTheMissingEnclosingDeclaration(file, changedSpan); return; }
    if (enclosing.scale === Scale.CLASS.name) { this.markOrAddTheChangedType(classAbstraction, file, reading, enclosing); return; }
    const filedEnclosingMethod = classAbstraction.children.find(child => isTheEnclosingMethod(child, enclosing));
    if (filedEnclosingMethod) { this.addLocals(filedEnclosingMethod, file, driver, changedSpan); return; }
    const enclosingMethod = this.addTheEnclosingMethod(classAbstraction, file, driver, reading, changedSpan, enclosing);
    this.rememberSearch(enclosingMethod, file, changedSpan.lines);
    this.addLocals(enclosingMethod, file, driver, changedSpan);
  }

  addTheEnclosingMethod(classAbstraction, file, driver, reading, changedSpan, enclosing) {
    const span = enclosing.tag ? reading.readSpan(enclosing.tag) : { from: changedSpan.from, to: changedSpan.to };
    const abstraction = classAbstraction.add(this.createMemberAbstraction({
      scale: Scale.METHOD.name,
      name: enclosing.name,
      enclosingTypeName: reading.chooseEnclosingTypeName(enclosing.scope, enclosing.tag ? enclosing.tag.line : null),
      path: file.path,
      changeKind: CHANGE_KINDS.INTERNALS_CHANGED,
      visibility: enclosing.tag ? readVisibilityOfDeclaration(driver, enclosing.tag, enclosing.name) : VISIBILITIES.EXPOSED,
      boundaryRank: this.readBoundaryRankOfEnclosing(file.path, enclosing),
      lines: span,
      headLine: enclosing.tag ? enclosing.tag.line : null,
    }));
    const body = enclosing.tag ? reading.readLinesOfSpan(span) : changedSpan.lines;
    abstraction.measures = measureMethod(body.length ? body : changedSpan.lines);
    abstraction.facts = this.abstractionFacts.build(abstraction, changedSpan.lines, changedSpan);
    abstraction.changedLines = { from: changedSpan.from, to: changedSpan.to };
    return abstraction;
  }

  markOrAddTheChangedType(classAbstraction, file, reading, enclosing) {
    if (enclosing.name === classAbstraction.name) { markTheTypeBoundaryChanged(classAbstraction); return; }
    const filedMemberType = findMemberTypeNamed(classAbstraction, enclosing.name);
    if (filedMemberType) { markTheTypeBoundaryChanged(filedMemberType); return; }
    this.addMemberOfType(classAbstraction, file, reading, enclosing);
  }

  addMemberOfType(classAbstraction, file, reading, enclosing) {
    const abstraction = classAbstraction.add(this.createMemberAbstraction({
      scale: Scale.CLASS.name,
      name: enclosing.name,
      enclosingTypeName: enclosing.scope,
      path: file.path,
      changeKind: CHANGE_KINDS.BOUNDARY_CHANGED,
      visibility: VISIBILITIES.EXPOSED,
      boundaryRank: this.readBoundaryRankOfEnclosing(file.path, enclosing),
      lines: enclosing.tag ? reading.readSpan(enclosing.tag) : null,
    }));
    abstraction.measures = measureClass(enclosing.tag ? reading.readLinesOfSpan(reading.readSpan(enclosing.tag)) : [], 0);
    abstraction.facts = this.abstractionFacts.build(abstraction, []);
  }

  createMemberAbstraction(fields) {
    const abstraction = this.tree.create({ ...fields, isTest: this.testRecognition.isTestCode(fields.path, fields.lines) });
    if (abstraction.isTest && abstraction.scale === Scale.METHOD.name) abstraction.testKind = this.testRecognition.readTestKind(abstraction, fields.headLine ?? null);
    return abstraction;
  }

  addLocals(methodAbstraction, file, driver, changedSpan) {
    for (const name of driver.findLocalVariables(changedSpan.lines)) {
      if (methodAbstraction.children.some(child => child.name === name)) continue;
      const declaration = changedSpan.lines.find(line => new RegExp(`\\b${name}\\b`).test(line)) || "";
      const local = this.addLocal(methodAbstraction, file, changedSpan, name, declaration);
      this.rememberSearch(local, file, [declaration]);
    }
  }

  addLocal(methodAbstraction, file, changedSpan, name, declaration) {
    const abstraction = methodAbstraction.add(this.createMemberAbstraction({
      scale: Scale.VARIABLE.name,
      name,
      enclosingTypeName: methodAbstraction.displayName,
      path: file.path,
      changeKind: CHANGE_KINDS.CREATED,
      visibility: VISIBILITIES.PRIVATE,
      boundaryRank: methodAbstraction.boundaryRank,
      lines: clampWithinLines(changedSpan, methodAbstraction.lines),
    }));
    abstraction.measures = measureVariable(declaration);
    abstraction.facts = this.abstractionFacts.build(abstraction, [declaration]);
    abstraction.changedLines = { from: changedSpan.from, to: changedSpan.to };
    return abstraction;
  }

  rememberSearch(abstraction, file, addedLines) {
    if (!addedLines.length || !searchesItsOwnDecisions(abstraction)) return;
    this.decisionSearches.push({ abstraction, path: file.path, addedLines });
  }
}
