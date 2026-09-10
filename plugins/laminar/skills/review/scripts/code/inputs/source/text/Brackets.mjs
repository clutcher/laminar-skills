const CLOSER_OF = Object.freeze({ "(": ")", "[": "]", "{": "}", "<": ">" });

export const ONLY_PARENTHESES = "(";

export const EVERY_OPENER = "([{";

export const EVERY_OPENER_AND_ANGLE = "(<[{";

const readClosers = openers => [...openers].map(opener => CLOSER_OF[opener]).join("");

export function countOpened(text, openers = EVERY_OPENER, from = 0, to = text.length) {
  const closers = readClosers(openers);
  let open = 0;
  for (let at = from; at < to; at++) {
    if (openers.includes(text[at])) open++;
    else if (closers.includes(text[at])) open--;
  }
  return open;
}

export const countParenthesesOpened = text => countOpened(String(text), ONLY_PARENTHESES);

export const NOT_BALANCED = -1;

export function* walkParenthesesBalances(texts, from = 0, to = texts.length) {
  let balance = 0;
  for (let index = from; index < to; index++) {
    balance += countParenthesesOpened(texts[index]);
    yield { index, balance };
  }
}

export function findIndexWhereTheParenthesesBalance(texts, from = 0, to = texts.length) {
  for (const { index, balance } of walkParenthesesBalances(texts, from, to)) if (balance <= 0) return index;
  return NOT_BALANCED;
}

export function findClosingParenthesis(code, opening, openers = EVERY_OPENER) {
  const closers = readClosers(openers);
  let depth = 0;
  for (let at = opening; at < code.length; at++) {
    const character = code[at];
    if (openers.includes(character)) depth++;
    else if (closers.includes(character)) { depth--; if (depth === 0) return at; }
  }
  return -1;
}

export function findUnmatchedOpenerBefore(text, at, openers = EVERY_OPENER) {
  const closers = readClosers(openers);
  let depth = 0;
  for (let index = at - 1; index >= 0; index--) {
    const character = text[index];
    if (closers.includes(character)) depth++;
    else if (openers.includes(character)) {
      if (depth === 0) return index;
      depth--;
    }
  }
  return -1;
}
