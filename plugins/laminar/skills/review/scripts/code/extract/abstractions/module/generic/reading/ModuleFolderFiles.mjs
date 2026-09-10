import fs from "node:fs";
import { joinFilesystemPath } from "../../../../../../files/paths.mjs";
import { isAFolderNeverWalked } from "../../../../../inputs/repository/RepositoryFileKinds.mjs";

const MAX_HEAD_LINES = 400;

export class ModuleFolderFiles {
  constructor(repository) {
    this.repository = repository;
    this.childrenByFolderMap = new Map();
    this.linesByFileMap = new Map();
  }

  listChildren(folder) {
    if (!this.repository) return [];
    if (this.childrenByFolderMap.has(folder)) return this.childrenByFolderMap.get(folder);
    let children = [];
    try {
      children = fs.readdirSync(joinFilesystemPath(this.repository, folder || "."), { withFileTypes: true })
        .filter(child => !child.name.startsWith("."))
        .map(child => ({ name: child.name, isFolder: child.isDirectory(), path: folder ? `${folder}/${child.name}` : child.name }))
        .sort((left, right) => left.name.localeCompare(right.name));
    } catch { children = []; }
    this.childrenByFolderMap.set(folder, children);
    return children;
  }

  readFileLines(filePath) {
    if (this.linesByFileMap.has(filePath)) return this.linesByFileMap.get(filePath);
    let lines = [];
    try { lines = fs.readFileSync(joinFilesystemPath(this.repository, filePath), "utf8").split(/\r?\n/).slice(0, MAX_HEAD_LINES); }
    catch { lines = []; }
    this.linesByFileMap.set(filePath, lines);
    return lines;
  }

  listFiles(folder) {
    return this.listChildren(folder).filter(child => !child.isFolder);
  }

  listFolders(folder) {
    return this.listChildren(folder).filter(child => child.isFolder && !isAFolderNeverWalked(child.name));
  }
}
