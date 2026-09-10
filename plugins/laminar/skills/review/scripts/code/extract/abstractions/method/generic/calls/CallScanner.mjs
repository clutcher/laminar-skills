import { findClosingParenthesis, findUnmatchedOpenerBefore } from "../../../../../inputs/source/text/Brackets.mjs";
import { CALL_FORMS, EXPRESSION_QUALIFIER, NO_RECEIVER, UNNAMED_RECEIVER } from "../../../../../graph/relations/Reference.mjs";
import { WORDS_FOR_THE_ENCLOSING_TYPE } from "../../../../../inputs/source/names/LanguageWords.mjs";
import { splitAtTopLevelCommas } from "../../../../../inputs/source/text/TopLevelText.mjs";
import { findCallQualifierBefore } from "../../../../../inputs/source/text/QualifierText.mjs";

const NEVER_A_CALLEE = new Set(["if", "for", "while", "switch", "catch", "return", "function", "def", "fn", "func", "fun", "sub",
  "sizeof", "typeof", "instanceof", "elif", "elsif", "and", "or", "not", "in", "await", "yield", "assert", "lambda", "new",
  "super", "this", "self", "match", "case", "when", "unless", "until", "foreach", "do", "then", "else", "try", "with",
  "synchronized", "using", "lock", "fixed", "checked", "unchecked", "defer", "go", "select", "loop", "throw", "throws",
  "class", "struct", "interface", "enum", "record", "import", "is", "as", "require", "include",
  "require_once", "include_once", "local", "let", "var", "val", "const", "static", "void", "int", "long", "char", "double",
  "float", "short", "byte", "boolean", "bool", "string", "auto", "decltype", "alignof", "noexcept", "static_assert",
  "procedure", "begin", "end", "repeat", "elseif", "except", "finally", "raise", "rescue", "ensure", "del", "global",
  "nonlocal", "pass", "unsafe", "impl", "where", "mod", "use", "pub", "move", "ref", "out", "params", "delete", "async"]);

const isNeverACallee = (callee, finder) => NEVER_A_CALLEE.has(callee) || finder.wordsNeverACallee.includes(callee);

const DECLARING_WORDS_PATTERN = /(?:^|[^\w$])(?:function|def|defp|fn|func|fun|sub|class|interface|struct|enum|trait|record|type|procedure|macro|defmacro)\s*$/;

export const createBareCall = ({ col, callee, opening, closing, args = null, firstArgument = "" }) => ({
  col, form: CALL_FORMS.BARE, callee, receiver: "", qualifier: "", root: "", chained: false, opening, ...(closing === undefined ? {} : { closing }), block: false, args, firstArgument,
});

const NAMES_IN_A_QUALIFIED_RECEIVER = 2;

export const readsAPath = call => (call.path || []).length > NAMES_IN_A_QUALIFIED_RECEIVER;

export function readArgumentCountAndFirst(code, opening) {
  const closing = findClosingParenthesis(code, opening);
  if (closing < 0) return { count: null, first: "" };
  const inside = code.slice(opening + 1, closing);
  if (!inside.trim()) return { count: 0, first: "" };
  const pieces = splitAtTopLevelCommas(inside, { depthNeverBelowZero: true });
  return { count: pieces.length, first: pieces[0].trim() };
}

