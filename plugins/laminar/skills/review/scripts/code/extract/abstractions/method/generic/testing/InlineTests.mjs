import { countBraces, readCodeOfLine } from "../../../../../inputs/source/SourceText.mjs";
import { findBracedBlockEnd } from "../../../../../inputs/source/text/BlockEnds.mjs";
import { doRegionsHoldLine } from "../../../../../graph/abstractions/Place.mjs";

const LINES_TO_A_BLOCK_OPENING = 12;

const NO_BLOCK = 0;

const STATEMENT_END_PATTERN = /;\s*$/;

function findBlockOpeningAfter(lines, index) {
  for (let at = index; at < lines.length && at - index <= LINES_TO_A_BLOCK_OPENING; at++) {
    if (countBraces(lines[at]).opened) return at;
    if (STATEMENT_END_PATTERN.test(lines[at])) return -1;
  }
  return -1;
}

function findBlockEndAfter(lines, index) {
  const opening = findBlockOpeningAfter(lines, index);
  if (opening < 0) return NO_BLOCK;
  const end = findBracedBlockEnd(lines, lines.map(readCodeOfLine), opening);
  return end ? end + 1 : NO_BLOCK;
}

function findNameAfter(lines, index, pattern) {
  for (let at = index + 1; at < Math.min(lines.length, index + 1 + LINES_TO_A_BLOCK_OPENING); at++) {
    const found = pattern.exec(lines[at]);
    if (found) return found[1];
  }
  return "";
}

export function collectInlineTests(form, lines) {
  const regions = [];
  const names = [];
  (lines || []).forEach((text, index) => {
    if (!form.testModule.test(text)) return;
    const end = findBlockEndAfter(lines, index);
    if (end) regions.push({ from: index + 1, to: end });
  });
  (lines || []).forEach((text, index) => {
    if (!form.testFunction.test(text)) return;
    const name = findNameAfter(lines, index, form.functionName);
    if (name && !names.includes(name)) names.push(name);
    if (doRegionsHoldLine(regions, index + 1)) return;
    const end = findBlockEndAfter(lines, index);
    if (end) regions.push({ from: index + 1, to: end });
  });
  return { regions, names };
}
