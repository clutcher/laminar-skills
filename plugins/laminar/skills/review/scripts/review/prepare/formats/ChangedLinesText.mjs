import { ChangedLines, groupIntoSpans } from "../../../code/index.mjs";

export const NO_CHANGED_LINE = "none";

export const REMOVED_AFTER = "removed after";

export const ADDED = "added";

export const LISTED = "listed";

const formatSpanText = ([from, to]) => (from === to ? String(from) : `${from}-${to}`);

const groupShownLinesByFile = places => {
  const shownLinesByFileMap = new Map();
  for (const place of places) {
    if (!shownLinesByFileMap.has(place.file)) shownLinesByFileMap.set(place.file, new Set());
    shownLinesByFileMap.get(place.file).add(Number(place.line) || 0);
  }
  return shownLinesByFileMap;
};

const prefixWithFile = (file, ownPath) => text => (file === ownPath ? text : `${file}:${text}`);

export class ChangedLinesText extends ChangedLines {
  formatListedFile(file) {
    return this.isAdded(file) ? `${file} ${ADDED}` : file;
  }

  listChangedSpans(file, shown, ownPath) {
    const numbered = [...shown].filter(line => line > 0 && this.isChanged(file, line));
    const spans = groupIntoSpans(numbered).map(formatSpanText).map(prefixWithFile(file, ownPath));
    if (shown.has(0) && this.touches(file)) spans.push(this.formatListedFile(file));
    return spans;
  }

  listRemovedLines(file, shown, ownPath) {
    const numbered = new Set([...shown].filter(line => line > 0));
    return this.readChanges(file).removedAfter
      .filter(line => numbered.has(line) || numbered.has(line + 1))
      .map(line => prefixWithFile(file, ownPath)(String(line)));
  }

  formatListedInTheFile(file, lines) {
    const shown = new Set(lines.map(line => Number(line) || 0));
    const numbered = groupIntoSpans([...shown].filter(line => line > 0 && this.isChanged(file, line))).map(formatSpanText);
    const listed = shown.has(0) && this.touches(file) ? [this.isAdded(file) ? ADDED : LISTED] : [];
    const changed = [...numbered, ...listed];
    const removed = this.listRemovedLines(file, shown, file);
    const words = changed.length ? changed.join(", ") : NO_CHANGED_LINE;
    return removed.length ? `${words} · ${REMOVED_AFTER} ${removed.join(", ")}` : words;
  }

  formatListedLines(ownPath, places) {
    const shown = groupShownLinesByFile(places);
    const files = [...shown.keys()].sort((left, right) => (left === ownPath ? -1 : right === ownPath ? 1 : 0));
    const changed = files.flatMap(file => this.listChangedSpans(file, shown.get(file), ownPath));
    const removed = files.flatMap(file => this.listRemovedLines(file, shown.get(file), ownPath));
    const listed = changed.length ? changed.join(", ") : NO_CHANGED_LINE;
    return removed.length ? `${listed} · ${REMOVED_AFTER} ${removed.join(", ")}` : listed;
  }
}

export const NO_CHANGED_LINES_TEXT = new ChangedLinesText({});
