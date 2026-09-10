import { FILE_STATUS } from "./Hunk.mjs";
import { findRepositoryToRead } from "./ChangeReader.mjs";
import { readFolderPath } from "../../../files/paths.mjs";
import { formatChildPath, THE_REPOSITORY_ROOT, Tree } from "../repository/FileTree.mjs";
import { readTrackedPaths } from "../repository/TrackedFiles.mjs";

const MAX_LISTED_CHILDREN = 40;

const ADDING_STATUSES = new Set([FILE_STATUS.CREATED, FILE_STATUS.RENAMED]);

const findPathsAddedBy = files => files.filter(file => ADDING_STATUSES.has(file.status)).map(file => file.path);

const findPathsTakenAwayBy = files => [
  ...files.filter(file => file.status === FILE_STATUS.REMOVED).map(file => file.path),
  ...files.filter(file => file.status === FILE_STATUS.RENAMED && file.oldPath).map(file => file.oldPath),
];

export class CreatedFolders {
  constructor(tracked, files) {
    this.readsTheBase = Array.isArray(tracked);
    if (!this.readsTheBase) return;
    const added = new Set(findPathsAddedBy(files));
    const takenAway = new Set(findPathsTakenAwayBy(files));
    this.before = new Tree([...tracked.filter(given => !added.has(given)), ...takenAway]);
    this.after = new Tree([...tracked.filter(given => !takenAway.has(given)), ...added]);
  }

  static createFromChange(change) {
    const readsTheBase = Boolean(findRepositoryToRead(change)) && !change.namesWholeFiles;
    return new CreatedFolders(readsTheBase ? readTrackedPaths(change.repository) : null, change.files);
  }

  isCreated(folder) {
    return this.readsTheBase && folder !== THE_REPOSITORY_ROOT && !this.before.holds(folder);
  }

  findTopCreated(folder) {
    let top = folder;
    while (this.isCreated(readFolderPath(top))) top = readFolderPath(top);
    return top;
  }

  findPathEnd(top) {
    let end = top;
    for (let children = this.after.listChildren(end); children.length === 1 && children[0].isFolder; children = this.after.listChildren(end)) {
      end = `${end}/${children[0].name}`;
    }
    return end;
  }

  readCreatedSubfoldersByJoinedFolder(changedFolders) {
    const topsByJoinedFolderMap = new Map();
    for (const folder of changedFolders) {
      if (!this.isCreated(folder)) continue;
      const top = this.findTopCreated(folder);
      const joined = readFolderPath(top);
      if (joined === THE_REPOSITORY_ROOT) continue;
      if (!topsByJoinedFolderMap.has(joined)) topsByJoinedFolderMap.set(joined, new Set());
      topsByJoinedFolderMap.get(joined).add(top);
    }
    return new Map([...topsByJoinedFolderMap].map(([joined, tops]) => [joined, [...tops].sort().map(top => this.buildCreatedSubfolder(top))]));
  }

  joinsAFolder(folder) {
    return this.isCreated(folder) && readFolderPath(this.findTopCreated(folder)) !== THE_REPOSITORY_ROOT;
  }

  buildCreatedSubfolder(top) {
    const end = this.findPathEnd(top);
    const children = this.after.listChildren(end);
    const holds = children.slice(0, MAX_LISTED_CHILDREN).map(child => formatChildPath(end, child));
    return { subfolder: top, holds, ...(children.length > MAX_LISTED_CHILDREN ? { stopped: true } : {}) };
  }

  findPathEndsReadAlone(changedFolders) {
    const tops = new Set([...changedFolders].filter(folder => this.isCreated(folder)).map(folder => this.findTopCreated(folder)));
    return [...tops]
      .filter(top => readFolderPath(top) !== THE_REPOSITORY_ROOT)
      .map(top => this.findPathEnd(top))
      .filter(end => !changedFolders.has(end));
  }

}
