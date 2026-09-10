import { countBraces, readCodeOfLine, indentOf } from "../SourceText.mjs";

const LINES_TO_A_WRAPPED_BODY = 40;

const HEAD_TAIL_PATTERN = /^(?:throws\b|:|->|where\b|\{|noexcept\b|const\b|override\b|final\b)/;

const CLOSING_KEYWORD_LINE_PATTERN = /^\s*end\b/;

const CLOSING_BRACE_LINE_PATTERN = /^\s*}/;

const ONE_LINE_BODY_PATTERN = /}\s*;?$/;

export function findHeadEnd(codes, index) {
  let depth = 0;
  for (let at = index; at < Math.min(codes.length, index + LINES_TO_A_WRAPPED_BODY); at++) {
    for (const character of codes[at]) {
      if ("([{".includes(character)) depth++;
      else if (")]}".includes(character)) depth--;
    }
    if (depth <= 0) return at;
  }
  return index;
}

export function doesBodyOpenBelow(lines, index) {
  let depth = 0;
  let closedAt = -1;
  for (let at = index; at < Math.min(lines.length, index + LINES_TO_A_WRAPPED_BODY); at++) {
    const code = readCodeOfLine(lines[at]).trim();
    if (closedAt >= 0 && !HEAD_TAIL_PATTERN.test(code)) return false;
    for (const character of code) {
      if (character === ";") return false;
      if (character === "(" || character === "[") depth++;
      else if (character === ")" || character === "]") depth--;
      else if (character === "{" && depth === 0) return true;
      if (depth < 0) return false;
    }
    if (depth === 0 && closedAt < 0) closedAt = at;
  }
  return false;
}

export function findIndentedBlockEnd(lines, codes, textLines, index) {
  const own = indentOf(String(lines[index]));
  let last = findHeadEnd(codes, index) + 1;
  for (let at = last; at < lines.length; at++) {
    const text = String(lines[at]);
    if (!text.trim() || textLines.has(at + 1)) { if (textLines.has(at + 1)) last = at + 1; continue; }
    if (indentOf(text) > own) { last = at + 1; continue; }
    return CLOSING_KEYWORD_LINE_PATTERN.test(text) && indentOf(text) === own ? at + 1 : last;
  }
  return last;
}

export function findBracedBlockEnd(lines, codes, index) {
  if (!codes[index].includes("{") && !doesBodyOpenBelow(lines, index)) return 0;
  let depth = 0;
  let opened = false;
  for (let at = index; at < codes.length; at++) {
    const braces = countBraces(codes[at]);
    depth += braces.opened - braces.closed;
    if (at === index && depth === 0 && braces.opened && ONE_LINE_BODY_PATTERN.test(codes[at])) return at;
    if (depth < 0 || (opened && depth === 0)) return opened ? at : 0;
    if (depth > 0) opened = true;
  }
  return 0;
}

export function closesAlignedWith(lines, index, end) {
  if (end === index) return true;
  const closing = String(lines[end]);
  return (CLOSING_BRACE_LINE_PATTERN.test(closing) || CLOSING_KEYWORD_LINE_PATTERN.test(closing)) && indentOf(closing) === indentOf(String(lines[index]));
}
