import { BOUNDARY_RANKS, CHANGE_KINDS, CHANGE_MODES, CreatedFolders, FILE_STATUS, findDeployableRoots, isTestPath, ModuleReading, PUBLIC_CHANGE_KINDS, PUBLIC_METHOD_VISIBILITY, readBasePaths, readBoundaryRank, readLanguageFamily, readRepositoryFileLines, renamesTheFile, Scale, SHAPE_KINDS, ShapeFiles, TestLayout, TestPlacements, VISIBILITIES } from "../../../../code/index.mjs";
import { readFolderPath } from "../../../../files/paths.mjs";
import { ShapeSlices } from "./ShapeSlices.mjs";
import { ExistingTypeHeads } from "./ExistingTypeHeads.mjs";
import { ShapeTypeHeads } from "./ShapeTypeHeads.mjs";
import { TypeHeads } from "./TypeHeads.mjs";
import { ShapeDecisionSearch } from "./ShapeDecisionSearch.mjs";

const BOUNDARY_MOVING_FILE_STATUSES = new Set([FILE_STATUS.CREATED, FILE_STATUS.REMOVED, FILE_STATUS.RENAMED]);

const PUBLIC_KIND_BY_SHAPE_KIND_MAP = Object.freeze({
  [SHAPE_KINDS.CREATED]: PUBLIC_CHANGE_KINDS.CREATED,
  [SHAPE_KINDS.MOVED]: PUBLIC_CHANGE_KINDS.MOVED,
  [SHAPE_KINDS.MODIFIED]: PUBLIC_CHANGE_KINDS.MODIFIED,
});

const NO_MODULE_ROOT_READ = Object.freeze({ root: "", isRoot: false, rootForm: "", reason: "", exposed: [], boundaries: [], tree: [], references: [], modulePackage: "", applicationPackage: "" });

const EXPOSED_LINE_SEPARATOR = " · ";

const isPlacedInAChangedFile = placement => placement.kind !== SHAPE_KINDS.UNCHANGED && placement.kind !== SHAPE_KINDS.REMOVED;

const readChangeKindOfTheFile = file => {
  if (file.kind === SHAPE_KINDS.CREATED) return CHANGE_KINDS.CREATED;
  if (file.kind === SHAPE_KINDS.MOVED) return renamesTheFile(file) ? CHANGE_KINDS.RENAMED : CHANGE_KINDS.MOVED;
  return CHANGE_KINDS.BOUNDARY_CHANGED;
};

const KINDS_THAT_KEEP_THE_BODY = new Set([CHANGE_KINDS.MOVED, CHANGE_KINDS.RENAMED]);

const readChangeKindOfTheMethodBody = shapeClass => (KINDS_THAT_KEEP_THE_BODY.has(shapeClass.changeKind) ? shapeClass.changeKind : CHANGE_KINDS.CREATED);

const readVisibilityOfTheMethod = method => (method.visibility === PUBLIC_METHOD_VISIBILITY ? VISIBILITIES.EXPOSED : VISIBILITIES.PRIVATE);

const listLinesOfTheFile = lineCount => (lineCount ? [[1, lineCount]] : []);

const buildChangedLinesOfTheFile = file => ({ lines: listLinesOfTheFile(file.lines.length), removedAfter: [], added: file.kind === SHAPE_KINDS.CREATED });

const createAbstraction = fields => ({
  id: "",
  enclosingTypeName: null,
  usedIn: "",
  isTest: isTestPath(fields.path),
  lines: null,
  referenceLines: [],
  measures: {},
  facts: {},
  comments: [],
  module: null,
  openConstructs: null,
  sameDecisionAt: [],
  occurrences: [],
  reachingTests: null,
  testFriction: null,
  ioReach: null,
  changedBranches: null,
  namedDeclarations: null,
  outsideDeclaration: null,
  homeModule: null,
  searchScope: null,
  slice: null,
  children: [],
  ...fields,
});

const readClassNamesByFile = shapeClasses => {
  const namesByFileMap = new Map();
  for (const shapeClass of shapeClasses) namesByFileMap.set(shapeClass.file, [...(namesByFileMap.get(shapeClass.file) || []), shapeClass.name]);
  return namesByFileMap;
};

const readExposedNamesByPath = exposedLines => {
  const namesByPathMap = new Map();
  for (const line of exposedLines) {
    const at = line.indexOf(EXPOSED_LINE_SEPARATOR);
    if (at < 0) continue;
    const exposedPath = line.slice(0, at);
    namesByPathMap.set(exposedPath, [...(namesByPathMap.get(exposedPath) || []), line.slice(at + EXPOSED_LINE_SEPARATOR.length)]);
  }
  return namesByPathMap;
};

