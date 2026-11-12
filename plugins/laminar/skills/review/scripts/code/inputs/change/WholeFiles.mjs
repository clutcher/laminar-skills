import { FILE_STATUS } from "./Hunk.mjs";
import { renamesTheFile } from "./AbstractionChange.mjs";
import { convertToPathPrefix, readFolderPath } from "../../../files/paths.mjs";

const liesInside = (given, prefix) => !prefix || given === prefix || given.startsWith(`${prefix}/`);

const isNamedBy = (file, namedPath) => file.path === namedPath || file.oldPath === namedPath;

const NO_FILES = Object.freeze({ namedPaths: [], renamedPaths: [], pathsAboveTheMethod: [], unchangedPaths: [], namedFolders: [] });

export class WholeFiles {
  constructor({ namedPaths, renamedPaths, pathsAboveTheMethod, unchangedPaths, namedFolders }) {
    this.namedPaths = namedPaths;
    this.renamedPaths = new Set(renamedPaths);
    this.pathsAboveTheMethod = new Set(pathsAboveTheMethod);
    this.unchangedPaths = unchangedPaths;
    this.namedFolders = namedFolders;
  }

  static createNone() {
    return new WholeFiles(NO_FILES);
  }

  static listPathsOutsideTheFiles(wholeFilePaths, filesPaths) {
    const prefixes = filesPaths.map(convertToPathPrefix);
    if (!prefixes.length) return [];
    return wholeFilePaths.filter(given => !prefixes.some(prefix => liesInside(convertToPathPrefix(given), prefix)));
  }

  // A file the range renamed to another stem is judged at every scale; a file moved with the same stem, like every other named file, above the method.
  static createFromTheChange(wholeFilePaths, change, createdFolders) {
    const found = { namedPaths: [], renamedPaths: [], pathsAboveTheMethod: [], unchangedPaths: [], namedFolders: [] };
    for (const namedPath of [...new Set(wholeFilePaths.map(convertToPathPrefix))]) {
      const file = change.files.find(changedFile => changedFile.existsAfterTheChange && isNamedBy(changedFile, namedPath));
      if (file && file.status === FILE_STATUS.RENAMED && renamesTheFile(file)) { found.renamedPaths.push(file.path); continue; }
      found.namedPaths.push(namedPath);
      if (file) found.pathsAboveTheMethod.push(file.path);
      else if (createdFolders.holdsTheFileAfterTheChange(namedPath)) { found.pathsAboveTheMethod.push(namedPath); found.unchangedPaths.push(namedPath); }
      else if (createdFolders.existsAfterTheChange(namedPath)) found.namedFolders.push(namedPath);
    }
    return new WholeFiles(found);
  }

  get namesAnyPath() {
    return this.namedPaths.length > 0 || this.renamedPaths.size > 0;
  }

  isWholeAtEveryScale(filePath) {
    return this.renamedPaths.has(filePath);
  }

  isWholeAboveTheMethod(filePath) {
    return this.pathsAboveTheMethod.has(filePath);
  }

  isJudgedWhole(filePath) {
    return this.isWholeAtEveryScale(filePath) || this.isWholeAboveTheMethod(filePath);
  }

  listUnchangedPaths() {
    return this.unchangedPaths;
  }

  listModuleFolders() {
    return [...new Set([...this.namedFolders, ...[...this.renamedPaths, ...this.pathsAboveTheMethod].map(readFolderPath)])];
  }

  toJSON() {
    return { paths: this.namedPaths, renamed: [...this.renamedPaths] };
  }
}
