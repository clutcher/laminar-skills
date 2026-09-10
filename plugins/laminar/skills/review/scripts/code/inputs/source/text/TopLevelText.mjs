const CLOSER_OF = Object.freeze({ "(": ")", "[": "]", "{": "}", "<": ">" });

export const EVERY_BRACKET = "([{<";

const readClosers = openers => [...openers].map(opener => CLOSER_OF[opener]).join("");

function* walkBracketDepths(text, { openers = EVERY_BRACKET, depthNeverBelowZero = false } = {}) {
  const closers = readClosers(openers);
  let depth = 0;
  for (let at = 0; at < text.length; at++) {
    const character = text[at];
    const opens = openers.includes(character);
    const closes = !opens && closers.includes(character);
    if (opens) depth++;
    else if (closes) depth = depthNeverBelowZero ? Math.max(0, depth - 1) : depth - 1;
    yield { at, character, depth, bracket: opens || closes };
  }
}

export function splitAtTopLevelCommas(text, options = {}) {
  const pieces = [];
  let piece = "";
  for (const { character, depth } of walkBracketDepths(text, options)) {
    if (character === "," && depth === 0) { pieces.push(piece); piece = ""; } else piece += character;
  }
  return [...pieces, piece];
}

export const splitTrimmedPiecesAtTopLevelCommas = (text, options) => splitAtTopLevelCommas(text, options).map(piece => piece.trim()).filter(Boolean);

export const splitIntoTopLevelPieces = text => splitTrimmedPiecesAtTopLevelCommas(text, { depthNeverBelowZero: true });

export function findTopLevelIndex(text, isWanted) {
  for (const { at, depth, bracket } of walkBracketDepths(text, { depthNeverBelowZero: true })) {
    if (!bracket && depth === 0 && isWanted(text, at)) return at;
  }
  return -1;
}