export class ShapeAbstractions {
  constructor(shapeModel, repository, shapeModelPath) {
    this.shapeModel = shapeModel;
    this.repository = repository;
    this.shapeModelPath = shapeModelPath;
    this.basePaths = readBasePaths(repository);
    this.shapeFiles = new ShapeFiles(shapeModel, this.basePaths);
    this.changedFiles = this.shapeFiles.listChangedFiles();
    this.pathsAfterTheShape = this.shapeFiles.listPathsAfterTheShape();
    this.createdFolders = new CreatedFolders(this.basePaths, this.changedFiles);
    this.foldersAFileLeft = new Set(this.listFoldersAFileLeft());
    this.createdSubfoldersByJoinedFolderMap = this.createdFolders.readCreatedSubfoldersByJoinedFolder(this.listFoldersWithChangedFiles());
    this.moduleReading = new ModuleReading(repository);
    const applicationRoots = findDeployableRoots(repository);
    const change = { mode: CHANGE_MODES.SHAPE, repository, files: this.changedFiles.map(file => ({ ...file, hunks: [] })) };
    this.slices = new ShapeSlices(change, this.pathsAfterTheShape, applicationRoots, filePath => this.readLinesOf(filePath));
    this.testLayout = this.readTheTestLayout();
    this.typeHeads = new TypeHeads({ shapeTypeHeads: this.readTheShapeTypeHeads(), existingTypeHeads: this.readTheExistingTypeHeads() });
    this.decisionSearch = new ShapeDecisionSearch(this.shapeFiles.listClassPlacements(), filePath => this.shapeFiles.readRenderedLinesOf(filePath));
    this.nextNumber = 0;
  }

  readTheExistingTypeHeads() {
    const shapedPaths = new Set(this.changedFiles.map(file => file.path));
    const isRenderedByTheShape = filePath => shapedPaths.has(filePath) && this.shapeFiles.readRenderedLinesOf(filePath).length > 0;
    return new ExistingTypeHeads({
      pathsOfExistingFiles: this.pathsAfterTheShape.filter(filePath => !isRenderedByTheShape(filePath)),
      namesDeclaredByTheShape: new Set(this.shapeModel.classes.filter(shapeClass => shapedPaths.has(shapeClass.file)).map(shapeClass => shapeClass.name)),
      readFileLines: filePath => readRepositoryFileLines(this.repository, this.shapeFiles.readOldPathOf(filePath) || filePath),
    });
  }

  readTheShapeTypeHeads() {
    return new ShapeTypeHeads({
      classPlacements: this.shapeFiles.listClassPlacements().filter(isPlacedInAChangedFile),
      readRenderedLinesOf: filePath => this.shapeFiles.readRenderedLinesOf(filePath),
    });
  }

  readTheTestLayout() {
    return new TestLayout({
      testPlacements: new TestPlacements(this.pathsAfterTheShape, readClassNamesByFile(this.shapeModel.classes)),
      listFilePathsIn: folder => this.pathsAfterTheShape.filter(filePath => readFolderPath(filePath) === folder),
      readFileLines: filePath => this.readLinesOf(filePath),
    });
  }

  readLinesOf(filePath) {
    const rendered = this.shapeFiles.readRenderedLinesOf(filePath);
    if (rendered.length) return rendered;
    return readRepositoryFileLines(this.repository, this.shapeFiles.readOldPathOf(filePath) || filePath);
  }

  buildReviewAbstractions() {
    const abstractions = this.buildTheTree();
    const everyAbstraction = abstractions.flatMap(function listWithChildren(abstraction) { return [abstraction, ...abstraction.children.flatMap(listWithChildren)]; });
    return {
      mode: CHANGE_MODES.SHAPE,
      modeReason: `the shape model ${this.shapeModelPath}`,
      target: this.repository,
      excluded: [],
      counts: this.countTheAbstractions(everyAbstraction),
      notParsed: [],
      leftOutFiles: [],
      abstractions,
      abstractionsOfTheChange: everyAbstraction.filter(abstraction => abstraction.lines).map(abstraction => ({ path: abstraction.path, ...abstraction.lines, scale: abstraction.scale, displayName: abstraction.displayName })),
      changedLines: this.buildChangedLines(),
      dependencies: { identity: "", files: [] },
      chainGroups: [],
      parameterRelations: [],
      coreOperations: [],
      entryBoundaries: [],
      boundaryPaths: [],
      publicChangeKinds: this.buildPublicChangeKinds(everyAbstraction),
    };
  }

  countTheAbstractions(everyAbstraction) {
    const byScale = Object.fromEntries(Scale.ALL.map(scale => [scale.name, everyAbstraction.filter(abstraction => abstraction.scale === scale.name).length]));
    return { files: this.changedFiles.length, hunks: 0, abstractions: everyAbstraction.length, byScale };
  }

