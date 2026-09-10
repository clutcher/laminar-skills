import { SourceText } from "../source/SourceText.mjs";

export const isShown = newLine => newLine.added !== false;

const findAddedAndTextOpeningLines = (hunk, source) => hunk.newLines.filter(newLine => newLine.added || source.textOpeningLines.has(newLine.line));

function collectReadings(changedFile, source) {
  if (!changedFile.isReadableBy(source.driver)) return [];
  return changedFile.readNumberedReadings(hunk => findAddedAndTextOpeningLines(hunk, source));
}

export function createSourceTextOfChangedFile(changedFile, driver) {
  const source = new SourceText({
    path: changedFile.path,
    driver,
    lines: changedFile.lines,
    stretches: driver ? changedFile.textStretches : [],
    lastLine: changedFile.lastLine,
  });
  source.readings = collectReadings(changedFile, source);
  return source;
}
