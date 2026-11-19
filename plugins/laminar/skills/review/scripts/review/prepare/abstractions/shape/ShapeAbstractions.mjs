import { BOUNDARY_RANKS, CHANGE_KINDS, CHANGE_MODES, collectTypeNames, createModuleReadingFromTheFiles, CreatedFolders, FILE_STATUS, findDeployableRoots, findDriver, formatDisplayName, formatTheShapeLines, isTestPath, isUpperSnakeName, PUBLIC_CHANGE_KINDS, PUBLIC_METHOD_VISIBILITY, readBasePaths, readBoundaryRank, readLanguageFamily, readRepositoryFileLines, renamesTheFile, restatesTheTypeText, Scale, SHAPE_KINDS, ShapeFiles, TestLayout, TestPlacements, VISIBILITIES } from "../../../../code/index.mjs";
import { readFolderPath } from "../../../../files/paths.mjs";
import { numberLines } from "../../formats/SliceFormat.mjs";
import { ShapeSlices } from "./ShapeSlices.mjs";
import { ExistingTypeHeads } from "./ExistingTypeHeads.mjs";
import { ShapeTypeHeads } from "./ShapeTypeHeads.mjs";
import { namesTheOwnType, TypeHeads } from "./TypeHeads.mjs";
import { ShapeDecisionSearch } from "./ShapeDecisionSearch.mjs";

const BOUNDARY_MOVING_FILE_STATUSES = new Set([FILE_STATUS.CREATED, FILE_STATUS.REMOVED, FILE_STATUS.RENAMED]);

const PUBLIC_KIND_BY_SHAPE_KIND_MAP = Object.freeze({
  [SHAPE_KINDS.CREATED]: PUBLIC_CHANGE_KINDS.CREATED,
  [SHAPE_KINDS.MOVED]: PUBLIC_CHANGE_KINDS.MOVED,
  [SHAPE_KINDS.MODIFIED]: PUBLIC_CHANGE_KINDS.MODIFIED,
});

const NO_MODULE_ROOT_READ = Object.freeze({ root: "", isRoot: false, rootForm: "", reason: "", exposed: [], boundaries: [], tree: [], references: [], modulePackage: "", applicationPackage: "" });

const EXPOSED_LINE_SEPARATOR = " · ";

// A Java or C# record and a Kotlin data class declare their components in the head, so their tree head lists the fields.
const KIND_WORDS_WITH_THE_FIELDS_IN_THE_HEAD = new Set(["record", "data class"]);

const NESTED_NAME_SEPARATOR = ".";

const isPlacedInAChangedFile = placement => placement.kind !== SHAPE_KINDS.UNCHANGED && placement.kind !== SHAPE_KINDS.REMOVED;

const isATopType = placement => !placement.shapeClass.name.includes(NESTED_NAME_SEPARATOR);

// A method that the model marks unchanged keeps the name and the signature of the current tree, so the change does not write its name, and no name form of the script is settled on it.
const holdsANameTheChangeWrites = ({ method }) => method.unchanged !== true;

const formatTypedName = field => (field.type ? `${field.name}: ${field.type}` : field.name);

const formatSupertypes = (word, names) => (names.length ? [`${word} ${names.join(", ")}`] : []);

// A constant is named in upper snake case in Java, Kotlin, TypeScript and Python, and it is no component of the head.
const formatTheFieldsOfTheHead = shapeClass => (KIND_WORDS_WITH_THE_FIELDS_IN_THE_HEAD.has(shapeClass.kindWord)
  ? `(${shapeClass.fields.filter(field => !isUpperSnakeName(field.name)).map(formatTypedName).join(", ")})`
  : "");

const formatTheTreeHead = shapeClass => [
  `${shapeClass.kindWord} ${shapeClass.name}${formatTheFieldsOfTheHead(shapeClass)}`,
  ...formatSupertypes("extends", shapeClass.extends),
  ...formatSupertypes("implements", shapeClass.implements),
].join(" ");

