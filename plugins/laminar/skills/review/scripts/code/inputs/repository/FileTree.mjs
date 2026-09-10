import { readFolderPath } from "../../../files/paths.mjs";

export const THE_REPOSITORY_ROOT = "";

const readChildBelow = (folder, given) => {
  const rest = folder === THE_REPOSITORY_ROOT ? given : given.slice(folder.length + 1);
  const slash = rest.indexOf("/");
  return slash === -1 ? { name: rest, isFolder: false } : { name: rest.slice(0, slash), isFolder: true };
};

const isInside = (given, folder) => folder === THE_REPOSITORY_ROOT || given.startsWith(`${folder}/`);

export const formatChildPath = (folder, child) => `${folder ? `${folder}/` : ""}${child.name}${child.isFolder ? "/" : ""}`;

export class Tree {
  constructor(paths) {
    this.paths = [...new Set(paths)].sort();
    this.folders = new Set([THE_REPOSITORY_ROOT]);
    for (const given of this.paths) {
      for (let folder = readFolderPath(given); folder !== THE_REPOSITORY_ROOT; folder = readFolderPath(folder)) this.folders.add(folder);
    }
  }

  holds(folder) {
    return this.folders.has(folder);
  }

  listChildren(folder) {
    const childrenByNameMap = new Map();
    for (const given of this.paths) {
      if (!isInside(given, folder)) continue;
      const child = readChildBelow(folder, given);
      if (!childrenByNameMap.has(child.name) || child.isFolder) childrenByNameMap.set(child.name, child);
    }
    return [...childrenByNameMap.values()].sort((left, right) => (left.name < right.name ? -1 : 1));
  }
}
