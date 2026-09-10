import { readFileName, readFileStem, readFolderPath } from "../../../../../../files/paths.mjs";
import { findDriver } from "../../../../../inputs/source/drivers/LanguageRegistry.mjs";
import { buildWholeWordPattern } from "../../../../../inputs/source/text/PatternText.mjs";
import { opensTheFile } from "../published/Openings.mjs";
import { listInOutFolders, listAppSideFolders, isWithin, isWithinAny, listApiSpiFolders, mapToShapeFolders } from "./ModuleShapes.mjs";
import { SHAPE_FOLDER_KINDS } from "./ShapeFolderKinds.mjs";
import { formatPlacedSliceLine } from "../../../../../graph/abstractions/Place.mjs";
import { findSupertypeNamesOfTheApiSpiType } from "../../../../calls/resolution/SupertypeWalk.mjs";

export const MAX_FACTS_PER_SECTION = 12;

const MAX_USERS_NAMED = 3;

const INDEX_STEMS = new Set(["index", "__init__", "mod"]);

const buildFolderLabel = folder => `${folder || "."}/`;

const IN_OUT_IMPORT_PHRASE_BY_SHAPE_KEY_MAP = Object.freeze({ in: "from the in folder", out: "from the out folder", inOut: "from in or out code" });

const findTheInOutImportWords = (shape, inOutPath) => {
  const holdingShapeKey = Object.keys(IN_OUT_IMPORT_PHRASE_BY_SHAPE_KEY_MAP).find(shapeKey => isWithinAny(inOutPath, shape[shapeKey])) ?? "inOut";
  return IN_OUT_IMPORT_PHRASE_BY_SHAPE_KEY_MAP[holdingShapeKey];
};

const isNested = (type, types) => types.some(other => other !== type && other.path === type.path && other.line < type.line && other.to >= type.to);

const findTopTypes = types => types.filter(type => !isNested(type, types));

const takeFirstFactsWithinTheCap = facts => facts.slice(0, MAX_FACTS_PER_SECTION);

const buildAWholeWordMatcher = word => {
  if (!word) return () => false;
  const wordPattern = buildWholeWordPattern(word);
  return line => wordPattern.test(line);
};

const nameTheFile = filePath => (INDEX_STEMS.has(readFileStem(filePath)) ? readFileName(readFolderPath(filePath)) : readFileStem(filePath));

const holdsMostImportsInward = shape => {
  if (!shape.direction) return false;
  return shape.direction.inward > 0 && shape.direction.inward > shape.direction.outward;
};

const resolvesNoImport = shape => !shape.direction || shape.direction.inward + shape.direction.outward === 0;

const readQualifierFolder = qualifiedName => qualifiedName.slice(0, qualifiedName.lastIndexOf(".")).replace(/\./g, "/");

const qualifiesTheFolderOf = (qualifiedName, apiSpiType) => {
  if (!qualifiedName.includes(".")) return false;
  const apiSpiFolder = readFolderPath(apiSpiType.path);
  const qualifierFolder = readQualifierFolder(qualifiedName);
  return apiSpiFolder === qualifierFolder || apiSpiFolder.endsWith(`/${qualifierFolder}`);
};

const countTypesByName = types => types.reduce((countByNameMap, type) => countByNameMap.set(type.name, (countByNameMap.get(type.name) || 0) + 1), new Map());

const isInsideTheApp = (filePath, shape) => isWithinAny(filePath, listAppSideFolders(shape)) && !isWithinAny(filePath, listInOutFolders(shape));

const findFirstFolderOfTheChange = (folders, isAFolderOfTheChange) => folders.find(isAFolderOfTheChange);

const isAnUnpublishedCrossing = crossing => !crossing.mark.published;

const findOpeningPublishing = (publishedSet, type) => publishedSet.openings.find(opening => opensTheFile(opening, type.path) && (!(opening.names || []).length || opening.names.includes(type.name)));

const listFoldersOfTheExposure = (type, opening, throughApiSpiFiles, outerRoot) => [
  readFolderPath(type.path),
  ...(opening ? [readFolderPath(opening.path)] : throughApiSpiFiles.map(apiSpiType => readFolderPath(apiSpiType.path))),
  outerRoot,
];

const NO_PUBLISHED_SET = Object.freeze({ openings: [] });

const collectImportersByPath = (paths, importsOf) => {
  const importersByPathMap = new Map();
  for (const filePath of paths) for (const target of importsOf(filePath)) importersByPathMap.set(target, [...(importersByPathMap.get(target) || []), filePath]);
  return importersByPathMap;
};

export class ModuleBoundaries {
  constructor({ shapes, moduleReading, publishedSets, importsOf, paths }) {
    this.shapes = shapes;
    this.moduleReading = moduleReading;
    this.publishedSets = publishedSets;
    this.importersByPathMap = collectImportersByPath(paths, importsOf);
  }

