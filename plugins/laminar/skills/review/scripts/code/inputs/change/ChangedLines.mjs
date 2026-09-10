import { FILE_STATUS, holdsANonBlankLine } from "./Hunk.mjs";
import { countBranchesOfLine } from "../../extract/abstractions/method/generic/measures/MethodMeasures.mjs";

const isAPureRemoval = hunk => hunk.newCount === 0 && holdsANonBlankLine(hunk.removedLines);

export const findAddedLinesOfTheFile = (addedLinesByPathMap, filePath) => addedLinesByPathMap.get(filePath) || new Set();

export const holdsAnAddedLine = (added, from, to) => [...added].some(line => line >= from && line <= to);

const compareByNumber = (left, right) => left - right;

export function countChangedBranches(numberedLines, changedLines) {
  let counted = 0;
  let onChangedLines = 0;
  const lines = [];
  for (const { line, text } of numberedLines) {
    const branchCount = countBranchesOfLine(text);
    if (!branchCount) continue;
    counted += branchCount;
    if (!changedLines.has(line)) continue;
    onChangedLines += branchCount;
    lines.push(line);
  }
  return { counted, onChangedLines, lines };
}

export const groupIntoSpans = numbers => {
  const spans = [];
  for (const number of [...numbers].sort(compareByNumber)) {
    const last = spans[spans.length - 1];
    if (last && number === last[1] + 1) last[1] = number;
    else spans.push([number, number]);
  }
  return spans;
};

const readChangesOfAFile = (file, namesWholeFiles) => ({
  lines: groupIntoSpans(new Set(file.hunks.flatMap(hunk => hunk.numberedAddedLines).map(addedLine => addedLine.line))),
  removedAfter: file.hunks.filter(isAPureRemoval).map(hunk => hunk.newStart),
  added: !namesWholeFiles && file.status === FILE_STATUS.CREATED,
});

const holdsAChange = changes => changes.lines.length > 0 || changes.removedAfter.length > 0 || changes.added;

export const readChangedLinesOfTheChange = (files, { namesWholeFiles = false } = {}) => Object.fromEntries(files
  .map(file => [file.path, readChangesOfAFile(file, namesWholeFiles)])
  .filter(([, changes]) => holdsAChange(changes)));

const NO_CHANGES = Object.freeze({ lines: [], removedAfter: [] });

export class ChangedLines {
  constructor(changesByPathMap) {
    this.changedLinesByPathMap = changesByPathMap || {};
  }

  readChanges(file) {
    return this.changedLinesByPathMap[file] || NO_CHANGES;
  }

  isAdded(file) {
    return Boolean(this.readChanges(file).added);
  }

  isChanged(file, line) {
    return this.readChanges(file).lines.some(([from, to]) => line >= from && line <= to);
  }

  touches(listed) {
    return Object.keys(this.changedLinesByPathMap).some(file => file === listed || file.startsWith(`${listed}/`));
  }

  holdsAnyChange() {
    return Object.keys(this.changedLinesByPathMap).length > 0;
  }

  isRemovedAround(file, line) {
    return this.readChanges(file).removedAfter.some(removedAfter => line === removedAfter || line === removedAfter + 1);
  }

  touchesAPathEndingIn(folder, ending) {
    return Object.keys(this.changedLinesByPathMap)
      .some(file => file.startsWith(`${folder}/`) && (file.endsWith(`/${ending}`) || file.includes(`/${ending}/`)));
  }

  meetsTheChange(file, lines) {
    if (!lines.length) return this.touches(file);
    return lines.some(line => this.isChanged(file, line) || this.isRemovedAround(file, line));
  }
}

export const NO_CHANGED_LINES = new ChangedLines({});