const readChangeKindOfTheFile = file => {
  if (file.kind === SHAPE_KINDS.CREATED) return CHANGE_KINDS.CREATED;
  if (file.kind === SHAPE_KINDS.MOVED) return renamesTheFile(file) ? CHANGE_KINDS.RENAMED : CHANGE_KINDS.MOVED;
  return CHANGE_KINDS.BOUNDARY_CHANGED;
};

const KINDS_THAT_KEEP_THE_BODY = new Set([CHANGE_KINDS.MOVED, CHANGE_KINDS.RENAMED]);

const readChangeKindOfTheMethodBody = shapeClass => (KINDS_THAT_KEEP_THE_BODY.has(shapeClass.changeKind) ? shapeClass.changeKind : CHANGE_KINDS.CREATED);

const holdsNamedValuesOfItsOwn = abstraction => !abstraction.isTest && !KINDS_THAT_KEEP_THE_BODY.has(abstraction.changeKind);

const listFieldsNamedBeyondTheirType = placement => placement.shapeClass.fields
  .map((field, index) => ({ field, line: placement.lines.from + 1 + index }))
  .filter(({ field }) => !restatesTheTypeText(field.name, field.type));

const describeTheField = (shapeClass, { field, line }) => ({
  name: field.name,
  displayName: formatDisplayName(Scale.VARIABLE.name, field.name, shapeClass.name),
  lines: { from: line, to: line },
  changedLines: { from: line, to: line },
});