  readOuterRoot(filePath) {
    return this.moduleReading.readIdentity(readFolderPath(filePath)).root;
  }

  readPublishedSet(root) {
    return this.publishedSets.get(root) || NO_PUBLISHED_SET;
  }

  buildPublishedMark(filePath) {
    const outerRoot = this.readOuterRoot(filePath);
    const publishedSet = this.readPublishedSet(outerRoot);
    const opening = publishedSet.openings.find(opening => opensTheFile(opening, filePath));
    if (opening) return { published: true, text: `published by ${opening.path}:${opening.line}` };
    if (readFolderPath(filePath) === outerRoot) return { published: true, text: `published at the root of ${outerRoot}` };
    return { published: false, text: `hidden in ${outerRoot}` };
  }

  findModuleHoldingTheShape(filePath) {
    const outerRoot = this.readOuterRoot(filePath);
    const shape = this.shapes.findShapeHolding(readFolderPath(filePath));
    return outerRoot && shape && isWithin(shape.root, outerRoot) ? outerRoot : "";
  }

  importsFromAnotherModule(from, root) {
    return !isWithin(from, root) && this.readOuterRoot(from) !== root;
  }

  listImporters(filePath) {
    return this.importersByPathMap.get(filePath) || [];
  }

  findImportersFromOtherModules(filePath, root) {
    return this.listImporters(filePath).filter(from => this.importsFromAnotherModule(from, root));
  }
}

export class ShapeFacts {
  constructor({ shapes, moduleBoundaries, importsOf, types, readFileLines: linesOf, paths }) {
    this.shapes = shapes;
    this.moduleBoundaries = moduleBoundaries;
    this.importsOf = importsOf;
    this.types = findTopTypes(types);
    this.readFileLines = filePath => linesOf(filePath) || [];
    this.paths = paths;
    this.typeCountByNameMap = countTypesByName(this.types);
  }

  readTheFactsOfTheFolder(folder, isAFolderOfTheChange) {
    const foundShapeFolder = this.shapes.findShapeFolder(folder);
    if (!foundShapeFolder) return {};
    const isSure = this.isTheShapeSure(foundShapeFolder.shape);
    const exposures = this.findExposures(foundShapeFolder.shape, folder, isAFolderOfTheChange);
    const isSettled = exposure => isSure && Boolean(exposure.opening);
    const appImports = this.findAppImports(foundShapeFolder.shape, folder);
    const spiTypesImplementedInsideTheApp = this.findSpiTypesImplementedInsideTheApp(foundShapeFolder.shape, folder, isAFolderOfTheChange);
    const openFactLinesByKindMap = {
      shape: this.buildShapeLines(foundShapeFolder),
      exposedDomain: this.buildExposedDomainLines(takeFirstFactsWithinTheCap(exposures.filter(exposure => !isSettled(exposure)))),
      spiImplementedInsideApp: isSure ? [] : this.buildSpiTypeLines(takeFirstFactsWithinTheCap(spiTypesImplementedInsideTheApp)),
      appImportsInOut: isSure ? [] : this.buildAppImportLines(takeFirstFactsWithinTheCap(appImports)),
      crossings: this.buildCrossingLines(folder),
    };
    const settledFactsByKindMap = {
      settledExposures: exposures.filter(isSettled).map(exposure => this.buildSettledExposure(exposure)),
      settledAppImports: isSure ? appImports : [],
      settledSpiImplementedInsideApp: isSure ? spiTypesImplementedInsideTheApp : [],
    };
    return {
      ...Object.fromEntries(Object.entries(openFactLinesByKindMap).filter(([, lines]) => lines.length)),
      ...Object.fromEntries(Object.entries(settledFactsByKindMap).filter(([, settledFacts]) => settledFacts.length).map(([key, settledFacts]) => [key, takeFirstFactsWithinTheCap(settledFacts)])),
    };
  }

  isTheShapeSure(shape) {
    if (holdsMostImportsInward(shape)) return true;
    if (!resolvesNoImport(shape)) return false;
    return this.doesInOutCodeImplementAnApiSpiTypeOfTheApp(shape);
  }

  doesInOutCodeImplementAnApiSpiTypeOfTheApp(shape) {
    const inOutFolders = listInOutFolders(shape);
    const apiSpiTypesOfTheApp = this.types.filter(type => type.abstract && isInsideTheApp(type.path, shape));
    return this.types.some(type => isWithinAny(type.path, inOutFolders) && apiSpiTypesOfTheApp.some(apiSpiType => this.implementsTheApiSpiType(type, apiSpiType)));
  }

