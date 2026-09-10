import path from "node:path";
import { numberFileLines } from "../source/SourceText.mjs";

export const holdsANonBlankLine = lines => lines.some(line => line.trim());

export const FILE_STATUS = Object.freeze({ CREATED: "CREATED", REMOVED: "REMOVED", RENAMED: "RENAMED", CHANGED: "CHANGED" });

export class Hunk {
  constructor(newStart, newCount, context) {
    Object.assign(this, { newStart, newCount, context, newLines: [], removedLines: [], oldLines: [] });
  }

  addRemovedLine(text) {
    this.removedLines.push(text);
    this.oldLines.push({ text, removed: true, beforeNewLine: this.newStart + this.newLines.length });
  }

  addAddedLine(text) {
    this.keepNewLine(text, true);
  }

  addContextLine(text) {
    this.keepNewLine(text, false);
  }

  keepNewLine(text, added) {
    this.newLines.push({ line: this.newStart + this.newLines.length, text, added });
    if (!added) this.oldLines.push({ text, removed: false });
  }

  get changedLineBounds() {
    const added = this.numberedAddedLines;
    return added.length ? { from: added[0].line, to: added[added.length - 1].line } : { from: this.newStart, to: this.lastLine };
  }

  get numberedAddedLines() {
    return this.newLines.filter(newLine => newLine.added);
  }

  get addedLines() {
    return this.numberedAddedLines.map(numberedAddedLine => numberedAddedLine.text);
  }

  findAddedLineAt(line) {
    const newLine = this.newLines[line - this.newStart];
    return newLine && newLine.added ? newLine : null;
  }

  findAddedLinesWithin(from, to) {
    return this.numberedAddedLines.filter(numberedAddedLine => numberedAddedLine.line >= from && numberedAddedLine.line <= to).map(numberedAddedLine => numberedAddedLine.text);
  }

  findNumberedRemovedLinesWithin(from, to) {
    const last = to === this.lastLine ? to + 1 : to;
    return this.oldLines
      .filter(oldLine => oldLine.removed && oldLine.beforeNewLine >= from && oldLine.beforeNewLine <= last)
      .map(oldLine => ({ line: oldLine.beforeNewLine, text: oldLine.text }));
  }

  findRemovedLinesWithin(from, to) {
    return this.findNumberedRemovedLinesWithin(from, to).map(removedLine => removedLine.text);
  }

  get holdsEveryNewLine() {
    return this.newLines.length >= this.newCount;
  }

  get lastLine() {
    return this.newStart + Math.max(this.newCount, 1) - 1;
  }

  covers(line) {
    return this.newStart <= line && line <= this.lastLine;
  }

  holdsChange() {
    return holdsANonBlankLine(this.addedLines) || holdsANonBlankLine(this.removedLines);
  }

  toJSON() {
    return { newStart: this.newStart, newCount: this.newCount, context: this.context, newLines: this.newLines, removedLines: this.removedLines, oldLines: this.oldLines };
  }

  static createFromJSON(saved) {
    return Object.assign(new Hunk(saved.newStart, saved.newCount, saved.context), {
      newLines: saved.newLines.map(newLine => ({ ...newLine })),
      removedLines: [...saved.removedLines],
      oldLines: saved.oldLines.map(oldLine => ({ ...oldLine })),
    });
  }
}

export class ChangedFile {
  constructor(filePath, oldPath, status) {
    Object.assign(this, { path: filePath, oldPath, status, hunks: [], lines: null });
  }

  get folderChanged() {
    return this.oldPath !== null && path.posix.dirname(this.oldPath) !== path.posix.dirname(this.path);
  }

  get holdsTheWholeText() {
    return Boolean(this.lines);
  }

  get isNamedByTheChange() {
    return this.status === FILE_STATUS.CREATED || this.status === FILE_STATUS.RENAMED;
  }

  get existsAfterTheChange() {
    return this.status !== FILE_STATUS.REMOVED;
  }

  readTheKnownText(readTheWholeText, readTheHunks) {
    return this.holdsTheWholeText ? readTheWholeText(this.numberedText) : readTheHunks(this.hunks);
  }

  get numberedText() {
    if (!this.numberedTextRead) this.numberedTextRead = numberFileLines(this.lines);
    return this.numberedTextRead;
  }

  collectAddedLineNumbers() {
    return new Set(this.hunks.flatMap(hunk => hunk.numberedAddedLines).map(addedLine => addedLine.line));
  }

  isReadableBy(driver) {
    if (!driver) return false;
    return this.existsAfterTheChange;
  }

  readNumberedLines() {
    return this.readTheKnownText(text => text, hunks => hunks.flatMap(hunk => hunk.numberedAddedLines));
  }

  readNumberedNewLines() {
    return this.readTheKnownText(text => text, hunks => hunks.flatMap(hunk => hunk.newLines));
  }

  readNumberedLinesAround(hunk) {
    return this.readTheKnownText(text => text, () => hunk.newLines);
  }

  readNumberedReadings(linesOfAHunk) {
    return this.readTheKnownText(text => [text], hunks => hunks.map(linesOfAHunk));
  }

  get textStretches() {
    return this.readTheKnownText(() => [{ first: 1, lines: this.lines }], hunks => hunks.map(hunk => ({ first: hunk.newStart, lines: hunk.newLines.map(newLine => newLine.text) })));
  }

  readLinesWithin(span) {
    return this.readTheKnownText(() => this.lines.slice(span.from - 1, span.to), () => []);
  }

  get lastLine() {
    if (this.lines) return this.lines.length;
    return this.hunks.reduce((highest, hunk) => Math.max(highest, hunk.lastLine), 1);
  }

  toJSON() {
    return { path: this.path, oldPath: this.oldPath, status: this.status, hunks: this.hunks.map(hunk => hunk.toJSON()) };
  }

  static createFromJSON(saved) {
    return Object.assign(new ChangedFile(saved.path, saved.oldPath, saved.status), { hunks: saved.hunks.map(Hunk.createFromJSON) });
  }
}
