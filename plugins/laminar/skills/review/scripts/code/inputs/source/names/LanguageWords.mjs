export const LANGUAGE_WORDS = new Set(["true", "false", "null", "none", "this", "self", "void", "else", "elif", "case", "from",
  "import", "export", "return", "const", "await", "async", "class", "function", "public", "private", "protected",
  "static", "final", "while", "break", "continue", "default", "interface", "extends", "implements", "package", "throw",
  "throws", "catch", "finally", "super", "type", "enum", "struct", "impl", "func", "then", "with", "using", "namespace",
  "typeof", "instanceof", "yield", "undefined", "lambda", "require", "module", "exports", "readonly", "constructor",
  "string", "number", "boolean", "object", "unknown", "never", "String", "Boolean", "Number", "Object", "Array", "List",
  "Map", "Set", "Promise", "Record", "Error", "console"]);

const DECISION_WORDS = new Set(["elif", "elsif", "unless", "when", "guard", "switch", "match"]);

export const WORDS_FOR_THE_ENCLOSING_TYPE = new Set(["this", "self", "super", "$this", "Self"]);

export const isAWordOfTheLanguage = word => [word, word.toLowerCase()]
  .some(form => LANGUAGE_WORDS.has(form) || DECISION_WORDS.has(form));

export const THE_SUPERTYPE_RECEIVER = "super";