  implementsTheApiSpiType(type, apiSpiType) {
    const supertypeNames = findSupertypeNamesOfTheApiSpiType(type, apiSpiType);
    if (!supertypeNames.length) return false;
    return this.typeCountByNameMap.get(apiSpiType.name) === 1
      || readFolderPath(type.path) === readFolderPath(apiSpiType.path)
      || this.importsOf(type.path).includes(apiSpiType.path)
      || supertypeNames.some(name => qualifiesTheFolderOf(name, apiSpiType));
  }

  buildShapeLines({ shape, folderKind }) {
    return [
      `this folder: ${folderKind}`,
      `${buildFolderLabel(shape.root)} · ${SHAPE_FOLDER_KINDS.ROOT} · ${shape.family}`,
      ...(shape.app === null ? [] : [`${buildFolderLabel(shape.app)} · ${SHAPE_FOLDER_KINDS.APP}`]),
      ...mapToShapeFolders(shape).map(shapeFolder => `${buildFolderLabel(shapeFolder.folder)} · ${shapeFolder.folderKind}`),
    ];
  }

  buildPlacedLine(filePath, at) {
    const lines = this.readFileLines(filePath);
    return formatPlacedSliceLine(filePath, at + 1, String(lines[at] ?? "").trim());
  }

  findImportLineAt(filePath, target) {
    const lines = this.readFileLines(filePath);
    const targetFileName = nameTheFile(target);
    const driver = findDriver(filePath);
    const namesTheTargetFolder = buildAWholeWordMatcher(readFileName(readFolderPath(target)));
    const lineIndexesByPreference = [
      lines.findIndex(line => line.includes(targetFileName) && (!driver || driver.isImportLine(line))),
      lines.findIndex(line => Boolean(driver) && driver.isImportLine(line) && namesTheTargetFolder(line)),
      lines.findIndex(line => line.includes(targetFileName)),
    ];
    return lineIndexesByPreference.find(index => index >= 0) ?? null;
  }

  buildPlacedImportLine(filePath, target) {
    const importLineIndex = this.findImportLineAt(filePath, target);
    return importLineIndex === null ? filePath : this.buildPlacedLine(filePath, importLineIndex);
  }

  buildHeadLine(type) {
    return this.buildPlacedLine(type.path, type.line - 1);
  }

  listFilesOfTheFolder(folder) {
    return this.paths.filter(filePath => readFolderPath(filePath) === folder);
  }

  crossesIntoAnotherModule(from, target) {
    const targetModule = this.moduleBoundaries.findModuleHoldingTheShape(target);
    return Boolean(targetModule) && this.moduleBoundaries.importsFromAnotherModule(from, targetModule);
  }

  buildCrossingLines(folder) {
    const outgoing = this.listFilesOfTheFolder(folder).flatMap(filePath => this.importsOf(filePath)
      .filter(target => this.crossesIntoAnotherModule(filePath, target))
      .map(target => ({ from: filePath, target, mark: this.moduleBoundaries.buildPublishedMark(target) }))
      .filter(isAnUnpublishedCrossing));
    const incoming = this.listFilesOfTheFolder(folder).flatMap(target => this.moduleBoundaries.listImporters(target)
      .filter(from => this.crossesIntoAnotherModule(from, target))
      .map(from => ({ from, target, mark: this.moduleBoundaries.buildPublishedMark(target) }))
      .filter(isAnUnpublishedCrossing));
    return takeFirstFactsWithinTheCap([...outgoing, ...incoming]).flatMap(({ from, target, mark }) => [
      this.buildPlacedImportLine(from, target),
      `  reaches ${target} · ${mark.text}`,
    ]);
  }

  findOuterRootOfTheShape(shape) {
    const fileInsideTheShape = this.paths.find(filePath => isWithin(filePath, shape.root));
    return fileInsideTheShape ? this.moduleBoundaries.findModuleHoldingTheShape(fileInsideTheShape) : "";
  }

  findApiSpiExposures(shape, domainType) {
    const domainTypeNamePattern = buildWholeWordPattern(domainType.name);
    return this.paths.filter(filePath => isWithinAny(filePath, listApiSpiFolders(shape))).flatMap(apiSpiPath => {
      const publishedMark = this.moduleBoundaries.buildPublishedMark(apiSpiPath);
      if (!publishedMark.published) return [];
      const driver = findDriver(apiSpiPath);
      const lines = this.readFileLines(apiSpiPath);
      const mentionAt = lines.findIndex(line => domainTypeNamePattern.test(line) && !(driver && driver.isImportLine(line)));
      return mentionAt >= 0 ? [{ path: apiSpiPath, at: mentionAt, mark: publishedMark }] : [];
    });
  }

