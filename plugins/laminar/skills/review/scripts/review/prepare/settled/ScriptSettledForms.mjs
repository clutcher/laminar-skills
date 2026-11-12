import { CHANGE_KINDS, changesTheCode, findClosingParenthesis, ONLY_PARENTHESES, Scale, splitAtTopLevelCommas, splitNameWords, TEST_KINDS } from "../../../code/index.mjs";
import { NUMBERED_LINE_PATTERN, parseOwnLinesOfTheSlice, readSliceSections } from "../formats/SliceFormat.mjs";

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

const readTheParametersAndStatements = (abstraction, head) => {
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

const readTheMethod = abstraction => {
  const head = findTheHeadLine(abstraction);
  return head ? readTheParametersAndStatements(abstraction, head) : null;
};

export function onlyStoresItsParameters(abstraction) {
  if (!isAConstructor(abstraction)) return false;
  const constructor = readTheMethod(abstraction);
  return Boolean(constructor)
    && constructor.parameters.length <= MOST_PARAMETERS_STORED
    && constructor.statements.every(storesAParameter(constructor.parameters));
}

export const RELATING_WORD_POSITIONS = Object.freeze({ FIRST: "first", LAST: "last" });

const RELATING_WORDS_THAT_LEAD = new Set(["to", "from", "of", "as", "into", "for", "by", "on", "in", "at"]);

const RELATING_WORDS_THAT_END = new Set([
  "to", "from", "of", "as", "into", "for", "by", "with", "on", "in", "at",
  "about", "above", "across", "after", "against", "before", "below", "between", "during", "over", "since", "through", "under", "until", "within", "without",
  "up", "out", "off", "down", "back",
]);

const NAMES_A_LANGUAGE_FIXES = new Set([
  "toString", "ToString", "toLocaleString", "toJSON", "valueOf", "compareTo", "CompareTo",
  "to_s", "to_str", "to_a", "to_ary", "to_h", "to_hash", "to_i", "to_int", "to_f", "to_sym", "to_proc",
  "to_string", "to_owned", "as_ref", "as_mut", "from_str", "from_iter", "try_from", "try_into",
]);

const OVERRIDE_ANNOTATION_PATTERN = /@override\b/i;

const OVERRIDE_KEYWORD_PATTERN = /(?<![\w$.])override\b/;

const TRAIT_IMPLEMENTATION_HEAD_PATTERN = /^\s*(?:unsafe\s+)?impl\b[^{]*\sfor\s/;

const BUILDER_TYPE_NAME_PATTERN = /Builder$/;

const THE_WORD_BUILDER = "builder";

const RETURNED_FIELD_PATTERN = /^return\s+(?:(?:this|self)\.|@)?_?([\w$]+)$/;

const TYPE_HEADS_SECTION = "typeHeads";

const isAMethodTheMethodJudgeNames = abstraction => abstraction.scale === Scale.METHOD.name
  && abstraction.changeKind !== CHANGE_KINDS.REFERENCE
  && abstraction.changeKind !== CHANGE_KINDS.REMOVED
  && (!abstraction.isTest || abstraction.testKind === TEST_KINDS.HELPER);

const findTheRelatingWord = words => {
  if (RELATING_WORDS_THAT_LEAD.has(words[0])) return { word: words[0], position: RELATING_WORD_POSITIONS.FIRST };
  const last = words[words.length - 1];
  if (words.length > 1 && RELATING_WORDS_THAT_END.has(last)) return { word: last, position: RELATING_WORD_POSITIONS.LAST };
  return null;
};

const isMarkedAsAnOverride = (abstraction, head) => OVERRIDE_KEYWORD_PATTERN.test(head.text)
  || listAnnotationLinesAbove(abstraction, head).some(annotationLine => OVERRIDE_ANNOTATION_PATTERN.test(annotationLine.text));

const findTheTypeHeadAbove = (abstraction, head) => (readSliceSections(abstraction).find(section => section.section === TYPE_HEADS_SECTION) || { lines: [] }).lines
  .map(line => NUMBERED_LINE_PATTERN.exec(line))
  .filter(numbered => numbered && Number(numbered[1]) < head.line)
  .map(numbered => numbered[2])
  .pop() || "";

const isDeclaredInATraitImplementation = (abstraction, head) => TRAIT_IMPLEMENTATION_HEAD_PATTERN.test(findTheTypeHeadAbove(abstraction, head));

const isABuilderStepOrStart = (abstraction, words) => BUILDER_TYPE_NAME_PATTERN.test(abstraction.enclosingTypeName || "") || words[words.length - 1] === THE_WORD_BUILDER;

const ACCESSOR_PREFIXES = ["get", "is"];

const capitalizeTheFirstLetter = name => name.charAt(0).toUpperCase() + name.slice(1);

const listTheNamesOfAReadOf = fieldName => [fieldName, ...ACCESSOR_PREFIXES.map(prefix => `${prefix}${capitalizeTheFirstLetter(fieldName)}`)];

const isAReadOfItsOwnField = abstraction => {
  const method = readTheMethod(abstraction);
  if (!method || method.parameters.length || method.statements.length !== 1) return false;
  const returned = RETURNED_FIELD_PATTERN.exec(method.statements[0]);
  return Boolean(returned) && listTheNamesOfAReadOf(returned[1]).includes(abstraction.name);
};

const isNamedByTheLanguageOrAFramework = (abstraction, head) => NAMES_A_LANGUAGE_FIXES.has(abstraction.name)
  || isAConstructor(abstraction)
  || isMarkedAsAnOverride(abstraction, head)
  || isDeclaredInATraitImplementation(abstraction, head);

// The form settles less than the rules entry on method names of the method judge, in 2 accepted ways, each of which leaves the name to that judge: it skips every override, also one of a project's own type; and it skips every method whose body is only the return of 1 of its fields and whose name is exactly that field's name, or get or is and that name, also where the type does more than carry data; a getter that computes, or whose name differs from its field, is still raised. A name that starts with with also stays with that judge, because only the body shows a copy with 1 field changed.
export function findTheMethodNameWithARelatingWord(abstraction) {
  if (!isAMethodTheMethodJudgeNames(abstraction)) return null;
  const words = splitNameWords(abstraction.name);
  const relating = findTheRelatingWord(words);
  if (!relating || isABuilderStepOrStart(abstraction, words)) return null;
  const head = findTheHeadLine(abstraction);
  if (!head || isNamedByTheLanguageOrAFramework(abstraction, head) || isAReadOfItsOwnField(abstraction)) return null;
  return { path: abstraction.path, line: head.line, text: head.text.trim(), ...relating };
}
