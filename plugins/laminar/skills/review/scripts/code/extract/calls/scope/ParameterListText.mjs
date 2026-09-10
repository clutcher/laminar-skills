import { buildWholeWordPattern } from "../../../inputs/source/text/PatternText.mjs";

const LINES_TO_A_BODY = 12;

const STILL_OPEN = -1;

function scanParenthesesAlongALine(line, from, depthBefore) {
  let depth = depthBefore;
  for (let position = from; position < line.length; position++) {
    if (line[position] === "(") depth++;
    else if (line[position] === ")" && --depth === 0) return { closing: position, depth };
  }
  return { closing: STILL_OPEN, depth };
}

export function findClosingParenthesisAcrossLines(code, opening, maxLines = LINES_TO_A_BODY) {
  let depth = 0;
  for (let at = opening.line; at < opening.line + maxLines && at < code.length; at++) {
    const scanned = scanParenthesesAlongALine(code[at] || "", at === opening.line ? opening.column : 0, depth);
    if (scanned.closing !== STILL_OPEN) return { line: at, column: scanned.closing };
    depth = scanned.depth;
  }
  return null;
}

const joinTextAcrossLines = (code, start, end) => code.slice(start.line, end.line + 1)
  .map((line, offset) => (line || "").slice(offset === 0 ? start.column : 0, start.line + offset === end.line ? end.column + 1 : undefined))
  .join(" ");

export function findParameterListAfterTheName(code, index, name) {
  const text = code[index] || "";
  const nameAt = text.search(buildWholeWordPattern(name));
  const opening = { line: index, column: text.indexOf("(", nameAt < 0 ? 0 : nameAt) };
  const closing = opening.column < 0 ? null : findClosingParenthesisAcrossLines(code, opening);
  if (!closing) return { endLine: index, endCol: text.length, text: "" };
  return { endLine: closing.line, endCol: closing.column + 1, text: joinTextAcrossLines(code, opening, closing) };
}
