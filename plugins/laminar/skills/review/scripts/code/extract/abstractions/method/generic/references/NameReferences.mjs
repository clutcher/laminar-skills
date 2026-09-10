import { isUpperSnakeName, namesAType } from "../../../../../inputs/source/names/NamingConventions.mjs";
import { CALL_FORMS, readCallFormOfAReceiver, EXPRESSION_RECEIVER, NO_RECEIVER, UNNAMED_RECEIVER } from "../../../../../graph/relations/Reference.mjs";
import { RELATION_KINDS } from "../../../../../graph/relations/Relation.mjs";

const IDENTIFIER_PATTERN = /(?<![\w$])[A-Za-z_$][\w$]*/g;
const NEW_BEFORE_PATTERN = /\bnew\s+(?:[\w$]+\s*\.\s*)*$/;

const CALL_AFTER_PATTERN = /^\s*(?:<[^()<>;=]*(?:<[^()<>;=]*>[^()<>;=]*)*>)?\s*!?\(/;
const ASSIGNMENT_AFTER_PATTERN = /^\s*(?:[-+*/%&|^]|\?\?|<<|>>>?)?=(?![=>~])/;

export const isACallAfter = after => CALL_AFTER_PATTERN.test(after);

export const isAnAssignmentAfter = after => ASSIGNMENT_AFTER_PATTERN.test(after);

const KEYWORDS = new Set(["if", "else", "for", "while", "do", "switch", "case", "return", "new", "throw", "throws", "try", "catch",
  "finally", "break", "continue", "this", "self", "super", "true", "false", "null", "nil", "None", "True", "False", "import",
  "package", "class", "interface", "enum", "public", "private", "protected", "static", "final", "const", "let", "var", "val",
  "def", "fn", "func", "fun", "function", "void", "elif", "elsif", "then", "end", "in", "is", "not", "and", "or", "instanceof",
  "typeof", "await", "async", "yield", "export", "extends", "implements", "abstract", "override", "lambda", "pass", "with", "as"]);

const readKind = (name, before, after) => {
  if (NEW_BEFORE_PATTERN.test(before) || isACallAfter(after)) return RELATION_KINDS.CALLS;
  if (isAnAssignmentAfter(after)) return RELATION_KINDS.WRITES_FIELD;
  if (namesAType(name) && !isUpperSnakeName(name)) return RELATION_KINDS.USES_TYPE;
  return RELATION_KINDS.READS_FIELD;
};

const readCallForm = (before, receiver) => {
  if (NEW_BEFORE_PATTERN.test(before)) return CALL_FORMS.NEW;
  return readCallFormOfAReceiver(receiver !== NO_RECEIVER);
};

const readRecordedReceiver = receiver => {
  if (receiver === NO_RECEIVER) return "";
  return receiver === UNNAMED_RECEIVER ? EXPRESSION_RECEIVER : receiver;
};

export function findNamesOnLine(code, line, relationFinder) {
  const found = [];
  for (const match of code.matchAll(IDENTIFIER_PATTERN)) {
    const name = match[0];
    if (KEYWORDS.has(name)) continue;
    const before = code.slice(0, match.index);
    const after = code.slice(match.index + name.length);
    const kind = readKind(name, before, after);
    const receiver = relationFinder.findReceiverBefore(code, match.index);
    found.push({ line, kind, name, receiver: readRecordedReceiver(receiver), form: kind === RELATION_KINDS.CALLS ? readCallForm(before, receiver) : "" });
  }
  return found;
}
