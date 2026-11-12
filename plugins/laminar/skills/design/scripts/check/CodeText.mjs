// The quotes that open a string in Java, Kotlin, JavaScript, TypeScript and Python.
export const QUOTES = "\"'`";

// The text block of Java and the raw string of Kotlin, which span lines.
const TEXT_BLOCK_QUOTE = '"""';

// The quotes of a string that ends at its line end, so an apostrophe in a comment leaves the code below it as code.
const LINE_QUOTES = "\"'";

export const readQuoteAt = (text, at) => {
  if (text.startsWith(TEXT_BLOCK_QUOTE, at)) return TEXT_BLOCK_QUOTE;
  return QUOTES.includes(text[at]) ? text[at] : "";
};

export const findEndOfTheString = (text, openAt, quote) => {
  for (let at = openAt + quote.length; at < text.length; at += 1) {
    if (text[at] === "\\") at += 1;
    else if (text.startsWith(quote, at)) return at + quote.length;
    else if (text[at] === "\n" && LINE_QUOTES.includes(quote)) return at;
  }
  return text.length;
};

export const TOKEN_KINDS = Object.freeze({ NUMBER: "number", TEXT: "text", NAME: "name", MARK: "mark", LINE_END: "line end" });

// The files whose line comments start with #, as Python writes them; every other language the checks read starts them with //.
const HASH_COMMENT_EXTENSIONS = [".py", ".rb", ".sh"];

// A number of Java, Kotlin, JavaScript, TypeScript and Python: hexadecimal, or decimal with underscores, a fraction, an exponent and a type suffix.
const NUMBER_START = /^(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)[lLfFdDnuU]*/;

const NAME_START = /^[A-Za-z_$][\w$]*/;

const SPACE = /[ \t\r\f]/;

// The marks of 2 or more characters that a statement of the read languages can hold, longest first.
const LONG_MARKS = ["...", "->", "=>", "::", "?.", "!!", "==", "!=", "<=", ">=", "&&", "||", "?:", "??"];

const usesHashComments = file => HASH_COMMENT_EXTENSIONS.some(extension => String(file || "").endsWith(extension));

const findEndOfTheComment = (text, at, hashComments) => {
  if (hashComments ? text[at] === "#" : text.startsWith("//", at)) {
    const lineEnd = text.indexOf("\n", at);
    return lineEnd < 0 ? text.length : lineEnd;
  }
  if (!hashComments && text.startsWith("/*", at)) {
    const commentEnd = text.indexOf("*/", at + 2);
    return commentEnd < 0 ? text.length : commentEnd + 2;
  }
  return at;
};

const readMarkAt = (text, at) => LONG_MARKS.find(mark => text.startsWith(mark, at)) || text[at];

// The tokens of a code text with its comments left out: numbers, strings with their quotes, names, marks, and the end of each line, which ends a statement in Kotlin and Python.
export const readCodeTokens = (text, file) => {
  const hashComments = usesHashComments(file);
  const tokens = [];
  let at = 0;
  while (at < text.length) {
    const commentEnd = findEndOfTheComment(text, at, hashComments);
    if (commentEnd > at) {
      at = commentEnd;
      continue;
    }
    if (text[at] === "\n") {
      tokens.push({ kind: TOKEN_KINDS.LINE_END, text: "\n", at });
      at += 1;
      continue;
    }
    if (SPACE.test(text[at])) {
      at += 1;
      continue;
    }

    const quote = readQuoteAt(text, at);
    if (quote) {
      const stringEnd = findEndOfTheString(text, at, quote);
      tokens.push({ kind: TOKEN_KINDS.TEXT, text: text.slice(at, stringEnd), at });
      at = stringEnd;
      continue;
    }

    const rest = text.slice(at, at + 64);
    const number = NUMBER_START.exec(rest);
    const name = number ? null : NAME_START.exec(rest);
    const tokenText = number ? number[0] : name ? name[0] : readMarkAt(text, at);
    tokens.push({ kind: number ? TOKEN_KINDS.NUMBER : name ? TOKEN_KINDS.NAME : TOKEN_KINDS.MARK, text: tokenText, at });
    at += tokenText.length;
  }
  return tokens;
};

const OPENING_MARKS = new Set(["(", "[", "{"]);

const CLOSING_MARKS = new Set([")", "]", "}"]);

export const isOpeningMark = token => token.kind === TOKEN_KINDS.MARK && OPENING_MARKS.has(token.text);

export const isClosingMark = token => token.kind === TOKEN_KINDS.MARK && CLOSING_MARKS.has(token.text);

export const isTheMark = (token, mark) => Boolean(token) && token.kind === TOKEN_KINDS.MARK && token.text === mark;

export const isTheName = (token, name) => Boolean(token) && token.kind === TOKEN_KINDS.NAME && token.text === name;
