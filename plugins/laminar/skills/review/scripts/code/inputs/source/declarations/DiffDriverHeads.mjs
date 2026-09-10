import fs from "node:fs";
import path from "node:path";
import { runNoIndexDiff } from "../../change/DiffDrivers.mjs";
import { findDriverForExtension } from "../drivers/LanguageRegistry.mjs";
import { NO_TEXT_LINES } from "../drivers/LanguageDriver.mjs";
import { joinLinesAsFileText } from "../SourceText.mjs";

const INSERTION_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;
const HEAD_MARKER = "\u0001laminar\u0001";

const HEADS_FILE_PATTERN = /^diff --git a\/before\/(\d+)\b/;
const MAX_FILES_PER_HEADS_DIFF = 500;

const headsItsOwnLine = (lines, line, head) => String(lines[line - 1] || "").trim().startsWith(head);

const SHORTEST_CUT_HEAD_BYTES = 78;

const repeatsTheHeadAbove = (lines, line, head, above) =>
  Boolean(above) && above.head === head && Buffer.byteLength(head) < SHORTEST_CUT_HEAD_BYTES
  && String(lines[above.line - 1]).trim() !== String(lines[line - 1]).trim();

function parseHeadsOfDiffOutput(output, files) {
  const headsByFile = files.map(() => []);
  let file = null;
  let probedAbove = null;
  for (const line of output.split(/\r?\n/)) {
    const named = HEADS_FILE_PATTERN.exec(line);
    if (named) { file = parseInt(named[1], 10); probedAbove = null; continue; }
    const header = INSERTION_HEADER_PATTERN.exec(line);
    if (!header || file === null) continue;
    const head = header[5].trim();
    const headLine = parseInt(header[1], 10);
    const lines = files[file].lines;
    const isOwnHead = head && !head.includes(HEAD_MARKER) && headsItsOwnLine(lines, headLine, head) && !repeatsTheHeadAbove(lines, headLine, head, probedAbove);
    if (isOwnHead) headsByFile[file].push({ line: headLine, head });
    probedAbove = { line: headLine, head };
  }
  return headsByFile;
}

const readTextLinesOfFile = (lines, extension) => {
  const driver = findDriverForExtension(extension);
  return driver ? driver.findTextLines(lines) : NO_TEXT_LINES;
};

function buildProbedLines(lines, extension, mayHoldAHead) {
  const textLines = readTextLinesOfFile(lines, extension);
  return lines.flatMap((line, offset) => (mayHoldAHead(line, offset, lines) && !textLines.has(offset + 1) ? [line, HEAD_MARKER] : [line]));
}

const stageEachFileOriginalAndProbed = (files, mayHoldAHead) => (before, after) => files.forEach(({ lines, extension }, number) => {
  fs.writeFileSync(path.join(before, `${number}${extension}`), joinLinesAsFileText(lines));
  fs.writeFileSync(path.join(after, `${number}${extension}`), joinLinesAsFileText(buildProbedLines(lines, extension, mayHoldAHead)));
});

function readDeclarationHeadsOfBatch(files, mayHoldAHead) {
  const output = runNoIndexDiff("laminar-heads-", stageEachFileOriginalAndProbed(files, mayHoldAHead), ["-U0"]);
  return output === null ? files.map(() => []) : parseHeadsOfDiffOutput(output, files);
}

const acceptEveryLine = () => true;

export function readDeclarationHeadsOfFiles(files, mayHoldAHead = acceptEveryLine) {
  const headsByFile = [];
  for (let from = 0; from < files.length; from += MAX_FILES_PER_HEADS_DIFF) {
    headsByFile.push(...readDeclarationHeadsOfBatch(files.slice(from, from + MAX_FILES_PER_HEADS_DIFF), mayHoldAHead));
  }
  return headsByFile;
}

export const readDeclarationHeadsOfLines = (lines, extension) => readDeclarationHeadsOfFiles([{ lines, extension }])[0];
