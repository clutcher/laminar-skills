import { REFERENCE_FORMS } from "../../../../../graph/relations/Reference.mjs";
import { RELATION_KINDS } from "../../../../../graph/relations/Relation.mjs";
import { findTextLiterals } from "../../../../../inputs/source/text/TextLiterals.mjs";

const NUMBER_PATTERN = /(?<![\w.$])-?\d+(?:\.\d+)?(?![\w.])/g;
const PLAIN_NUMBERS = new Set(["0", "1", "-1"]);
const PATH_SEPARATOR_PATTERN = /\//;

const isBlank = text => !text.trim();

const findBlankRunStartBefore = (code, at) => {
  let start = at;
  while (start > 0 && code[start - 1] === " ") start--;
  return start;
};

const isMaskedText = (raw, code, from, to) => {
  const quote = raw[from];
  if (code[from] === quote && code[to] === quote) return isBlank(code.slice(from + 1, to));
  return isBlank(code.slice(from, to + 1)) && isBlank(raw.slice(findBlankRunStartBefore(code, from), from));
};

export function findLiteralsOnLine(raw, code, line) {
  const found = [];
  for (const { at, length, text } of findTextLiterals(raw)) {
    if (!text || !isMaskedText(raw, code, at, at + length - 1)) continue;
    found.push({ line, kind: RELATION_KINDS.USES_LITERAL, name: text, receiver: "", form: PATH_SEPARATOR_PATTERN.test(text) ? REFERENCE_FORMS.ROUTE : "" });
  }
  for (const match of code.matchAll(NUMBER_PATTERN)) {
    if (!PLAIN_NUMBERS.has(match[0])) found.push({ line, kind: RELATION_KINDS.USES_LITERAL, name: match[0], receiver: "", form: "" });
  }
  return found;
}
