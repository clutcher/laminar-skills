const sortByNewStart = hunks => [...hunks].sort((left, right) => left.newStart - right.newStart);

const findFirstNewLineOf = hunk => (hunk.newLines.length ? hunk.newStart : hunk.newStart + 1);

function rebuildTheWholeTextBefore(lines, hunks) {
  const before = [];
  let next = 1;
  for (const hunk of sortByNewStart(hunks)) {
    const first = findFirstNewLineOf(hunk);
    while (next < first) before.push(lines[next++ - 1]);
    before.push(...hunk.oldLines.map(oldLine => oldLine.text));
    next = first + hunk.newLines.length;
  }
  while (next <= lines.length) before.push(lines[next++ - 1]);
  return before;
}

const joinTheHunkTextsBefore = hunks => sortByNewStart(hunks).flatMap(hunk => ["", ...hunk.oldLines.map(oldLine => oldLine.text)]);

export function readTextBeforeTheChange(file) {
  return file.lines ? rebuildTheWholeTextBefore(file.lines, file.hunks) : joinTheHunkTextsBefore(file.hunks);
}

export function readTextAfterTheChange(file) {
  if (file.lines) return file.lines;
  const lines = [];
  for (const newLine of file.hunks.flatMap(hunk => hunk.newLines)) lines[newLine.line - 1] = newLine.text;
  return Array.from(lines, text => text ?? "");
}
