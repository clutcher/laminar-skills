import path from "node:path";
import { splitAtTopLevelCommas } from "../model/TypeArguments.mjs";

const JAVA = "Java";

const SCRIPT = "JavaScript or TypeScript";

const LANGUAGE_OF_EXTENSION_MAP = new Map([
  [".java", JAVA],
  [".js", SCRIPT], [".mjs", SCRIPT], [".cjs", SCRIPT], [".jsx", SCRIPT],
  [".ts", SCRIPT], [".tsx", SCRIPT], [".mts", SCRIPT], [".cts", SCRIPT],
]);

const QUOTED = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g;

const BLOCK_COMMENTS = /\/\*[\s\S]*?\*\//g;

// A line comment, never the 2 slashes of a URL in a text.
const LINE_COMMENTS = /(^|[^:"'])\/\/.*$/gm;

// A Java annotation or a TypeScript decorator, whose arguments in parentheses would read as a method head.
const ANNOTATION = /@[\w$.]+(?:\s*\([^()]*\))?/g;

// The words of Java, JavaScript and TypeScript that stand before a field name and are no part of it.
const SCRIPT_MODIFIERS = /^(?:(?:private|public|protected|readonly|static|declare|override|accessor|abstract)\s+)*/;

const TS_PARAMETER_PROPERTY = /\b(?:private|public|protected|readonly)\s+(?:readonly\s+)?([A-Za-z_$][\w$]*)/g;

const THIS_ASSIGNMENT = /\bthis\.#?([A-Za-z_$][\w$]*)\s*=(?![=>])/g;

const NAME = /^#?([A-Za-z_$][\w$]*)/;

const LAST_NAME = /([A-Za-z_$][\w$]*)\s*(?:\[\s*\])*\s*$/;

export const readFieldLanguage = file => LANGUAGE_OF_EXTENSION_MAP.get(path.extname(file)) || null;

const blankTheText = text => text.replace(BLOCK_COMMENTS, " ").replace(LINE_COMMENTS, "$1").replace(QUOTED, "\"\"").replace(ANNOTATION, " ");

const findMatchingClose = (text, openAt, open, close) => {
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

const findTheDeclaration = (text, className) => {
  const simpleName = className.split(".").pop();
  const declaration = new RegExp(`\\b(class|record|enum|interface)\\s+${simpleName.replace(/[$]/g, "\\$")}\\b`).exec(text);
  if (!declaration) return null;

  const bodyOpen = text.indexOf("{", declaration.index);
  if (bodyOpen < 0) return null;
  const headText = text.slice(declaration.index, bodyOpen);
  return { kindWord: declaration[1], headText, bodyText: text.slice(bodyOpen + 1, findMatchingClose(text, bodyOpen, "{", "}")) };
};

// The pieces of a class body at its own depth: each ends at a semicolon, a line end of a script or the start of a block, and a block itself is skipped.
const listTopLevelPieces = (bodyText, endsAtLine) => {
  const pieces = [];
  let piece = "";
  let depth = 0;
  for (const character of bodyText) {
    if (character === "{") {
      if (depth === 0) piece = "";
      depth += 1;
    } else if (character === "}") {
      depth = Math.max(0, depth - 1);
    } else if (depth > 0) {
      continue;
    } else if (character === ";" || (endsAtLine && character === "\n")) {
      pieces.push(piece.trim());
      piece = "";
    } else {
      piece += character;
    }
  }
  pieces.push(piece.trim());
  return pieces.filter(Boolean);
};

const readJavaFieldName = piece => {
  const declared = piece.split("=")[0];
  if (declared.includes("(")) return null;
  const name = LAST_NAME.exec(declared);
  return name ? name[1] : null;
};

const readEnumConstantNames = bodyText => {
  const constantsText = bodyText.split(";")[0];
  return splitAtTopLevelCommas(constantsText).map(constant => NAME.exec(constant.trim())).filter(Boolean).map(match => match[1]);
};

const readHeaderFieldNames = headText => {
  const open = headText.indexOf("(");
  if (open < 0) return [];
  return splitAtTopLevelCommas(headText.slice(open + 1, headText.lastIndexOf(")"))).map(headerField => LAST_NAME.exec(headerField)).filter(Boolean).map(match => match[1]);
};

const readJavaFieldNames = declaration => {
  const { bodyText } = declaration;
  const pieces = listTopLevelPieces(declaration.kindWord === "enum" ? bodyText.slice(bodyText.indexOf(";") + 1) : bodyText, false);
  const fieldNames = pieces.map(readJavaFieldName).filter(Boolean);
  if (declaration.kindWord === "enum") fieldNames.push(...readEnumConstantNames(bodyText));
  if (declaration.kindWord === "record") fieldNames.push(...readHeaderFieldNames(declaration.headText));
  return fieldNames;
};

const readScriptFieldName = piece => {
  const declared = piece.replace(SCRIPT_MODIFIERS, "");
  const name = NAME.exec(declared);
  if (!name) return null;
  const rest = declared.slice(name[0].length).trim();
  return rest === "" || /^[?!]?\s*[:=]/.test(rest) ? name[1] : null;
};

const readConstructorParameterNames = bodyText => {
  const constructorAt = bodyText.search(/\bconstructor\s*\(/);
  if (constructorAt < 0) return [];
  const open = bodyText.indexOf("(", constructorAt);
  const parametersText = bodyText.slice(open, findMatchingClose(bodyText, open, "(", ")"));
  return [...parametersText.matchAll(TS_PARAMETER_PROPERTY)].map(match => match[1]);
};

const readScriptFieldNames = declaration => [
  ...listTopLevelPieces(declaration.bodyText, true).map(readScriptFieldName).filter(Boolean),
  ...readConstructorParameterNames(declaration.bodyText),
  ...[...declaration.bodyText.matchAll(THIS_ASSIGNMENT)].map(match => match[1]),
];

// The fields a Java, JavaScript or TypeScript file declares for 1 class, read from its text; null where the file is in another language or declares no such class.
export const readDeclaredFieldNames = (text, file, className) => {
  const language = readFieldLanguage(file);
  if (!language) return null;

  const declaration = findTheDeclaration(blankTheText(text), className);
  if (!declaration) return null;
  const fieldNames = language === JAVA ? readJavaFieldNames(declaration) : readScriptFieldNames(declaration);
  return new Set(fieldNames);
};