const SPREAD_ARGUMENT_PATTERN = /(?:^|,)\s*(?:\.\.\.|\*{1,2})(?=[\w$(])/;

const TRAILING_BLOCK_PATTERN = /^\s*\{/;

const hasASpreadArgument = (code, call) => SPREAD_ARGUMENT_PATTERN.test(code.slice(call.opening + 1, call.closing));

const takesATrailingBlock = (code, call) => call.form !== CALL_FORMS.NEW && TRAILING_BLOCK_PATTERN.test(code.slice(call.closing + 1));

export function readArgumentCount(code, call) {
  if (call.args === null || call.args === undefined) return null;
  if (call.opening < 0 || call.closing < 0) return call.args;
  const text = String(code || "");
  return hasASpreadArgument(text, call) || takesATrailingBlock(text, call) ? null : call.args;
}

const WORD_BEFORE_PATTERN = /([A-Za-z_$@][\w$]*)\s*$/;
const NEW_BEFORE_PATTERN = /\bnew\s+$/;
const QUALIFIED_NEW_BEFORE_PATTERN = /\bnew\s+[\w$.]+\.\s*$/;

const DEFAULT_SEPARATOR_PATTERN_SOURCES = Object.freeze(["\\?\\.", "!!\\.", "\\."]);

const joinReceiverSeparators = finder => [...DEFAULT_SEPARATOR_PATTERN_SOURCES, ...finder.receiverSeparators].join("|");

const separatorPatternsByFinderMap = new WeakMap();

const DEFAULT_SEPARATOR_BEFORE_PATTERN = new RegExp(`(${DEFAULT_SEPARATOR_PATTERN_SOURCES.join("|")})\\s*$`);

const getOrBuildSeparatorPattern = finder => {
  if (!separatorPatternsByFinderMap.has(finder)) separatorPatternsByFinderMap.set(finder, new RegExp(`(${joinReceiverSeparators(finder)})\\s*$`));
  return separatorPatternsByFinderMap.get(finder);
};

const REFERENCE_SEPARATOR_BEFORE_PATTERN = /::\s*$/;

const matchAReceiverSeparatorAtTheEnd = (ahead, finder) => getOrBuildSeparatorPattern(finder).exec(ahead) || REFERENCE_SEPARATOR_BEFORE_PATTERN.exec(ahead);

export const endsInAReceiverSeparator = (ahead, finder) => Boolean(matchAReceiverSeparatorAtTheEnd(ahead, finder));

export function findReceiverBefore(code, at, finder) {
  const ahead = code.slice(0, at);
  const separator = matchAReceiverSeparatorAtTheEnd(ahead, finder);
  if (!separator) return NO_RECEIVER;
  const word = WORD_BEFORE_PATTERN.exec(ahead.slice(0, ahead.length - separator[0].length));
  return word ? word[1] : UNNAMED_RECEIVER;
}

const CLOSING_BRACKET_AT_THE_END_PATTERN = /[)\]]\s*$/;

const createNoChainRoot = () => ({ root: "", qualifier: "" });

const findOpenerOfTheClosingBracketAtTheEnd = (code, before) => findUnmatchedOpenerBefore(code, before.search(CLOSING_BRACKET_AT_THE_END_PATTERN));

const findEnclosingTypeQualifierAtTheEnd = behind => {
  const wordBefore = WORD_BEFORE_PATTERN.exec(behind);
  return wordBefore && WORDS_FOR_THE_ENCLOSING_TYPE.has(wordBefore[1].replace(/^\$/, "$")) ? wordBefore[1] : "";
};

export function findChainRootBefore(code, at, finder) {
  const separatorPattern = getOrBuildSeparatorPattern(finder);
  let position = at;
  for (let guard = 0; guard < 50; guard++) {
    const before = code.slice(0, position + 1);
    if (CLOSING_BRACKET_AT_THE_END_PATTERN.test(before)) {
      const opening = findOpenerOfTheClosingBracketAtTheEnd(code, before);
      if (opening < 0) return createNoChainRoot();
      position = opening - 1;
      continue;
    }
    const word = WORD_BEFORE_PATTERN.exec(before);
    if (!word) return createNoChainRoot();
    const ahead = code.slice(0, before.length - word[0].length);
    const separator = separatorPattern.exec(ahead);
    if (!separator) return { root: word[1], qualifier: "", constructed: NEW_BEFORE_PATTERN.test(ahead) };
    const behind = ahead.slice(0, ahead.length - separator[0].length);
    const enclosingTypeQualifier = findEnclosingTypeQualifierAtTheEnd(behind);
    if (enclosingTypeQualifier) return { root: word[1], qualifier: enclosingTypeQualifier };
    position = behind.length - 1;
  }
  return createNoChainRoot();
}

