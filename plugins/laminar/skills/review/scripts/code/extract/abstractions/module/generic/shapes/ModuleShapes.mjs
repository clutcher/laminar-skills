import { IN_OUT_SIDES, API_SPI_SIDES, ROLE_KINDS } from "../../../../../graph/abstractions/Role.mjs";
import { readFolderPath } from "../../../../../../files/paths.mjs";
import { listAncestors } from "../reading/FolderPaths.mjs";
import { SHAPE_FOLDER_KINDS } from "./ShapeFolderKinds.mjs";

const listNoImports = () => [];

export const isWithin = (filePath, folder) => folder === "" || filePath === folder || filePath.startsWith(`${folder}/`);

export const isWithinAny = (filePath, folders) => folders.some(folder => isWithin(filePath, folder));

export const listApiSpiFolders = shape => [...shape.api, ...shape.spi, ...shape.apiSpi];

export const listInOutFolders = shape => [...shape.in, ...shape.out, ...shape.inOut];

export const listAppSideFolders = shape => (shape.app === null ? [...listApiSpiFolders(shape), ...shape.hidden] : [shape.app]);

export class FolderTree {
  constructor(paths) {
    this.paths = [...new Set(paths)].sort();
    this.childNamesByFolderMap = new Map();
    for (const filePath of this.paths) {
      let childPath = filePath;
      for (let folder = readFolderPath(filePath); ; folder = readFolderPath(folder)) {
        if (childPath !== filePath) this.noteChild(folder, childPath.slice(folder ? folder.length + 1 : 0));
        if (folder === "") break;
        childPath = folder;
      }
    }
  }

  noteChild(folder, name) {
    if (!this.childNamesByFolderMap.has(folder)) this.childNamesByFolderMap.set(folder, new Set());
    this.childNamesByFolderMap.get(folder).add(name);
  }

  listEveryFolder() {
    return [...this.childNamesByFolderMap.keys()].sort();
  }

  listChildNames(folder) {
    return [...(this.childNamesByFolderMap.get(folder) || [])].sort();
  }

  findChildNamed(folder, word) {
    return this.listChildNames(folder).find(name => name.toLowerCase() === word) ?? null;
  }

  listFilesWithin(folder) {
    return this.paths.filter(filePath => isWithin(filePath, folder));
  }
}

const FOLDER_KIND_OF_EACH_SHAPE_KEY_IN_ORDER = Object.freeze([
  ["api", SHAPE_FOLDER_KINDS.API],
  ["spi", SHAPE_FOLDER_KINDS.SPI],
  ["apiSpi", SHAPE_FOLDER_KINDS.API_SPI],
  ["in", SHAPE_FOLDER_KINDS.IN_CODE],
  ["out", SHAPE_FOLDER_KINDS.OUT_CODE],
  ["inOut", SHAPE_FOLDER_KINDS.IN_OUT_CODE],
  ["hidden", SHAPE_FOLDER_KINDS.HIDDEN],
]);

export const mapToShapeFolders = shape => FOLDER_KIND_OF_EACH_SHAPE_KEY_IN_ORDER.flatMap(([key, folderKind]) => (shape[key] || []).map(folder => ({ folder, folderKind })));

const ROLE_OF_FOLDER_KIND = Object.freeze({
  [SHAPE_FOLDER_KINDS.API]: { kind: ROLE_KINDS.API_SPI, facts: { side: API_SPI_SIDES.OFFERED } },
  [SHAPE_FOLDER_KINDS.SPI]: { kind: ROLE_KINDS.API_SPI, facts: { side: API_SPI_SIDES.NEEDED } },
  [SHAPE_FOLDER_KINDS.API_SPI]: { kind: ROLE_KINDS.API_SPI, facts: {} },
  [SHAPE_FOLDER_KINDS.IN_CODE]: { kind: ROLE_KINDS.IN_OUT_CODE, facts: { side: IN_OUT_SIDES.IN } },
  [SHAPE_FOLDER_KINDS.OUT_CODE]: { kind: ROLE_KINDS.IN_OUT_CODE, facts: { side: IN_OUT_SIDES.OUT } },
  [SHAPE_FOLDER_KINDS.IN_OUT_CODE]: { kind: ROLE_KINDS.IN_OUT_CODE, facts: {} },
  [SHAPE_FOLDER_KINDS.HIDDEN]: { kind: null, facts: {} },
  [SHAPE_FOLDER_KINDS.APP]: { kind: ROLE_KINDS.APPLICATION_CORE, facts: {} },
});

const liesInsideAShapeFolderOf = (folder, shape) => mapToShapeFolders(shape).some(shapeFolder => isWithin(folder, shapeFolder.folder)) || (shape.app !== null && isWithin(folder, shape.app));

const keepTheOutermost = shapes => shapes.filter(shape => !shapes.some(other => other !== shape && liesInsideAShapeFolderOf(shape.root, other)));

export class ModuleShapes {
  static createNone() {
    return new ModuleShapes([]);
  }

  static findShapes(shapeFinders, paths, importsOf = listNoImports) {
    const tree = new FolderTree(paths);
    const shapesOfEveryFinder = shapeFinders.flatMap(finder => finder.findShapesIn(tree, importsOf).map(shape => ({ ...shape, foundBy: finder.name })));
    return new ModuleShapes(keepTheOutermost(shapesOfEveryFinder));
  }

  static createFromJSON(saved) {
    return new ModuleShapes(saved || []);
  }

  constructor(shapes) {
    this.shapes = Object.freeze([...shapes]);
    this.shapeByRootMap = new Map(this.shapes.map(shape => [shape.root, shape]));
  }

  toJSON() {
    return this.shapes.map(shape => ({ ...shape }));
  }

  findShapeHolding(folder) {
    const root = listAncestors(folder).find(ancestor => this.shapeByRootMap.has(ancestor));
    return root === undefined ? null : this.shapeByRootMap.get(root);
  }

  findShapeFolder(folder) {
    const shape = this.findShapeHolding(folder);
    if (!shape) return null;
    if (folder === shape.root) return { shape, folderKind: SHAPE_FOLDER_KINDS.ROOT, folder: shape.root };
    const holdingShapeFolder = mapToShapeFolders(shape).find(shapeFolder => isWithin(folder, shapeFolder.folder));
    if (holdingShapeFolder) return { shape, folderKind: holdingShapeFolder.folderKind, folder: holdingShapeFolder.folder };
    if (shape.app !== null && isWithin(folder, shape.app)) return { shape, folderKind: SHAPE_FOLDER_KINDS.APP, folder: shape.app };
    return { shape, folderKind: SHAPE_FOLDER_KINDS.OTHER, folder: shape.root };
  }

  findFolderRole(folder) {
    const foundShapeFolder = this.findShapeFolder(folder);
    if (!foundShapeFolder) return null;
    const role = ROLE_OF_FOLDER_KIND[foundShapeFolder.folderKind];
    if (!role) return null;
    const isTheShapeFolder = folder === foundShapeFolder.folder;
    if (foundShapeFolder.folderKind === SHAPE_FOLDER_KINDS.APP && !isTheShapeFolder) return { kind: null, facts: {} };
    return {
      kind: role.kind,
      facts: role.facts,
      detail: foundShapeFolder.folderKind,
      foundBy: foundShapeFolder.shape.foundBy,
      evidence: `the hexagonal shape at ${foundShapeFolder.shape.root || "."}: ${foundShapeFolder.shape.family}`,
    };
  }
}