const measureExtentOfTheFields = fields => (fields.length === 1
  ? { lines: fields[0].lines }
  : { lines: { from: fields[0].lines.from, to: fields[fields.length - 1].lines.to }, fields });

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
    this.filesOfTheRemovedFolders = this.listFilesOfTheRemovedFolders();
    this.pathsAfterTheShape = this.leaveOutTheFilesOfTheRemovedFolders(this.shapeFiles.listPathsAfterTheShape());
    this.createdFolders = new CreatedFolders(this.basePaths, [...this.changedFiles, ...this.filesOfTheRemovedFolders]);
    this.foldersAFileLeft = new Set(this.listFoldersAFileLeft());
    this.foldersARemovedFolderLeft = new Set(this.createdFolders.listFoldersARemovedFolderLeft(this.listPathsTakenAway().map(readFolderPath)));
    this.createdSubfoldersByJoinedFolderMap = this.createdFolders.readCreatedSubfoldersByJoinedFolder(this.listFoldersWithChangedFiles());
    const applicationRoots = findDeployableRoots(repository);
    this.moduleReading = createModuleReadingFromTheFiles({ repository, roots: applicationRoots, paths: this.pathsAfterTheShape, readFileLines: filePath => this.readLinesOf(filePath) });
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
    this.methodsWithNoBody = [];
    const abstractions = this.buildTheTree();
    for (const methodWithNoBody of this.methodsWithNoBody) this.numberTheTree(methodWithNoBody);
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
      methodsWithNoBody: this.methodsWithNoBody,
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

  listFilesOfTheRemovedFolders() {
    const removedFolders = this.shapeModel.folders.filter(folder => folder.kind === SHAPE_KINDS.REMOVED).map(folder => folder.path);
    return this.basePaths
      .filter(basePath => removedFolders.some(folder => basePath.startsWith(`${folder}/`)))
      .map(basePath => ({ path: basePath, status: FILE_STATUS.REMOVED }));
  }

  leaveOutTheFilesOfTheRemovedFolders(filePaths) {
    const removedPaths = new Set(this.filesOfTheRemovedFolders.map(file => file.path));
    return filePaths.filter(filePath => !removedPaths.has(filePath));
  }

  listPathsTakenAway() {
    return [...this.changedFiles.filter(file => !file.existsAfterTheChange).map(file => file.path), ...this.changedFiles.map(file => file.oldPath).filter(Boolean), ...this.filesOfTheRemovedFolders.map(file => file.path)];
  }

  listFoldersAFileLeft() {
    return [...new Set(this.listPathsTakenAway().map(readFolderPath))].filter(folder => this.createdFolders.existsAfterTheChange(folder));
  }

  listModuleFolders() {
    const listed = this.shapeModel.folders.filter(folder => folder.kind !== SHAPE_KINDS.REMOVED).map(folder => folder.path);
    return [...new Set([...listed, ...this.createdSubfoldersByJoinedFolderMap.keys(), ...this.foldersAFileLeft, ...this.foldersARemovedFolderLeft])];
  }

  readChangeKindOfTheFolder(folder) {
    if (this.createdFolders.isCreated(folder)) return CHANGE_KINDS.CREATED;
    if (this.createdSubfoldersByJoinedFolderMap.has(folder) || this.foldersAFileLeft.has(folder) || this.foldersARemovedFolderLeft.has(folder)) return CHANGE_KINDS.BOUNDARY_CHANGED;
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
      judgedWhole: this.shapeModel.folders.some(listed => listed.path === folder),
      module: {
        ...this.readTheModuleRoot(folder),
        ...this.readTheShapeOfTheFolder(folder),
        joinsAFolder: this.createdFolders.joinsAFolder(folder),
        createdSubfolders,
        ...(createdSubfolders.length && !ownFiles.length ? { holdsOnlyCreatedSubfolders: true } : {}),
        ...this.testLayout.readTheFacts(folder, ownFiles),
      },
    });
    module.slice = this.slices.buildModuleSlice(module);
    return module;
  }

  readTheShapeOfTheFolder(folder) {
    const foundShapeFolder = this.moduleReading.shapes.findShapeFolder(folder);
    return foundShapeFolder ? { shape: formatTheShapeLines(foundShapeFolder) } : {};
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
      const renderedHeads = this.listRenderedHeadsOf(childPath);
      const names = renderedHeads.length ? renderedHeads : exposedNamesByPathMap.get(childPath);
      if (names) return `${childPath} · exposes ${names.join(", ")}`;
      return children.listSubfolderPathsOf(readFolderPath(childPath)).includes(childPath) ? `${childPath}/` : childPath;
    };
    const subfolders = children.listSubfolderPathsOf(folder);
    return [...children.readRepositoryFileList(folder), ...subfolders.flatMap(subfolder => children.readRepositoryFileList(subfolder))].map(lineOf);
  }

  listRenderedHeadsOf(childPath) {
    const filePath = this.pathsAfterTheShape.find(shownPath => shownPath === childPath || shownPath.endsWith(`/${childPath}`));
    if (!filePath || !this.shapeFiles.readRenderedLinesOf(filePath).length) return [];
    return this.shapeFiles.listClassPlacements()
      .filter(placement => placement.path === filePath && isATopType(placement) && isPlacedInAChangedFile(placement))
      .map(placement => formatTheTreeHead(placement.shapeClass));
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
      holdsAMethodBody: placement.methods.some(({ method }) => Boolean(method.body)),
    });
    shapeClass.slice = this.slices.buildOwnLinesSlice(shapeClass, renderedLines, this.listTypeHeadSections(shapeClass, renderedLines));
    const methods = placement.methods
      .filter(({ method }) => Boolean(method.body))
      .map(methodPlacement => this.buildTheMethod(shapeClass, placement, methodPlacement, renderedLines));
    for (const methodPlacement of placement.methods.filter(({ method }) => !method.body).filter(holdsANameTheChangeWrites)) this.methodsWithNoBody.push(this.buildTheMethodWithNoBody(shapeClass, methodPlacement, renderedLines));
    shapeClass.children = [...this.buildTheFields(shapeClass, placement, renderedLines), ...methods];
    return shapeClass;
  }

  buildTheFields(shapeClass, placement, renderedLines) {
    const fields = holdsNamedValuesOfItsOwn(shapeClass) ? listFieldsNamedBeyondTheirType(placement).map(placedField => describeTheField(shapeClass, placedField)) : [];
    if (!fields.length) return [];
    const name = fields.map(field => field.name).join(", ");
    const fieldGroup = createAbstraction({
      scale: Scale.VARIABLE.name,
      name,
      enclosingTypeName: shapeClass.name,
      displayName: formatDisplayName(Scale.VARIABLE.name, name, shapeClass.name),
      path: shapeClass.path,
      changeKind: CHANGE_KINDS.CREATED,
      publicChangeKind: PUBLIC_CHANGE_KINDS.CREATED,
      visibility: VISIBILITIES.EXPOSED,
      boundaryRank: shapeClass.boundaryRank,
      ...measureExtentOfTheFields(fields),
    });
    const headLine = placement.lines.from;
    const ownLines = [headLine, ...fields.map(field => field.lines.from)].flatMap(line => numberLines([renderedLines[line - 1]], line));
    fieldGroup.slice = this.slices.buildSliceOfTheLines(fieldGroup, ownLines, this.listTypeHeadSectionsOfTheFields(shapeClass, placement.shapeClass, fields, renderedLines));
    return [fieldGroup];
  }

  listTypeHeadSectionsOfTheFields(shapeClass, modeledClass, fields, renderedLines) {
    const supertypeNames = [...modeledClass.extends, ...modeledClass.implements];
    const fieldTypeNames = collectTypeNames(fields.map(field => renderedLines[field.lines.from - 1]));
    const typeNames = [...new Set([...supertypeNames, ...fieldTypeNames])].filter(typeName => !namesTheOwnType(typeName, shapeClass.name));
    return this.typeHeads.listSectionsOfTheTypes(typeNames, shapeClass.path);
  }

  buildTheLocals(shapeMethod, renderedLines, typeHeadSections) {
    const driver = findDriver(shapeMethod.path);
    if (!driver || !holdsNamedValuesOfItsOwn(shapeMethod)) return [];
    const { from, to } = shapeMethod.lines;
    return driver.findLocalVariables(renderedLines.slice(from - 1, to)).map(name => {
      const local = createAbstraction({
        scale: Scale.VARIABLE.name,
        name,
        enclosingTypeName: shapeMethod.displayName,
        displayName: formatDisplayName(Scale.VARIABLE.name, name, shapeMethod.displayName),
        path: shapeMethod.path,
        changeKind: CHANGE_KINDS.CREATED,
        publicChangeKind: shapeMethod.publicChangeKind,
        visibility: VISIBILITIES.PRIVATE,
        boundaryRank: shapeMethod.boundaryRank,
        lines: shapeMethod.lines,
      });
      local.slice = this.slices.buildOwnLinesSlice(local, renderedLines, typeHeadSections);
      return local;
    });
  }

  buildTheMethodWithNoBody(shapeClass, methodPlacement, renderedLines) {
    const shapeMethod = this.createTheMethod(shapeClass, methodPlacement);
    shapeMethod.slice = this.slices.buildOwnLinesSlice(shapeMethod, renderedLines, this.listTypeHeadSections(shapeMethod, renderedLines));
    return shapeMethod;
  }

  buildTheMethod(shapeClass, placement, methodPlacement, renderedLines) {
    const shapeMethod = this.createTheMethod(shapeClass, methodPlacement);
    const typeHeadSections = this.listTypeHeadSections(shapeMethod, renderedLines);
    shapeMethod.slice = this.slices.buildOwnLinesSlice(shapeMethod, renderedLines, typeHeadSections);
    shapeMethod.children = this.buildTheLocals(shapeMethod, renderedLines, typeHeadSections);
    if (!shapeMethod.isTest) this.placeTheSameDecisions(shapeMethod, this.decisionSearch.findSameDecisionPlaces(placement, methodPlacement));
    return shapeMethod;
  }

  createTheMethod(shapeClass, { method, lines }) {
    const visibility = readVisibilityOfTheMethod(method);
    return createAbstraction({
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
      holdsAMethodBody: Boolean(method.body),
    });
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