  buildChangedLines() {
    return Object.fromEntries(this.changedFiles.filter(file => file.existsAfterTheChange).map(file => [file.path, buildChangedLinesOfTheFile(file)]));
  }

  buildPublicChangeKinds(everyAbstraction) {
    const modules = everyAbstraction.filter(abstraction => abstraction.scale === Scale.MODULE.name);
    const declarationsOf = filePath => everyAbstraction
      .filter(abstraction => abstraction.lines && abstraction.path === filePath)
      .map(abstraction => ({ scale: abstraction.scale, name: abstraction.name, ...abstraction.lines, kind: abstraction.publicChangeKind }));
    return {
      kindBase: null,
      renames: [],
      applications: [],
      folders: modules.map(module => ({ path: module.path, kind: module.publicChangeKind })),
      files: this.changedFiles.filter(file => file.existsAfterTheChange).map(file => ({ path: file.path, kind: PUBLIC_KIND_BY_SHAPE_KIND_MAP[file.kind], declarations: declarationsOf(file.path) })),
    };
  }

  buildTheTree() {
    const classes = this.buildTheClasses();
    const modules = this.listModuleFolders().map(folder => this.buildTheModule(folder)).filter(Boolean);
    const moduleByPathMap = new Map(modules.map(module => [module.path, module]));
    const roots = [...modules];
    for (const shapeClass of classes) {
      const module = moduleByPathMap.get(readFolderPath(shapeClass.path));
      if (module) module.children.push(shapeClass);
      else roots.push(shapeClass);
    }
    for (const root of roots) this.numberTheTree(root);
    return roots;
  }

  numberTheTree(abstraction) {
    this.nextNumber += 1;
    abstraction.id = `A${this.nextNumber}`;
    for (const child of abstraction.children) this.numberTheTree(child);
  }

  listFoldersWithChangedFiles() {
    return new Set(this.changedFiles.filter(file => file.existsAfterTheChange).map(file => readFolderPath(file.path)));
  }

  listFoldersAFileLeft() {
    const takenAway = [...this.changedFiles.filter(file => !file.existsAfterTheChange).map(file => file.path), ...this.changedFiles.map(file => file.oldPath).filter(Boolean)];
    return [...new Set(takenAway.map(readFolderPath))].filter(folder => this.createdFolders.existsAfterTheChange(folder));
  }

  listModuleFolders() {
    const listed = this.shapeModel.folders.filter(folder => folder.kind !== SHAPE_KINDS.REMOVED).map(folder => folder.path);
    return [...new Set([...listed, ...this.createdSubfoldersByJoinedFolderMap.keys(), ...this.foldersAFileLeft])];
  }

  readChangeKindOfTheFolder(folder) {
    if (this.createdFolders.isCreated(folder)) return CHANGE_KINDS.CREATED;
    if (this.createdSubfoldersByJoinedFolderMap.has(folder) || this.foldersAFileLeft.has(folder)) return CHANGE_KINDS.BOUNDARY_CHANGED;
    const ownFiles = this.listChangedFilesOf(folder);
    if (!ownFiles.length) return null;
    return ownFiles.some(file => BOUNDARY_MOVING_FILE_STATUSES.has(file.status)) ? CHANGE_KINDS.BOUNDARY_CHANGED : CHANGE_KINDS.INTERNALS_CHANGED;
  }

  listChangedFilesOf(folder) {
    return this.changedFiles.filter(file => readFolderPath(file.path) === folder);
  }

  buildTheModule(folder) {
    const changeKind = this.readChangeKindOfTheFolder(folder);
    if (!changeKind) return null;
    const createdSubfolders = this.createdSubfoldersByJoinedFolderMap.get(folder) || [];
    const ownFiles = this.listChangedFilesOf(folder);
    const module = createAbstraction({
      scale: Scale.MODULE.name,
      name: folder,
      displayName: folder,
      path: folder,
      changeKind,
      publicChangeKind: changeKind === CHANGE_KINDS.CREATED ? PUBLIC_CHANGE_KINDS.CREATED : PUBLIC_CHANGE_KINDS.MODIFIED,
      visibility: VISIBILITIES.EXPOSED,
      boundaryRank: BOUNDARY_RANKS.MODULE_BOUNDARY,
      module: {
        ...this.readTheModuleRoot(folder),
        joinsAFolder: this.createdFolders.joinsAFolder(folder),
        createdSubfolders,
        ...(createdSubfolders.length && !ownFiles.length ? { holdsOnlyCreatedSubfolders: true } : {}),
        ...this.testLayout.readTheFacts(folder, ownFiles),
      },
    });
    module.slice = this.slices.buildModuleSlice(module);
    return module;
  }

  findTheNearestBaseFolder(folder) {
    let found = folder;
    while (found && this.createdFolders.isCreated(found)) found = readFolderPath(found);
    return found;
  }

