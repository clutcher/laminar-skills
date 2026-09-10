import { buildWholeWordShapePattern } from "../text/PatternText.mjs";

export const namesAType = word => /^[A-Z]/.test(word);

const WORD_SEPARATOR_PATTERN = /[-_.]/g;

const readNameAcrossConventions = name => String(name).toLowerCase().replace(WORD_SEPARATOR_PATTERN, "");

export const isTheSameNameAcrossConventions = (left, right) => readNameAcrossConventions(left) === readNameAcrossConventions(right);

export const FILE_NAMES_SET_BY_THE_LANGUAGE = new Set(["index", "__init__"]);

const UPPER_SNAKE_SHAPE_PATTERN_SOURCE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*";

const UPPER_SNAKE_WHOLE_NAME_PATTERN = new RegExp(`^(?:${UPPER_SNAKE_SHAPE_PATTERN_SOURCE})$`);

export const UPPER_SNAKE_NAME_PATTERN = buildWholeWordShapePattern(UPPER_SNAKE_SHAPE_PATTERN_SOURCE, "g");

export const isUpperSnakeName = name => UPPER_SNAKE_WHOLE_NAME_PATTERN.test(String(name));

const TYPE_NAME_OF_3_OR_MORE_PATTERN = /\b[A-Z][A-Za-z0-9]{2,}\b/g;

export function collectTypeNames(lines) {
  const found = new Set();
  for (const line of lines) for (const word of String(line).matchAll(TYPE_NAME_OF_3_OR_MORE_PATTERN)) found.add(word[0]);
  return [...found];
}
