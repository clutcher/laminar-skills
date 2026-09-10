import { splitIntoTopLevelPieces, splitTrimmedPiecesAtTopLevelCommas } from "./TopLevelText.mjs";

export const WORDS_NEVER_A_TYPE = new Set(["return", "new", "throw", "else", "case", "yield", "await", "in", "of", "is", "as", "and",
  "or", "not", "if", "for", "while", "do", "goto", "delete", "typeof", "sizeof", "echo", "print", "package", "import", "using",
  "range", "func", "go", "defer", "select", "struct", "interface", "chan", "public", "private", "protected", "static", "final",
  "readonly", "const", "override", "virtual", "abstract", "extends", "implements", "where", "when", "from", "class", "enum",
  "instanceof", "throws", "assert", "nameof", "keyof", "lambda", "super", "this", "self", "then", "until", "unless", "elif",
  "elsif", "break", "continue", "switch", "try", "catch", "finally", "var", "namespace"]);

const TYPE_ARGUMENTS_PATTERN_SOURCE = "(?:<(?:[^<>;=(){}]|<[^<>;=(){}]*>)*>|\\[(?:[^[\\];=(){}]|\\[[^[\\];=(){}]*\\])*\\])";
const NESTED_TYPE_ARGUMENTS_PATTERN_SOURCE = "<(?:[^<>;=(){}]|<(?:[^<>;=(){}]|<(?:[^<>;=(){}]|<[^<>;=(){}]*>)*>)*>)*>";
export const TYPE_PATTERN_SOURCE = `[A-Za-z_\\\\][\\w.:\\\\]*(?:\\s*${NESTED_TYPE_ARGUMENTS_PATTERN_SOURCE})?(?:\\s*\\[\\s*\\])*[?*&]?`;
export const COLON_TYPE_PATTERN_SOURCE = `(?:&\\s*(?:mut\\s+)?)?(?:dyn\\s+|impl\\s+|readonly\\s+)?[A-Za-z_][\\w.:]*(?:\\s*${TYPE_ARGUMENTS_PATTERN_SOURCE})?`;

const WORDS_THAT_NAME_NO_TYPE = new Set(["any", "unknown", "object", "dynamic"]);

export const findATypeWord = given => {
  const text = String(given || "").trim().replace(/^readonly\s+/, "");
  const head = text.replace(/^(?:\[\]|\*)+/, "").split(/[\s<[]/)[0].replace(/[?*&]+$/, "");
  return head && !WORDS_NEVER_A_TYPE.has(head) && !WORDS_THAT_NAME_NO_TYPE.has(head) ? text : "";
};

const SELF_TYPE_PATTERN = /^(?:this|self|Self|static)$/;

export const replaceASelfTypeWithTheEnclosingType = (text, enclosingTypeName) => (SELF_TYPE_PATTERN.test(text) ? enclosingTypeName : text);

const WILDCARD_BOUND_PATTERN = /^\?\s*(?:extends|super)\s+/;

const VARIANCE_PATTERN = /^(?:out|in)\s+/;

export const stripAWildcardBound = text => text.replace(WILDCARD_BOUND_PATTERN, "");

export const stripAVariance = text => text.replace(VARIANCE_PATTERN, "");

export const isABareTypeParameter = (type, typeParameters) => Boolean(type) && !type.collection && !type.qualified.includes(".") && typeParameters.has(type.simple);

export const stripATypeParameter = (text, typeParameters) => {
  const type = text && typeParameters.size ? parseType(text) : null;
  return isABareTypeParameter(type, typeParameters) ? "" : text;
};

export function collectNestedTypeArguments(text) {
  const found = [];
  const pending = [String(text || "")];
  while (pending.length) {
    const typeText = pending.shift();
    const opening = typeText.search(/[<[]/);
    if (opening < 0) continue;
    const closing = typeText.lastIndexOf(typeText[opening] === "<" ? ">" : "]");
    if (closing <= opening) continue;
    for (const piece of splitIntoTopLevelPieces(typeText.slice(opening + 1, closing))) {
      const argument = stripAVariance(stripAWildcardBound(piece)).trim();
      if (!argument || argument === "?") continue;
      found.push(argument);
      pending.push(argument);
    }
  }
  return [...new Set(found)];
}

const COLLECTION_FORM_PATTERN = /^\[\]|^map\[|\[\s*\]$/;

export function parseType(text) {
  const type = String(text || "").trim().replace(/^[&*]+\s*/, "").replace(/^(?:mut|dyn|impl)\s+/, "").replace(/^\*+/, "");
  if (!type) return null;
  const collection = COLLECTION_FORM_PATTERN.test(type);
  const bare = type.replace(/<.*$/s, "").replace(/\[.*$/s, "").replace(/[?!*&\s]+$/, "").replace(/::/g, ".").replace(/\\/g, ".");
  const qualified = bare.replace(/^\./, "");
  const simple = qualified.split(".").pop();
  return simple ? { text: String(text).trim(), qualified, simple, collection } : null;
}

const TYPE_ARGUMENT_BRACKETS = "<[(";

export const splitTopLevelArguments = text => splitTrimmedPiecesAtTopLevelCommas(text, { openers: TYPE_ARGUMENT_BRACKETS });

const TYPE_WITH_ARGUMENTS_PATTERN = /^[A-Za-z_][\w.:]*\s*(?:<(.*)>|\[(.*)\])\??$/s;

export function parseTypeArguments(text) {
  const listed = TYPE_WITH_ARGUMENTS_PATTERN.exec(String(text || "").trim());
  return listed ? splitTopLevelArguments(listed[1] === undefined ? listed[2] : listed[1]) : [];
}

export function findElementType(text) {
  const type = String(text || "").trim();
  const goSlice = /^\[\]\s*(.+)$/.exec(type);
  if (goSlice) return goSlice[1];
  const goMap = /^map\[[^\]]*\]\s*(.+)$/.exec(type);
  if (goMap) return goMap[1];
  const array = /^(.+?)\s*\[\s*\]$/.exec(type);
  if (array) return array[1];
  const bracketed = /^(?:List|list|Sequence|Iterable|Iterator|Set|set|FrozenSet|frozenset|Collection|Tuple|tuple|Deque|deque)\s*\[(.*)\]$/s.exec(type);
  if (bracketed) {
    const typeArguments = splitTopLevelArguments(bracketed[1]);
    return typeArguments.length === 1 || /^(?:Tuple|tuple)$/.test(type.split("[")[0].trim()) ? typeArguments[0] : "";
  }
  const generic = /^[A-Za-z_][\w.]*\s*<(.*)>$/s.exec(type);
  if (!generic) return "";
  const typeArguments = splitTopLevelArguments(generic[1]);
  if (typeArguments.length !== 1) return "";
  return stripAVariance(stripAWildcardBound(typeArguments[0]));
}

export const NO_RESULT = new Set(["void", "Unit", "None", "()", "undefined", "never", "any", "unknown", "object", "Object", "error", "bool", "boolean", "int", "string", "str"]);
