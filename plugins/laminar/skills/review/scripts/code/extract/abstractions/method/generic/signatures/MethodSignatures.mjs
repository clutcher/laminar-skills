import { splitTopLevelArguments } from "../../../../../inputs/source/text/TypeText.mjs";
import { splitIntoTopLevelPieces, findTopLevelIndex } from "../../../../../inputs/source/text/TopLevelText.mjs";
import { findClosingParenthesis, ONLY_PARENTHESES, countOpened, walkParenthesesBalances } from "../../../../../inputs/source/text/Brackets.mjs";
import { isInMemoryTypeName } from "../calls/InMemoryCalls.mjs";
import { METHOD_FINDER_REGISTRY } from "../../index.mjs";
import { FinderContext } from "../../../../finders/FinderContext.mjs";
import { buildWholeWordPattern } from "../../../../../inputs/source/text/PatternText.mjs";
import { findTextAroundTheWord } from "../../../../../inputs/source/text/TextAroundAWord.mjs";
import { isANonBlankCodeLine } from "../../../../../inputs/source/lines/LineKinds.mjs";
import { ANNOTATION_START_PATTERN } from "../../../../../inputs/source/lines/Annotations.mjs";

const findMethodFinder = diffDriver => METHOD_FINDER_REGISTRY.findWalkingFinder(FinderContext.createForLanguage(diffDriver));

export const readReturnTypes = ({ before, after, diffDriver }) => findMethodFinder(diffDriver).findReturnTypes(before, after);

const CLOSING_OF_A_LIST = { "<": ">", "[": "]" };
const WORDS_BEFORE_A_TYPE_PARAMETER_PATTERN = /^(?:(?:typename|class|in|out|reified|const|type)\s+|[+-]\s*)+/;
const TYPE_PARAMETER_PATTERN = /^[A-Za-z_$][\w$]*/;

const SIGNATURE_END_PATTERN = /[;{}]/;

const endsTheSignature = character => SIGNATURE_END_PATTERN.test(character);

function findIndexClosingTheList(text, opening) {
  const opens = text[opening];
  const closes = CLOSING_OF_A_LIST[opens];
  let depth = 0;
  for (let at = opening; at < text.length; at++) {
    if (text[at] === opens) depth++;
    else if (text[at] === closes) { depth--; if (depth === 0) return at; }
    else if (endsTheSignature(text[at])) return -1;
  }
  return -1;
}

const readNamesOfATypeParameterList = inside => splitTopLevelArguments(inside)
  .filter(parameterText => !parameterText.startsWith("'"))
  .map(parameterText => (TYPE_PARAMETER_PATTERN.exec(parameterText.replace(WORDS_BEFORE_A_TYPE_PARAMETER_PATTERN, "")) || [""])[0])
  .filter(Boolean);

const findNamesOfTheListAt = (text, opening) => {
  const closing = findIndexClosingTheList(text, opening);
  return closing < 0 ? [] : readNamesOfATypeParameterList(text.slice(opening + 1, closing));
};

function readNamesInTheListsBeforeTheName(text) {
  const names = [];
  for (const found of text.matchAll(/(?:^|\s|\btemplate\s*)</g)) names.push(...findNamesOfTheListAt(text, found.index + found[0].length - 1));
  return names;
}

