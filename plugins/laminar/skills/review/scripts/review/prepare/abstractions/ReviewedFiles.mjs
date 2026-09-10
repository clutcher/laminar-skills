import { findAddedLinesOfTheFile } from "../../../code/index.mjs";

export class ReviewedFiles {
  constructor(change) {
    this.filesByPathMap = new Map(change.files.map(file => [file.path, file]));
    this.addedLinesByPathMap = change.readAddedLinesByPath();
  }

  collectChangedPaths() {
    return new Set(this.filesByPathMap.keys());
  }

  holds(filePath) {
    return this.filesByPathMap.has(filePath);
  }

  findFileAt(filePath) {
    return this.filesByPathMap.get(filePath) || null;
  }

  readFileLines(filePath) {
    const file = this.findFileAt(filePath);
    return file ? file.lines || null : null;
  }

  readAddedLines(filePath) {
    return findAddedLinesOfTheFile(this.addedLinesByPathMap, filePath);
  }
}
