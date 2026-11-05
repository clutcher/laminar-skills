const OPENERS = new Set(["<", "(", "[", "{"]);

const CLOSERS = new Set([">", ")", "]", "}"]);

// The > of -> and => closes no type argument.
const isTheEndOfAnArrow = (character, piece) => character === ">" && /[-=]$/.test(piece);

// The pieces of a parameter list or a record header, split only at a comma outside angle brackets and parentheses, so Map<K, V> stays 1 piece.
export const splitAtTopLevelCommas = text => {
  const pieces = [];
  let piece = "";
  let depth = 0;
  for (const character of text) {
    if (OPENERS.has(character)) depth += 1;
    else if (CLOSERS.has(character) && !isTheEndOfAnArrow(character, piece)) depth = Math.max(0, depth - 1);
    if (character === "," && depth === 0) {
      pieces.push(piece);
      piece = "";
      continue;
    }
    piece += character;
  }
  pieces.push(piece);
  return pieces;
};