function readNamesInTheListAfterTheName(text) {
  const opening = /^\s*</.exec(text) || /^\[/.exec(text);
  return opening ? findNamesOfTheListAt(text, opening[0].length - 1) : [];
}

export function findTypeParameters(head, name) {
  const around = findTextAroundTheWord(String(head || ""), name);
  if (!around) return [];
  return [...new Set([...readNamesInTheListsBeforeTheName(around.before), ...readNamesInTheListAfterTheName(around.after)])];
}

const MAX_HEAD_LINES = 12;

const WRAPPER_TYPE_NAMES = new Set(["Promise", "Future", "CompletableFuture", "CompletionStage", "Mono", "Flux", "Task", "ValueTask", "Observable",
  "Uni", "Multi", "Awaitable", "Coroutine", "Void", "Unit", "None", "Self", "Any", "Object"]);

const WORDS_THAT_NAME_NO_PARAMETER = new Set(["self", "cls", "this", "&self", "&mut self", "mut self"]);

const ANNOTATION_PATTERN = /@[\w$.]+(?:\s*\([^()]*\))?/g;

const MODIFIERS_PATTERN = /^(?:(?:final|readonly|public|private|protected|const|in|out|ref|params|vararg|val|var|mut)\s+)+/;

const isASingleColonAt = (text, at) => text[at] === ":" && text[at + 1] !== ":" && text[at - 1] !== ":";

const isADefaultAt = (text, at) => text[at] === "=" && text[at + 1] !== ">";

const findTopLevelColonAt = text => findTopLevelIndex(text, isASingleColonAt);

const stripDefault = text => {
  const at = findTopLevelIndex(text, isADefaultAt);
  return (at < 0 ? text : text.slice(0, at)).trim();
};

export const readTypeNamesOfATypeText = (text, diffDriver) => [...new Set((String(text || "").replace(ANNOTATION_PATTERN, " ").match(/(?<![\w$])[A-Z][\w$]*/g) || [])
  .filter(name => !isInMemoryTypeName(name, diffDriver) && !WRAPPER_TYPE_NAMES.has(name)))];

const readTypeTextOfParameter = (parameterText, diffDriver) => {
  const bare = stripDefault(parameterText.replace(ANNOTATION_PATTERN, " ").replace(/^\.\.\.|^\*{1,2}/, "").trim()).replace(MODIFIERS_PATTERN, "");
  const colon = findTopLevelColonAt(bare);
  if (colon >= 0) return bare.slice(colon + 1).trim();
  if (findMethodFinder(diffDriver).parameterTypeFollowsTheName) return bare.replace(/^[A-Za-z_]\w*\s+/, "").trim();
  const lastWord = /\s+[A-Za-z_$][\w$]*\s*$/.exec(bare);
  return lastWord ? bare.slice(0, lastWord.index).trim() : "";
};

export const NO_PARAMETER_TEXT = null;

export const findParameterTextAfterTheName = (text, name) => {
  const nameAt = text.search(buildWholeWordPattern(name));
  const opening = nameAt < 0 ? -1 : text.indexOf("(", nameAt);
  if (opening < 0) return NO_PARAMETER_TEXT;
  const closing = findClosingParenthesis(text, opening, ONLY_PARENTHESES);
  return closing < 0 ? NO_PARAMETER_TEXT : text.slice(opening + 1, closing);
};

export const readParameterTextOfTheHead = (lines, method, lastLine) => {
  const head = [];
  for (let line = method.line; line < method.line + MAX_HEAD_LINES && line <= lastLine; line++) head.push(String(lines[line - 1] || ""));
  return findParameterTextAfterTheName(head.join(" "), method.name) ?? "";
};

export function readSignature(lines, method, diffDriver) {
  const parameters = splitIntoTopLevelPieces(readParameterTextOfTheHead(lines, method, Math.max(method.to, method.line)))
    .filter(parameterText => !WORDS_THAT_NAME_NO_PARAMETER.has(parameterText.replace(/:.*$/, "").trim()))
    .map(parameterText => readTypeTextOfParameter(parameterText, diffDriver))
    .filter(Boolean)
    .map(typeText => ({ typeText, typeNames: readTypeNamesOfATypeText(typeText, diffDriver) }));
  const returnNames = readTypeNamesOfATypeText((method.returns || [])[0] || "", diffDriver);
  return {
    parameters,
    returnNames,
    typeNames: [...new Set([...parameters.flatMap(parameter => parameter.typeNames), ...returnNames])],
  };
}

const PARAMETER_THAT_TAKES_NO_ARGUMENT_PATTERN = /^(?:(?:&\s*)?(?:mut\s+)?self|cls|this\s*:.*|\*|\/|void)$/;

const VARIADIC_PARAMETER_PATTERN = /^(?:\.\.\.|\*|params\s|vararg\s)|\.\.\./;

const DEFAULTED_PARAMETER_PATTERN = /(?<![=!<>])=(?![=>])|^[\w$]+\?\s*:|^&[\w$]+$/;

export const countParameters = parameterListText => {
  const parameterTexts = splitIntoTopLevelPieces(String(parameterListText).trim().replace(/^\(|\)$/g, ""))
    .map(parameterText => parameterText.replace(ANNOTATION_PATTERN, "").trim())
    .filter(parameterText => parameterText && !PARAMETER_THAT_TAKES_NO_ARGUMENT_PATTERN.test(parameterText));
  const variadic = parameterTexts.some(parameterText => VARIADIC_PARAMETER_PATTERN.test(parameterText));
  const required = parameterTexts.filter(parameterText => !VARIADIC_PARAMETER_PATTERN.test(parameterText) && !DEFAULTED_PARAMETER_PATTERN.test(parameterText));
  return { least: required.length, most: variadic ? null : parameterTexts.length };
};

export const readParameterNamesOfAList = (text, driver) => findMethodFinder(driver.diffDriver).parseParameterNamesOfAList(text, driver);

const BODY_OPENING_PATTERN = /[{:]\s*$/;

const MAX_LINES_OF_A_HEAD = 12;

function findIndexAfterTheAnnotations(code) {
  let index = 0;
  while (index < code.length && ANNOTATION_START_PATTERN.test(code[index])) {
    let balance = countOpened(code[index]);
    index++;
    while (index < code.length && balance > 0) { balance += countOpened(code[index]); index++; }
  }
  return index;
}

export function splitDeclarationHead(lines) {
  const code = lines.filter(isANonBlankCodeLine);
  const start = findIndexAfterTheAnnotations(code);
  for (const { index, balance } of walkParenthesesBalances(code, start, Math.min(code.length, start + MAX_LINES_OF_A_HEAD))) {
    if (balance <= 0 && BODY_OPENING_PATTERN.test(code[index])) {
      return { headText: code.slice(start, index + 1).join(" "), bodyLines: code.slice(index + 1) };
    }
  }
  return { headText: code.length > start ? code[start] : "", bodyLines: code.slice(start + 1) };
}