const buildDottedPattern = finder => {
  const terminators = ["!?\\("];
  if (finder.trailingBlockCalls) terminators.push("\\{");
  if (finder.doBlockCalls) terminators.push("\\s+do\\b");
  if (finder.callsWithoutParentheses) terminators.push("\\s+(?=[\\w:\"'@$\\[])", "\\s*;", "\\s*$");
  const privatePrefix = finder.privateNamePrefix || "";
  return new RegExp(`(${privatePrefix}[A-Za-z_$@][\\w$]*|\\)|\\])\\s*(${joinReceiverSeparators(finder)})\\s*(${privatePrefix}[A-Za-z_][\\w]*)\\s*(?:<[^()<>;]*(?:<[^()<>;]*>[^()<>;]*)*>|\\[[^()\\]]*\\])?\\s*(${terminators.join("|")})`, "gd");
};

const BARE_CALL_PATTERN = /(?<![\w$.@>:?\\#])([A-Za-z_][\w$]*)\s*(?:<[^()<>;=]*>)?\s*!?\(/g;
const CONSTRUCTOR_CALL_PATTERN = /\bnew\s+([A-Za-z_$][\w$.\\]*)\s*(?:<[^()]*>)?\s*[({[]/g;

const patternsByFinderMap = new WeakMap();

const getOrBuildDottedPattern = finder => {
  if (!patternsByFinderMap.has(finder)) patternsByFinderMap.set(finder, buildDottedPattern(finder));
  const pattern = patternsByFinderMap.get(finder);
  pattern.lastIndex = 0;
  return pattern;
};


function readReceiverPathBefore(code, receiverStart, receiver, finder) {
  const path = [receiver];
  let ahead = code.slice(0, receiverStart);
  for (;;) {
    const separator = getOrBuildSeparatorPattern(finder).exec(ahead);
    if (!separator || /\.\.\.\s*$/.test(ahead)) return path;
    const behind = ahead.slice(0, ahead.length - separator[0].length);
    const word = WORD_BEFORE_PATTERN.exec(behind);
    if (!word) return path;
    path.unshift(word[1]);
    ahead = behind.slice(0, behind.length - word[0].length);
  }
}

const findClosingBeforeTheReceiver = (code, receiverStart, finder) => {
  const ahead = code.slice(0, receiverStart);
  const separator = getOrBuildSeparatorPattern(finder).exec(ahead);
  if (!separator) return -1;
  const before = ahead.slice(0, ahead.length - separator[0].length).trimEnd();
  return before.endsWith(")") ? before.length - 1 : -1;
};

const isAMemberAfterADefaultSeparator = (code, word, wordEnd) => DEFAULT_SEPARATOR_BEFORE_PATTERN.test(code.slice(0, wordEnd - word[0].length));

const findIndexedNameBefore = (code, closing) => {
  const opening = findUnmatchedOpenerBefore(code, closing);
  if (opening < 0 || code[opening] !== "[") return "";
  const word = WORD_BEFORE_PATTERN.exec(code.slice(0, opening));
  if (!word || isAMemberAfterADefaultSeparator(code, word, opening)) return "";
  return word[1];
};

function findDottedCalls(code, finder, from) {
  const calls = [];
  for (const found of code.matchAll(getOrBuildDottedPattern(finder))) {
    const [, receiver, , callee, terminator] = found;
    const calleeAt = found.indices[3][0];
    if (calleeAt < from || QUALIFIED_NEW_BEFORE_PATTERN.test(code.slice(0, calleeAt))) continue;
    const opening = terminator.endsWith("(") ? found.indices[4][1] - 1 : -1;
    const argumentsRead = opening >= 0 ? readArgumentCountAndFirst(code, opening) : { count: terminator.trim() === "{" ? 1 : null, first: "" };
    const chained = receiver === ")" || receiver === "]";
    const chain = chained ? findChainRootBefore(code, found.index, finder) : { root: receiver, qualifier: findCallQualifierBefore(code, found.index, getOrBuildSeparatorPattern(finder)) };
    calls.push({
      col: calleeAt,
      form: CALL_FORMS.DOTTED,
      callee,
      receiver: chained ? "" : receiver,
      qualifier: chain.qualifier,
      root: chain.root,
      chained,
      rootConstructed: Boolean(chain.constructed),
      opening,
      closing: opening >= 0 ? findClosingParenthesis(code, opening) : -1,
      receiverAt: chained ? found.index : -1,
      qualifierAt: chained ? -1 : findClosingBeforeTheReceiver(code, found.index, finder),
      path: chained ? [] : readReceiverPathBefore(code, found.index, receiver, finder),
      indexedName: receiver === "]" ? findIndexedNameBefore(code, found.index) : "",
      block: !terminator.endsWith("("),
      args: argumentsRead.count,
      firstArgument: argumentsRead.first,
    });
  }
  return calls;
}

const isADeclarationName = (code, at) => DECLARING_WORDS_PATTERN.test(code.slice(0, at));

const isAConstructedTypeName = (code, at) => NEW_BEFORE_PATTERN.test(code.slice(0, at));

const HEAD_MODIFIERS = new Set(["public", "private", "protected", "internal", "static", "final", "abstract", "synchronized",
  "native", "strictfp", "default", "transient", "virtual", "override", "sealed", "async", "extern", "inline", "explicit",
  "constexpr", "consteval", "unsafe", "readonly", "partial", "external", "factory", "const", "volatile", "unsigned", "signed"]);

const SCRIPT_HEAD_MODIFIERS = new Set(["public", "private", "protected", "static", "async", "override", "readonly", "abstract",
  "get", "set", "declare", "accessor"]);

const WORDS_BEFORE_A_VALUE = new Set(["return", "throw", "else", "new", "await", "yield", "case", "goto", "delete", "typeof",
  "sizeof", "alignof", "in", "is", "as", "not", "and", "or", "do", "assert", "co_return", "co_await", "co_yield", "ref", "out",
  "select", "where", "orderby", "by", "equals", "on", "into", "group", "join", "ascending", "descending"]);

const TYPE_BEFORE_THE_NAME_PATTERN = /([A-Za-z_$][\w$]*(?:(?:\.|::)[A-Za-z_$][\w$]*)*)(?:\s*<[^()]*>)?(?:\s*\[\s*\])*(?:\s*[*&?]+\s*|\s+)$/;
const LAST_WORD_PATTERN = /([A-Za-z_$][\w$]*)$/;
const END_BEFORE_A_HEAD_PATTERN = /(?:^|[\w$;{}>\])])$/;
const TRAILING_ARROW_PATTERN = /[=-]>$/;
const TEXT_AFTER_A_TYPED_HEAD_PATTERN = /^\s*(?:(?:(?:const|override|final|noexcept|volatile|mutable)\b|async\*?|sync\*)\s*)*(?:\{|=>|->|throws\b|where\b|$)/;
const TEXT_AFTER_A_SCRIPT_HEAD_PATTERN = /^\s*(?:\{|:|$)/;
const BODY_OPENING_AFTER_A_SCRIPT_HEAD_PATTERN = /^\s*(?::[^;=?]*)?\{/;
const MEMBER_START_PATTERN = /(?:^|[{},;])$/;

const findTextAfterTheParameters = (code, opening) => {
  const closing = findClosingParenthesis(code, opening);
  return closing < 0 ? null : code.slice(closing + 1);
};

function isATypedHead(code, at, opening) {
  const before = code.slice(0, at);
  const type = TYPE_BEFORE_THE_NAME_PATTERN.exec(before);
  if (!type || WORDS_BEFORE_A_VALUE.has(type[1])) return false;
  const ahead = before.slice(0, type.index).trimEnd();
  if (!END_BEFORE_A_HEAD_PATTERN.test(ahead) || TRAILING_ARROW_PATTERN.test(ahead)) return false;
  const wordAhead = LAST_WORD_PATTERN.exec(ahead);
  if (wordAhead && WORDS_BEFORE_A_VALUE.has(wordAhead[1])) return false;
  const modified = HEAD_MODIFIERS.has(type[1]) || Boolean(wordAhead && HEAD_MODIFIERS.has(wordAhead[1])) || /[>\])]$/.test(ahead);
  const after = findTextAfterTheParameters(code, opening);
  return modified || after === null || TEXT_AFTER_A_TYPED_HEAD_PATTERN.test(after);
}

function isAScriptHead(code, at, opening) {
  const before = code.slice(0, at).trimEnd();
  const after = findTextAfterTheParameters(code, opening);
  const wordAhead = LAST_WORD_PATTERN.exec(before);
  if (wordAhead && SCRIPT_HEAD_MODIFIERS.has(wordAhead[1])) return after === null || TEXT_AFTER_A_SCRIPT_HEAD_PATTERN.test(after);
  return MEMBER_START_PATTERN.test(before) && after !== null && BODY_OPENING_AFTER_A_SCRIPT_HEAD_PATTERN.test(after);
}

const METHOD_HEAD_READERS = Object.freeze({ typed: isATypedHead, script: isAScriptHead });

const isAMethodHead = (code, at, opening, finder) => {
  const readHead = METHOD_HEAD_READERS[finder.methodHeads];
  return readHead ? readHead(code, at, opening) : false;
};

function findBareCalls(code, finder, from) {
  const calls = [];
  for (const found of code.matchAll(BARE_CALL_PATTERN)) {
    const callee = found[1];
    if (found.index < from || isNeverACallee(callee, finder) || isADeclarationName(code, found.index)) continue;
    if (isAConstructedTypeName(code, found.index)) continue;
    const opening = found.index + found[0].length - 1;
    if (isAMethodHead(code, found.index, opening, finder)) continue;
    const argumentsRead = readArgumentCountAndFirst(code, opening);
    calls.push(createBareCall({ col: found.index, callee, opening, closing: findClosingParenthesis(code, opening), args: argumentsRead.count, firstArgument: argumentsRead.first }));
  }
  return calls;
}

function findConstructorCalls(code, from) {
  const calls = [];
  for (const found of code.matchAll(CONSTRUCTOR_CALL_PATTERN)) {
    if (found.index < from) continue;
    const pieces = found[1].split(/\.|\\/);
    const type = pieces.pop();
    const opening = code.indexOf("(", found.index);
    const argumentsRead = opening >= 0 && opening < found.index + found[0].length ? readArgumentCountAndFirst(code, opening) : { count: null, first: "" };
    const closing = opening >= 0 && opening < found.index + found[0].length ? findClosingParenthesis(code, opening) : -1;
    calls.push({ col: found.index, form: CALL_FORMS.NEW, callee: type, scope: pieces.join("."), receiver: "", qualifier: "", root: type, chained: false, opening, closing, block: false, args: argumentsRead.count, firstArgument: argumentsRead.first });
  }
  return calls;
}

const compareByColumn = (left, right) => left.col - right.col;

const filterBareCallsAtColumnsNoDottedCallHolds = (bare, dotted) => {
  const dottedColumns = new Set(dotted.map(call => call.col));
  return bare.filter(call => !dottedColumns.has(call.col));
};

export function readCallsInColumnOrder(text, finder, from) {
  const dotted = findDottedCalls(text, finder, from);
  return [
    ...dotted,
    ...filterBareCallsAtColumnsNoDottedCallHolds(findBareCalls(text, finder, from), dotted),
    ...findConstructorCalls(text, from),
    ...finder.findMoreCallsOnLine(text, from),
  ].sort(compareByColumn);
}
