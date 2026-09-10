import { CHANGE_MODES } from "../change/ChangeReader.mjs";
import { findDiffDriver, readLanguageFamily } from "../source/drivers/LanguageRegistry.mjs";
import { splitTextIntoLines } from "../source/SourceText.mjs";
import { readTextOf } from "./RepositoryFiles.mjs";
import { isMinified } from "./RepositoryFileKinds.mjs";
import { CachedSourceIndex } from "./index/CachedSourceIndex.mjs";

export class RepositoryText {
  constructor(repository, mode, changedFiles, { cachedSourceIndex = new CachedSourceIndex(repository) } = {}) {
    this.repository = repository;
    this.mode = mode;
    this.changedFiles = changedFiles;
    this.cachedSourceIndex = cachedSourceIndex;
    this.patchLines = this.mode === CHANGE_MODES.PATCH ? this.readPatchLines() : null;
  }

  readPatchLines() {
    const lines = [];
    for (const file of this.changedFiles) {
      for (const hunk of file.hunks) {
        for (const { line, text } of hunk.numberedAddedLines) lines.push({ path: file.path, line, text });
      }
    }
    return lines;
  }

  readSourceIndex() {
    return this.cachedSourceIndex.readSourceIndex();
  }

  readPatchReadable() {
    if (this.patchFiles) return this.patchFiles;
    const kept = [];
    let minified = 0;
    for (const given of [...new Set(this.changedFiles.map(file => file.path))].filter(filePath => findDiffDriver(filePath))) {
      const text = this.buildPatchText(given);
      if (text === null) continue;
      if (isMinified(given, splitTextIntoLines(text))) { minified++; continue; }
      kept.push(given);
    }
    this.patchFiles = { kept, minified };
    return this.patchFiles;
  }

  readListedFiles() {
    if (this.mode === CHANGE_MODES.PATCH) return this.readPatchReadable().kept;
    return this.mode === CHANGE_MODES.REPOSITORY ? this.readSourceIndex().readListedFiles() : [];
  }

  countMinified() {
    if (this.mode === CHANGE_MODES.PATCH) return this.readPatchReadable().minified;
    return this.mode === CHANGE_MODES.REPOSITORY ? this.readSourceIndex().countMinified() : 0;
  }

  listFamilies() {
    return [...new Set(this.readListedFiles().map(readLanguageFamily))];
  }

  buildPatchText(given) {
    const lines = [];
    for (const patchLine of this.patchLines.filter(line => line.path === given)) lines[patchLine.line - 1] = patchLine.text;
    return lines.length ? Array.from(lines, line => line || "").join("\n") : null;
  }

  readFileLines(given) {
    if (this.mode === CHANGE_MODES.PATCH) {
      const text = this.buildPatchText(given);
      return text === null ? null : splitTextIntoLines(text);
    }
    const indexed = this.mode === CHANGE_MODES.REPOSITORY ? this.readSourceIndex().readFileLines(given) : null;
    if (indexed) return indexed;
    const text = readTextOf(this.repository, given);
    return text === null ? null : splitTextIntoLines(text);
  }
}
