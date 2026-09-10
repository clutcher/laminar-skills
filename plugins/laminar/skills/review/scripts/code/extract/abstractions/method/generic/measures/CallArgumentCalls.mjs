import { isANonBlankCodeLine } from "../../../../../inputs/source/lines/LineKinds.mjs";
import { WORDS_FOR_THE_ENCLOSING_TYPE } from "../../../../../inputs/source/names/LanguageWords.mjs";
import { namesAType } from "../../../../../inputs/source/names/NamingConventions.mjs";
import { readCallEffects } from "../../../../finders/LanguageStrategies.mjs";
import { findCallsOnLine } from "../calls/CallReading.mjs";
import { splitDeclarationHead } from "../signatures/MethodSignatures.mjs";

const STRING_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;
const TRAILING_COMMENT_PATTERN = /\s(\/\/|#)\s.*$/;
const FUNCTION_IN_AN_ARGUMENT_PATTERN = /->|=>|\b(lambda|function|func|fn|proc)\b|\|[^|]*\|/;
const STATEMENT_BRACKETS = Object.freeze({ "(": 1, "[": 1, ")": -1, "]": -1 });
const ARGUMENT_BRACKETS = Object.freeze({ "(": 1, "[": 1, "{": 1, ")": -1, "]": -1, "}": -1 });
const CONSTRUCTOR_FORM = "new";
const BRACE = "{";
const CLOSING_BRACE = "}";
const LINE_JOINER = " ";

const blankTheStrings = text => text.replace(STRING_PATTERN, found => `"${" ".repeat(found.length - 2)}"`);

const blankTheTrailingComment = text => String(text).replace(TRAILING_COMMENT_PATTERN, found => " ".repeat(found.length));

const countOpenedBrackets = code => [...code].reduce((open, character) => open + (STATEMENT_BRACKETS[character] || 0), 0);

function listBodyLines(numberedLines) {
  const codeLines = numberedLines.filter(({ text }) => isANonBlankCodeLine(text));
  const { bodyLines } = splitDeclarationHead(codeLines.map(({ text }) => text));
  return codeLines.slice(codeLines.length - bodyLines.length);
}

function joinStatements(bodyLines) {
  const statements = [];
  let open = 0;
  for (const { line, text } of bodyLines) {
    if (open <= 0) statements.push({ code: "", starts: [] });
    const statement = statements[statements.length - 1];
    if (statement.code) statement.code += LINE_JOINER;
    statement.starts.push({ line, at: statement.code.length });
    statement.code += blankTheTrailingComment(text);
    open = countOpenedBrackets(blankTheStrings(statement.code));
  }
  return statements.map(statement => ({ ...statement, code: blankTheStrings(statement.code) }));
}

const readLineAt = (statement, at) => statement.starts.filter(start => start.at <= at).pop().line;

const nameTheCall = call => [...(call.path || []), call.callee].join(".");

const holdsTheColumn = (outer, inner) => outer !== inner && outer.opening < inner.col && inner.col < outer.closing;

const findInnermostOuterCall = (calls, inner) => calls
  .filter(outer => holdsTheColumn(outer, inner))
  .sort((left, right) => (left.closing - left.opening) - (right.closing - right.opening))[0] || null;

function readArgumentBefore(code, outer, at) {
  let depth = 0;
  let braces = 0;
  let start = outer.opening + 1;
  for (let index = outer.opening + 1; index < at; index++) {
    const character = code[index];
    depth += ARGUMENT_BRACKETS[character] || 0;
    if (character === BRACE) braces++;
    if (character === CLOSING_BRACE) braces--;
    if (character === "," && depth === 0) start = index + 1;
  }
  return { start, text: code.slice(start, at), opensABlock: braces > 0 };
}

const holdsAFunctionBefore = (code, outer, before) => code[outer.opening] === BRACE || before.opensABlock || FUNCTION_IN_AN_ARGUMENT_PATTERN.test(before.text);

const isOnAnOutsideObject = call => call.chained || (Boolean(call.receiver) && !WORDS_FOR_THE_ENCLOSING_TYPE.has(call.receiver));

const isOnAType = call => (call.path || []).length === 1 && namesAType(call.receiver);

const readsAValue = (call, effects) => call.args === 0 || effects.staysInMemoryWhenCalled(call.callee) || effects.isAnObjectProtocolCallee(call.callee);

const isAnOutsideOperation = (call, effects) => call.form !== CONSTRUCTOR_FORM && isOnAnOutsideObject(call) && !isOnAType(call) && !readsAValue(call, effects);

function findCallsOfAStatement(statement, diffDriver, effects) {
  const calls = findCallsOnLine(statement.code, diffDriver);
  const found = [];
  const shownArguments = new Set();
  for (const inner of calls) {
    if (!isAnOutsideOperation(inner, effects)) continue;
    const outer = findInnermostOuterCall(calls, inner);
    if (!outer) continue;
    const before = readArgumentBefore(statement.code, outer, inner.col);
    if (holdsAFunctionBefore(statement.code, outer, before)) continue;
    const argumentKey = `${outer.opening}:${before.start}`;
    if (shownArguments.has(argumentKey)) continue;
    shownArguments.add(argumentKey);
    found.push({ line: readLineAt(statement, inner.col), outer: nameTheCall(outer), inner: nameTheCall(inner) });
  }
  return found;
}

export function findCallsInsideCallArguments(numberedLines, { diffDriver } = {}) {
  if (!diffDriver) return [];
  const effects = readCallEffects(diffDriver);
  return joinStatements(listBodyLines(numberedLines))
    .flatMap(statement => findCallsOfAStatement(statement, diffDriver, effects));
}
