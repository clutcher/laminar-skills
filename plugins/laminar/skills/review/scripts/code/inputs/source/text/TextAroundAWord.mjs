import { buildWholeWordPattern } from "./PatternText.mjs";

export const findTextAroundTheWord = (text, word) => {
  const found = buildWholeWordPattern(word).exec(text);
  return found ? { before: text.slice(0, found.index), after: text.slice(found.index + found[0].length) } : null;
};
