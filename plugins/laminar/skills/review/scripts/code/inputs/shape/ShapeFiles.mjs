import fs from "node:fs";
import { joinFilesystemPath } from "../../../files/paths.mjs";
import { FILE_STATUS } from "../change/Hunk.mjs";
import { readTrackedPaths } from "../repository/TrackedFiles.mjs";
import { SHAPE_KINDS } from "./ShapeModel.mjs";
import { formatTheClassesOfTheFile } from "./ShapeClassText.mjs";

const FILE_STATUS_BY_SHAPE_KIND_MAP = Object.freeze({
  [SHAPE_KINDS.CREATED]: FILE_STATUS.CREATED,
  [SHAPE_KINDS.MOVED]: FILE_STATUS.RENAMED,
  [SHAPE_KINDS.MODIFIED]: FILE_STATUS.CHANGED,
  [SHAPE_KINDS.REMOVED]: FILE_STATUS.REMOVED,
});

const isHidden = name => name.startsWith(".");

function listFilesBelow(repository, folder) {
  let children;
  try {
    children = fs.readdirSync(joinFilesystemPath(repository, folder || "."), { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const child of children) {
    if (isHidden(child.name)) continue;
    const childPath = folder ? `${folder}/${child.name}` : child.name;
    if (child.isDirectory()) found.push(...listFilesBelow(repository, childPath));
    else if (child.isFile()) found.push(childPath);
  }
  return found;
}

export const readBasePaths = repository => readTrackedPaths(repository) || listFilesBelow(repository, "");

const joinChildPath = (folder, name) => (folder ? `${folder}/${name}` : name);

const groupByFile = shapeClasses => {
  const classesByFileMap = new Map();
  for (const shapeClass of shapeClasses) classesByFileMap.set(shapeClass.file, [...(classesByFileMap.get(shapeClass.file) || []), shapeClass]);
  return classesByFileMap;
};

export class ShapeFiles {
  constructor(shapeModel, basePaths) {
    this.basePaths = new Set(basePaths);
    this.childByPathMap = new Map(shapeModel.folders.flatMap(folder => folder.children.map(child => [joinChildPath(folder.path, child.name), child])));
    this.renderedByFileMap = new Map([...groupByFile(shapeModel.classes)].map(([file, shapeClasses]) => [file, formatTheClassesOfTheFile(shapeClasses)]));
  }

  readKindOfTheFile(filePath) {
    const child = this.childByPathMap.get(filePath);
    if (child) return child.kind;
    return this.basePaths.has(filePath) ? SHAPE_KINDS.MODIFIED : SHAPE_KINDS.CREATED;
  }

  readOldPathOf(filePath) {
    return (this.childByPathMap.get(filePath) || {}).oldPath || null;
  }

  readRenderedLinesOf(filePath) {
    return (this.renderedByFileMap.get(filePath) || { lines: [] }).lines;
  }

  listChangedFiles() {
    const paths = [...new Set([...this.childByPathMap.keys(), ...this.renderedByFileMap.keys()])];
    return paths
      .filter(filePath => this.readKindOfTheFile(filePath) !== SHAPE_KINDS.UNCHANGED)
      .map(filePath => this.describeTheChangedFile(filePath));
  }

  describeTheChangedFile(filePath) {
    const kind = this.readKindOfTheFile(filePath);
    const oldPath = this.readOldPathOf(filePath);
    return {
      path: filePath,
      kind,
      status: FILE_STATUS_BY_SHAPE_KIND_MAP[kind],
      ...(oldPath ? { oldPath } : {}),
      lines: this.readRenderedLinesOf(filePath),
      existsAfterTheChange: kind !== SHAPE_KINDS.REMOVED,
    };
  }

  listPathsAfterTheShape() {
    const changed = this.listChangedFiles();
    const takenAway = new Set([...changed.filter(file => !file.existsAfterTheChange).map(file => file.path), ...changed.map(file => file.oldPath).filter(Boolean)]);
    const added = changed.filter(file => file.existsAfterTheChange).map(file => file.path);
    return [...new Set([...[...this.basePaths].filter(basePath => !takenAway.has(basePath)), ...added])];
  }

  listClassPlacements() {
    return [...this.renderedByFileMap].flatMap(([filePath, rendered]) => rendered.placements.map(placement => ({ ...placement, path: filePath, kind: this.readKindOfTheFile(filePath) })));
  }
}
