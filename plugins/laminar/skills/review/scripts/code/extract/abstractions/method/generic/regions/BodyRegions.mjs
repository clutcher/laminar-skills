export const END_OF_LINE = Number.MAX_SAFE_INTEGER;

export const MAX_LINES_TO_A_BODY = 3000;

export const indentOf = text => (/^[ \t]*/.exec(text) || [""])[0].length;

export function findBracedEnd(code, lineIndex, openingAt, lastIndex) {
  let depth = 0;
  for (let index = lineIndex; index <= lastIndex; index++) {
    const text = code[index] || "";
    for (let at = index === lineIndex ? openingAt : 0; at < text.length; at++) {
      const character = text[at];
      if (character === "{" || character === "(" || character === "[") depth++;
      else if (character === "}" || character === ")" || character === "]") {
        depth--;
        if (depth === 0) return { line: index, col: at };
      }
    }
  }
  return { line: lastIndex, col: END_OF_LINE };
}

export function findIndentedEnd(code, lineIndex, lastIndex) {
  const own = indentOf(code[lineIndex] || "");
  let end = lineIndex;
  for (let index = lineIndex + 1; index <= lastIndex && index - lineIndex <= MAX_LINES_TO_A_BODY; index++) {
    const text = code[index] || "";
    if (!text.trim()) continue;
    if (indentOf(text) <= own) break;
    end = index;
  }
  return { line: end, col: END_OF_LINE };
}

export const createRegion = (head, form, fromLine, fromCol, to, perItem = true) => ({
  head, form, fromLine, fromCol, toLine: to.line, toCol: to.col, perItem,
});
