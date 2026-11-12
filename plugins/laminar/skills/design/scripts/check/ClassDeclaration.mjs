import path from "node:path";

export const MEMBER_LANGUAGES = Object.freeze({ JAVA: "Java", SCRIPT: "JavaScript or TypeScript" });

const LANGUAGE_OF_EXTENSION_MAP = new Map([
  [".java", MEMBER_LANGUAGES.JAVA],
  [".js", MEMBER_LANGUAGES.SCRIPT], [".mjs", MEMBER_LANGUAGES.SCRIPT], [".cjs", MEMBER_LANGUAGES.SCRIPT], [".jsx", MEMBER_LANGUAGES.SCRIPT],
  [".ts", MEMBER_LANGUAGES.SCRIPT], [".tsx", MEMBER_LANGUAGES.SCRIPT], [".mts", MEMBER_LANGUAGES.SCRIPT], [".cts", MEMBER_LANGUAGES.SCRIPT],
]);

const QUOTED = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g;

const BLOCK_COMMENTS = /\/\*[\s\S]*?\*\//g;

// A line comment, never the 2 slashes of a URL in a text.
const LINE_COMMENTS = /(^|[^:"'])\/\/.*$/gm;

// A Java annotation or a TypeScript decorator, whose arguments in parentheses would read as a method head.
const ANNOTATION = /@[\w$.]+(?:\s*\([^()]*\))?/g;

// The language whose members the design check reads from a class body, by the extension of the file; null for every other language.
export const readMemberLanguage = file => LANGUAGE_OF_EXTENSION_MAP.get(path.extname(file)) || null;

const blankTheText = text => text.replace(BLOCK_COMMENTS, " ").replace(LINE_COMMENTS, "$1").replace(QUOTED, "\"\"").replace(ANNOTATION, " ");

export const findMatchingClose = (text, openAt, open, close) => {
  let depth = 0;
  for (let at = openAt; at < text.length; at += 1) {
    if (text[at] === open) depth += 1;
    else if (text[at] === close) {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return text.length;
};

// The kind word, the head and the body of the class of that name, read from a text with its comments, its quoted texts and its annotations blanked; null where the text declares no such class.
export const readClassDeclaration = (text, className) => {
  const blankedText = blankTheText(text);
  const simpleName = className.split(".").pop();
  const declaration = new RegExp(`\\b(class|record|enum|interface)\\s+${simpleName.replace(/[$]/g, "\\$")}\\b`).exec(blankedText);
  if (!declaration) return null;

  const bodyOpen = blankedText.indexOf("{", declaration.index);
  if (bodyOpen < 0) return null;
  const headText = blankedText.slice(declaration.index, bodyOpen);
  return { kindWord: declaration[1], headText, bodyText: blankedText.slice(bodyOpen + 1, findMatchingClose(blankedText, bodyOpen, "{", "}")) };
};
