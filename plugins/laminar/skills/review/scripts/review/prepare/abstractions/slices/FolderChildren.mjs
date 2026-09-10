import { CHANGE_KINDS, formatChildPath, FILE_STATUS, listFolderChildPaths, listFolderFileNames, listFolderSubfolderNames, findRepositoryToRead, Tree } from "../../../../code/index.mjs";
import { readFileName, readFolderPath } from "../../../../files/paths.mjs";
import { FROM_THE_CHANGE_ONLY, readListedPath } from "../../formats/SliceFormat.mjs";

const ADDING_STATUSES = new Set([FILE_STATUS.CREATED, FILE_STATUS.RENAMED]);

export class FolderChildren {
  constructor(change, pathsShownAfterTheChange) {
    this.change = change;
    this.treeShownByTheChange = new Tree(pathsShownAfterTheChange);
  }

  isReadForItsParts(abstraction) {
    return abstraction.changeKind === CHANGE_KINDS.CREATED || this.listAddedFileNamesIn(abstraction.path).size > 0;
  }

  countDirectChildren(folder) {
    const repository = findRepositoryToRead(this.change);
    const read = repository ? listFolderChildPaths(repository, folder) : [];
    const childCount = read.length ? read.length : this.treeShownByTheChange.listChildren(folder).length;
    return { children: childCount, files: this.listFileNamesOf(folder).length };
  }

  listAddedFileNamesIn(folder) {
    return new Set(this.change.files
      .filter(file => ADDING_STATUSES.has(file.status) && readFolderPath(file.path) === folder)
      .map(file => readFileName(file.path)));
  }

  listFileNamesOf(folder) {
    const repository = findRepositoryToRead(this.change);
    const read = repository ? listFolderFileNames(repository, folder) : [];
    return read.length ? read : this.treeShownByTheChange.listChildren(folder).filter(child => !child.isFolder).map(child => child.name);
  }

  readFileList(folder) {
    const read = this.readRepositoryFileList(folder);
    return read.length ? read : this.buildChangeFileList(folder);
  }

  readFileListOneLevelDeeper(folder) {
    const childrenOfTheSubfolders = this.listSubfolderPathsOf(folder)
      .flatMap(subfolder => this.readFileList(subfolder).filter(line => line !== FROM_THE_CHANGE_ONLY));
    return [...this.readFileList(folder), ...childrenOfTheSubfolders];
  }

  listSubfolderPathsOf(folder) {
    const repository = findRepositoryToRead(this.change);
    const read = repository ? listFolderSubfolderNames(repository, folder) : [];
    const names = read.length ? read : this.treeShownByTheChange.listChildren(folder).filter(child => child.isFolder).map(child => child.name);
    return names.map(name => (folder ? `${folder}/${name}` : name));
  }

  readRepositoryFileList(folder) {
    const repository = findRepositoryToRead(this.change);
    return repository ? listFolderChildPaths(repository, folder) : [];
  }

  buildChangeFileList(folder) {
    const childPaths = this.treeShownByTheChange.listChildren(folder).map(child => formatChildPath(folder, child));
    return childPaths.length ? [FROM_THE_CHANGE_ONLY, ...childPaths] : [];
  }

  listSiblingsShown(abstraction) {
    return (abstraction.module || {}).joinsAFolder ? [] : this.listSiblings(abstraction.path);
  }

  listSiblings(folder) {
    if (!folder) return [];
    const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
    const siblings = this.readFileList(parent).filter(name => readListedPath(name) !== folder);
    return siblings.some(name => name !== FROM_THE_CHANGE_ONLY) ? siblings : [];
  }
}
