import { CHANGE_KINDS, changesTheCode, findClosingParenthesis, ONLY_PARENTHESES, Scale, splitAtTopLevelCommas, TEST_KINDS } from "../../../code/index.mjs";
import { parseOwnLinesOfTheSlice } from "../formats/SliceFormat.mjs";

const ONE_WORD_NAME_PATTERN = /^[A-Za-z_$][\w$]*$/;

const THE_WORD_SHOULD_PATTERN = /should/i;

const ANNOTATION_LINE_PATTERN = /^\s*(@|\[)/;

const A_STRING_QUOTE_PATTERN = /["'`]/;

const SINGLE_LETTER_PATTERN = /^[a-z]$/;

const LETTERS_OF_A_LOOP_INDEX = new Set(["i", "j"]);

const NOTE_OF_WORK_LEFT_UNDONE_PATTERN = /^(TODO|FIXME)\b/;

const A_TICKET_REFERENCE_PATTERN = /\d|:\/\//;

const ANNOTATION_LINES_LOOKED_AT = 4;

const isAWholeTestMethod = abstraction => abstraction.isTest
  && abstraction.scale === Scale.METHOD.name
  && changesTheCode(abstraction.changeKind)
  && abstraction.testKind !== TEST_KINDS.HELPER
  && abstraction.testKind !== TEST_KINDS.HOOK;

const escapeTheName = name => name.replace(/[$]/g, "\\$");

const findTheHeadLine = abstraction => {
  const namedWithItsParenthesis = new RegExp(`(?<![\\w$])${escapeTheName(abstraction.name)}\\s*\\(`);
  return parseOwnLinesOfTheSlice(abstraction).find(ownLine => ownLine.line >= ((abstraction.lines || {}).from || 0) && namedWithItsParenthesis.test(ownLine.text)) || null;
};

const listAnnotationLinesAbove = (abstraction, head) => {
  const linesAbove = parseOwnLinesOfTheSlice(abstraction).filter(ownLine => ownLine.line < head.line && ownLine.line >= head.line - ANNOTATION_LINES_LOOKED_AT).reverse();
  const annotations = [];
  for (const lineAbove of linesAbove) {
    if (!ANNOTATION_LINE_PATTERN.test(lineAbove.text)) break;
    annotations.push(lineAbove);
  }
  return annotations;
};

const isNamedByAnAnnotation = (abstraction, head) => listAnnotationLinesAbove(abstraction, head).some(annotationLine => A_STRING_QUOTE_PATTERN.test(annotationLine.text));

export function findTheTestNameWithNoShould(abstraction) {
  if (!isAWholeTestMethod(abstraction) || !ONE_WORD_NAME_PATTERN.test(abstraction.name) || THE_WORD_SHOULD_PATTERN.test(abstraction.name)) return null;
  const head = findTheHeadLine(abstraction);
  if (!head || isNamedByAnAnnotation(abstraction, head)) return null;
  return { path: abstraction.path, line: head.line, text: head.text.trim() };
}

const isAChangedProductionValue = abstraction => !abstraction.isTest
  && abstraction.scale === Scale.VARIABLE.name
  && abstraction.changeKind !== CHANGE_KINDS.REFERENCE
  && !abstraction.fields;

const isWithinTheSpan = (abstraction, ownLine) => !abstraction.lines || (ownLine.line >= abstraction.lines.from && ownLine.line <= abstraction.lines.to);

const findTheDeclarationLine = abstraction => {
  const declared = new RegExp(`(?<![\\w$.])${escapeTheName(abstraction.name)}\\s*(?:(?::=|=)(?!=)|;|,|\\)|:(?!:))`);
  return parseOwnLinesOfTheSlice(abstraction).find(ownLine => isWithinTheSpan(abstraction, ownLine) && declared.test(ownLine.text)) || null;
};

export function findTheSingleLetterName(abstraction) {
  if (!isAChangedProductionValue(abstraction) || !SINGLE_LETTER_PATTERN.test(abstraction.name) || LETTERS_OF_A_LOOP_INDEX.has(abstraction.name)) return null;
  const declaration = findTheDeclarationLine(abstraction);
  return declaration ? { path: abstraction.path, line: declaration.line, text: declaration.text.trim() } : null;
}

export const isAnUntrackedNoteOfWork = text => NOTE_OF_WORK_LEFT_UNDONE_PATTERN.test(String(text).trim()) && !A_TICKET_REFERENCE_PATTERN.test(String(text));

const isAPhaseCommentInProductionCode = (abstraction, comment) => !abstraction.isTest && comment.isPhaseComment;

const isANoteOfWorkInProductionCode = (abstraction, comment) => !abstraction.isTest && isAnUntrackedNoteOfWork(comment.text);

const isACommentTheScriptSettles = (abstraction, comment) => isAPhaseCommentInProductionCode(abstraction, comment) || isANoteOfWorkInProductionCode(abstraction, comment);

export const listCommentsTheJudgeReads = abstraction => (abstraction.comments || []).filter(comment => !isACommentTheScriptSettles(abstraction, comment));

const placeTheComment = (abstraction, comment) => {
  const shown = parseOwnLinesOfTheSlice(abstraction).find(ownLine => ownLine.line === comment.from);
  return { path: abstraction.path, line: comment.from, text: shown ? shown.text.trim() : comment.text, comment: comment.text };
};

export const listPhaseCommentsInProductionCode = abstraction => (abstraction.comments || [])
  .filter(comment => isAPhaseCommentInProductionCode(abstraction, comment))
  .map(comment => placeTheComment(abstraction, comment));


export const listNotesOfWorkWithNoTicket = abstraction => (abstraction.comments || [])
  .filter(comment => isANoteOfWorkInProductionCode(abstraction, comment))
  .map(comment => placeTheComment(abstraction, comment));

const CONSTRUCTOR_NAMES = new Set(["constructor", "__init__", "init"]);

const MOST_PARAMETERS_STORED = 3;

const RECEIVER_PARAMETERS = new Set(["self"]);

const NOTHING_BETWEEN_THE_HEAD_AND_THE_BRACE_PATTERN = /^\s*(?:throws\s+[\w$.,\s]+)?$/;

const NOTHING_BETWEEN_THE_HEAD_AND_THE_COLON_PATTERN = /^\s*(?:->\s*None\s*)?$/;

const STORED_PARAMETER_PATTERN = /^(?:this\.|self\.)?_?([\w$]+)\s*=\s*([\w$]+)\s*;?$/;

const isAConstructor = abstraction => abstraction.scale === Scale.METHOD.name && !abstraction.isTest && (CONSTRUCTOR_NAMES.has(abstraction.name) || (Boolean(abstraction.enclosingTypeName) && abstraction.name === abstraction.enclosingTypeName));

const readTheParameterName = parameterText => {
  const withoutDefault = parameterText.split("=")[0];
  const beforeItsType = withoutDefault.includes(":") ? withoutDefault.split(":")[0] : withoutDefault;
  return (beforeItsType.trim().match(/([A-Za-z_$][\w$]*)$/) || [])[1] || "";
};

const readTheBodyOfBraces = after => {
  const opened = after.indexOf("{");
  const closed = after.lastIndexOf("}");
  if (opened < 0 || closed < opened || !NOTHING_BETWEEN_THE_HEAD_AND_THE_BRACE_PATTERN.test(after.slice(0, opened))) return null;
  return after.slice(opened + 1, closed);
};

const readTheIndentedBody = after => {
  const colon = after.indexOf(":");
  if (colon < 0 || !NOTHING_BETWEEN_THE_HEAD_AND_THE_COLON_PATTERN.test(after.slice(0, colon))) return null;
  return after.slice(colon + 1);
};

const readTheConstructor = abstraction => {
  const head = findTheHeadLine(abstraction);
  if (!head) return null;
  const text = parseOwnLinesOfTheSlice(abstraction).filter(ownLine => ownLine.line >= head.line && isWithinTheSpan(abstraction, ownLine)).map(ownLine => ownLine.text).join("\n");
  const opened = text.indexOf("(");
  const closed = opened < 0 ? -1 : findClosingParenthesis(text, opened, ONLY_PARENTHESES);
  if (closed < 0) return null;
  const inside = text.slice(opened + 1, closed).trim();
  const parameters = (inside ? splitAtTopLevelCommas(inside) : []).map(readTheParameterName).filter(name => !RECEIVER_PARAMETERS.has(name));
  const after = text.slice(closed + 1);
  const body = readTheBodyOfBraces(after) ?? readTheIndentedBody(after);
  return body === null ? null : { parameters, statements: body.split(/[\n;]/).map(statement => statement.trim()).filter(Boolean) };
};

const storesAParameter = parameters => statement => {
  const stored = STORED_PARAMETER_PATTERN.exec(statement);
  return Boolean(stored) && parameters.includes(stored[2]);
};

export function onlyStoresItsParameters(abstraction) {
  if (!isAConstructor(abstraction)) return false;
  const constructor = readTheConstructor(abstraction);
  return Boolean(constructor)
    && constructor.parameters.length <= MOST_PARAMETERS_STORED
    && constructor.statements.every(storesAParameter(constructor.parameters));
}