  readTheModuleRoot(folder) {
    const baseFolder = this.findTheNearestBaseFolder(folder);
    if (baseFolder !== folder) return { ...NO_MODULE_ROOT_READ, ...this.moduleReading.readIdentity(baseFolder) };
    const read = this.moduleReading.buildReading(folder);
    return read.root ? { ...read, tree: this.listModuleTreeLines(folder, read.exposed) } : read;
  }

  listModuleTreeLines(folder, exposedLines) {
    const exposedNamesByPathMap = readExposedNamesByPath(exposedLines);
    const children = this.slices.moduleSlices.folderChildren;
    const lineOf = childPath => {
      const names = exposedNamesByPathMap.get(childPath);
      if (names) return `${childPath} · exposes ${names.join(", ")}`;
      return children.listSubfolderPathsOf(readFolderPath(childPath)).includes(childPath) ? `${childPath}/` : childPath;
    };
    const subfolders = children.listSubfolderPathsOf(folder);
    return [...children.readRepositoryFileList(folder), ...subfolders.flatMap(subfolder => children.readRepositoryFileList(subfolder))].map(lineOf);
  }

  buildTheClasses() {
    return this.shapeFiles.listClassPlacements()
      .filter(isPlacedInAChangedFile)
      .map(placement => this.buildTheClass(placement));
  }

  buildTheClass(placement) {
    const changeKind = readChangeKindOfTheFile(this.shapeFiles.describeTheChangedFile(placement.path));
    const publicChangeKind = PUBLIC_KIND_BY_SHAPE_KIND_MAP[placement.kind];
    const renderedLines = this.shapeFiles.readRenderedLinesOf(placement.path);
    const shapeClass = createAbstraction({
      scale: Scale.CLASS.name,
      name: placement.shapeClass.name,
      displayName: placement.shapeClass.name,
      path: placement.path,
      changeKind,
      publicChangeKind,
      visibility: VISIBILITIES.EXPOSED,
      boundaryRank: readBoundaryRank([], [], VISIBILITIES.EXPOSED),
      lines: placement.lines,
    });
    shapeClass.slice = this.slices.buildOwnLinesSlice(shapeClass, renderedLines, this.listTypeHeadSections(shapeClass, renderedLines));
    shapeClass.children = placement.methods
      .filter(({ method }) => Boolean(method.body))
      .map(methodPlacement => this.buildTheMethod(shapeClass, placement, methodPlacement, renderedLines));
    return shapeClass;
  }

  buildTheMethod(shapeClass, placement, methodPlacement, renderedLines) {
    const { method, lines } = methodPlacement;
    const visibility = readVisibilityOfTheMethod(method);
    const shapeMethod = createAbstraction({
      scale: Scale.METHOD.name,
      name: method.name,
      enclosingTypeName: shapeClass.name,
      displayName: `${shapeClass.name}#${method.name}`,
      path: shapeClass.path,
      changeKind: readChangeKindOfTheMethodBody(shapeClass),
      publicChangeKind: shapeClass.publicChangeKind === PUBLIC_CHANGE_KINDS.MOVED ? PUBLIC_CHANGE_KINDS.MOVED : PUBLIC_CHANGE_KINDS.CREATED,
      visibility,
      boundaryRank: readBoundaryRank([], [], visibility),
      lines,
    });
    shapeMethod.slice = this.slices.buildOwnLinesSlice(shapeMethod, renderedLines, this.listTypeHeadSections(shapeMethod, renderedLines));
    if (!shapeMethod.isTest) this.placeTheSameDecisions(shapeMethod, this.decisionSearch.findSameDecisionPlaces(placement, methodPlacement));
    return shapeMethod;
  }

  listTypeHeadSections(abstraction, renderedLines) {
    const { from, to } = abstraction.lines;
    return this.typeHeads.listSections(renderedLines.slice(from - 1, to), { ownName: abstraction.enclosingTypeName || abstraction.name, usedFrom: abstraction.path });
  }

  readTheModuleIdentityOf(filePath) {
    return this.moduleReading.readIdentity(this.findTheNearestBaseFolder(readFolderPath(filePath)));
  }

  placeTheSameDecisions(shapeMethod, sameDecisionAt) {
    if (!sameDecisionAt.length) return;
    for (const place of sameDecisionAt.flatMap(occurrence => occurrence.places)) place.moduleRoot = this.readTheModuleIdentityOf(place.path).root;
    shapeMethod.sameDecisionAt = sameDecisionAt;
    shapeMethod.homeModule = this.readTheModuleIdentityOf(shapeMethod.path);
    shapeMethod.searchScope = { family: readLanguageFamily(shapeMethod.path), minifiedSkipped: 0 };
  }
}