  findExposures(shape, folder, isAFolderOfTheChange) {
    const outerRoot = this.findOuterRootOfTheShape(shape);
    if (!outerRoot) return [];
    const publishedSet = this.moduleBoundaries.readPublishedSet(outerRoot);
    return this.types.filter(type => isWithinAny(type.path, shape.hidden)).flatMap(type => {
      const opening = findOpeningPublishing(publishedSet, type);
      const throughApiSpiFiles = opening ? [] : this.findApiSpiExposures(shape, type);
      if (!opening && !throughApiSpiFiles.length) return [];
      if (findFirstFolderOfTheChange(listFoldersOfTheExposure(type, opening, throughApiSpiFiles, outerRoot), isAFolderOfTheChange) !== folder) return [];
      return [{ type, outerRoot, opening: opening || null, apiSpiType: opening ? null : throughApiSpiFiles[0], users: this.moduleBoundaries.findImportersFromOtherModules(type.path, outerRoot).slice(0, MAX_USERS_NAMED) }];
    });
  }

  buildExposedDomainLines(exposures) {
    return exposures.flatMap(({ type, opening, apiSpiType, users }) => [
      this.buildHeadLine(type),
      opening ? `  published by ${formatPlacedSliceLine(opening.path, opening.line, opening.text)}` : `  named in ${this.buildPlacedLine(apiSpiType.path, apiSpiType.at)} · ${apiSpiType.mark.text}`,
      users.length ? `  used by ${users.join(", ")}` : "  used by no other module",
    ]);
  }

  buildSettledExposure({ type, outerRoot, opening, users }) {
    const lines = this.readFileLines(type.path);
    return {
      type: { name: type.name, path: type.path, line: type.line, text: String(lines[type.line - 1] ?? "").trim() },
      opening: { path: opening.path, line: opening.line, text: opening.text },
      module: outerRoot,
      users,
    };
  }

  buildPlacedAt(filePath, at) {
    return { path: filePath, line: at + 1, text: String(this.readFileLines(filePath)[at] ?? "").trim() };
  }

  findInOutImportsOfTheFile(shape, filePath, inOutFolders) {
    return this.importsOf(filePath)
      .filter(target => isWithinAny(target, inOutFolders))
      .map(target => ({ target, importLineIndex: this.findImportLineAt(filePath, target) }))
      .filter(({ importLineIndex }) => importLineIndex !== null)
      .map(({ target, importLineIndex }) => ({
        importLine: this.buildPlacedAt(filePath, importLineIndex),
        inOutFile: target,
        inOutImport: findTheInOutImportWords(shape, target),
      }));
  }

  findAppImports(shape, folder) {
    const inOutFolders = listInOutFolders(shape);
    return this.listFilesOfTheFolder(folder)
      .filter(filePath => isInsideTheApp(filePath, shape))
      .flatMap(filePath => this.findInOutImportsOfTheFile(shape, filePath, inOutFolders));
  }

  buildAppImportLines(appImports) {
    return appImports.flatMap(({ importLine, inOutFile, inOutImport }) => [formatPlacedSliceLine(importLine.path, importLine.line, importLine.text), `  imports ${inOutFile} ${inOutImport}`]);
  }

  findImplementationsInsideTheApp(apiSpiType, shape) {
    return this.types.filter(type => !type.abstract && this.implementsTheApiSpiType(type, apiSpiType) && isInsideTheApp(type.path, shape));
  }

  findSpiTypesImplementedInsideTheApp(shape, folder, isAFolderOfTheChange) {
    return this.types.filter(type => type.abstract && isWithinAny(type.path, shape.spi)).flatMap(apiSpiType => {
      const implementationsInsideTheApp = this.findImplementationsInsideTheApp(apiSpiType, shape);
      if (!implementationsInsideTheApp.length) return [];
      if (findFirstFolderOfTheChange([readFolderPath(apiSpiType.path), ...implementationsInsideTheApp.map(type => readFolderPath(type.path))], isAFolderOfTheChange) !== folder) return [];
      return [{ apiSpiType: this.buildPlacedAt(apiSpiType.path, apiSpiType.line - 1), apiSpiTypeName: apiSpiType.name, implementations: implementationsInsideTheApp.map(type => ({ ...this.buildPlacedAt(type.path, type.line - 1), name: type.name })) }];
    });
  }

  buildSpiTypeLines(spiTypesImplementedInsideTheApp) {
    return spiTypesImplementedInsideTheApp.flatMap(({ apiSpiType, implementations }) => [
      formatPlacedSliceLine(apiSpiType.path, apiSpiType.line, apiSpiType.text),
      ...implementations.map(implementation => `  implemented by ${formatPlacedSliceLine(implementation.path, implementation.line, implementation.text)} · inside the app`),
    ]);
  }
}
