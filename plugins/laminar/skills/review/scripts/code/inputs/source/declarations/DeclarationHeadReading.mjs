import { NO_DECLARATION } from "../drivers/LanguageDriver.mjs";
import { Scale } from "../../../graph/abstractions/Scale.mjs";
import { CONTROL_WORD_PATTERN_SOURCE } from "../forms/FunctionNamePatterns.mjs";
import { findLanguage } from "../Languages.mjs";
import { readCodeOfLine, stripTypeArguments } from "../SourceText.mjs";
import { doesBodyOpenBelow } from "../text/BlockEnds.mjs";
import { splitScopeAndName } from "../names/QualifiedNames.mjs";

const [CLASS, METHOD, VARIABLE] = [Scale.CLASS.name, Scale.METHOD.name, Scale.VARIABLE.name];

const CLASS_WORD_LIST = ["class", "interface", "enum", "record", "struct", "union", "trait", "impl", "object",
  "protocol", "type", "typedef", "typealias", "namespace", "module", "mod", "mixin", "extension", "actor",
  "implementation", "defmodule", "defprotocol", "defimpl"];
const METHOD_WORD_LIST = ["function", "def", "defp", "defmacro", "fn", "fun", "func", "sub", "procedure",
  "constructor", "init", "deinit", "subscript"];

const buildWordRegex = words => new RegExp(`\\b(${words.join("|")})\\b`);
export const CLASS_WORDS_PATTERN = buildWordRegex(CLASS_WORD_LIST);
export const METHOD_WORDS_PATTERN = buildWordRegex(METHOD_WORD_LIST);
const BINDING_WORDS_PATTERN = buildWordRegex(["const", "let", "var", "val", "local"]);
const DECLARATION_WORDS = new Set([...CLASS_WORD_LIST, ...METHOD_WORD_LIST]);
const WORDS_NEVER_A_CALLABLE_NAME = new Set(["function", "def", "defp", "defmacro", "fn", "fun", "func", "sub",
  "procedure", ...CONTROL_WORD_PATTERN_SOURCE.split("|").filter(word => word !== "new"), "match", "guard", "typeof", "elif",
  "elseif", "unless", "until", "foreach", "when"]);

const TYPE_NAME_PATTERN = /^\s*([A-Za-z_$][\w$]*(?:(?:\.|::|\\)[A-Za-z_$][\w$]*)*)(.*)$/;
const ASSIGNED_FUNCTION_PATTERN = /=\s*(?:[A-Za-z_$][\w$.]*(?:<[^>]*>)?\(\s*)?(async\s+)?(function\b|\([^)]*\)\s*(:[^=]*)?=>|[A-Za-z_$][\w$]*\s*=>)/;
const CALL_OPENED_AFTER_ASSIGNMENT_PATTERN = /=\s*[A-Za-z_$][\w$.]*(?:<[^>]*>)?\(\s*$/;
const FUNCTION_START_PATTERN = /^(?:\(|async\b|function\b|[A-Za-z_$][\w$]*\s*=>)/;
const WRAPPED_HEAD_END_PATTERN = /(?:[(,)]|\bthrows\b[^;{}]*)$/;
const CONTROL_WORD_START_PATTERN = new RegExp(`^(${CONTROL_WORD_PATTERN_SOURCE})\\b`);

const findWordAfter = (flat, word) => (/^\s*([A-Za-z_$][\w$]*)/.exec(flat.slice(word.index + word[0].length)) || [])[1] || null;
const findDottedWordAfter = (flat, word) => (/^\s*([A-Za-z_$][\w$]*(?:(?:\.|::|:)[A-Za-z_$][\w$]*)*[?!]?)/.exec(flat.slice(word.index + word[0].length)) || [])[1] || null;

function readCallableName(flat) {
  for (const found of flat.matchAll(/([A-Za-z_$][\w$]*(?:(?:\.|::|:)[A-Za-z_$][\w$]*)*[?!]?)\s*\(/g)) {
    if (!WORDS_NEVER_A_CALLABLE_NAME.has(found[1])) return found[1];
  }
  const assigned = /([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b|\(|[A-Za-z_$][\w$]*\s*=>)/.exec(flat);
  if (assigned) return assigned[1];
  const methodWord = METHOD_WORDS_PATTERN.exec(flat);
  return (methodWord && findDottedWordAfter(flat, methodWord)) || flat.slice(0, 60);
}

function readTypeDeclaration(flat, classWord) {
  let rest = flat.slice(classWord.index + classWord[0].length);
  let name = null;
  for (let found = TYPE_NAME_PATTERN.exec(rest); found; found = TYPE_NAME_PATTERN.exec(rest)) {
    rest = found[2];
    if (!CLASS_WORDS_PATTERN.test(found[1])) { name = found[1]; break; }
  }
  if (!name) return flat.includes("(") ? { scale: METHOD, name: readCallableName(flat), scope: null } : { scale: CLASS, name: flat.slice(0, 60), scope: null };
  if (classWord[1] === "object" && /^\s*\(/.test(rest)) return { scale: METHOD, name, scope: null };
  const forType = /^\s*for\s+([A-Za-z_$][\w$]*)/.exec(rest);
  if (forType) return { scale: CLASS, name: forType[1], scope: null };
  const returnType = /^[\s*&]*([A-Za-z_$][\w$]*)\s*\(/.exec(rest);
  if (returnType) return { scale: METHOD, name: returnType[1], scope: null };
  return { scale: CLASS, name, scope: null };
}

function wrapsAFunctionBelow(lines, index) {
  if (!CALL_OPENED_AFTER_ASSIGNMENT_PATTERN.test(readCodeOfLine(lines[index]).trim())) return false;
  const below = lines.slice(index + 1).find(line => String(line).trim());
  return Boolean(below) && FUNCTION_START_PATTERN.test(String(below).trim());
}

const HEAD_END_PATTERN = /[{;:]\s*$/;

export const endsADeclarationHead = text => HEAD_END_PATTERN.test(text);

const stripHeadEnd = headLine => String(headLine || "").trim().replace(HEAD_END_PATTERN, "").trim();

const doesBindingHeadTheLine = (flat, bindingWord, paren) => {
  if (!bindingWord) return false;
  return (paren < 0 || bindingWord.index < paren) && !DECLARATION_WORDS.has(findWordAfter(flat, bindingWord));
};

export function readDeclaration(diffDriver, headLine) {
  const head = stripHeadEnd(headLine);
  if (!head) return NO_DECLARATION;
  const language = findLanguage(diffDriver);
  const ownRead = language.readDeclaration ? language.readDeclaration(head) : null;
  if (ownRead) return ownRead;
  const flat = stripTypeArguments(head);
  const classWord = CLASS_WORDS_PATTERN.exec(flat);
  const typeName = language.findTypeNameBefore ? language.findTypeNameBefore(flat.slice(0, (classWord || { index: 0 }).index)) : null;
  if (typeName) return { scale: CLASS, name: typeName, scope: null };
  const methodWord = METHOD_WORDS_PATTERN.exec(flat);
  const bindingWord = BINDING_WORDS_PATTERN.exec(flat);
  const paren = flat.indexOf("(");
  if (doesBindingHeadTheLine(flat, bindingWord, paren)) return { scale: ASSIGNED_FUNCTION_PATTERN.test(flat) ? METHOD : VARIABLE, name: findWordAfter(flat, bindingWord), scope: null };
  const methodWordFollows = methodWord && classWord && methodWord.index > classWord.index;
  if (classWord && (paren < 0 || classWord.index < paren) && !methodWordFollows) return readTypeDeclaration(flat, classWord);
  if (methodWord || paren >= 0) return { scale: METHOD, ...splitScopeAndName(readCallableName(flat)) };
  return NO_DECLARATION;
}

export function readDeclarationAt(diffDriver, lines, index) {
  const read = readDeclaration(diffDriver, lines[index]);
  return read.scale === VARIABLE && wrapsAFunctionBelow(lines, index) ? { ...read, scale: METHOD } : read;
}

export function readsAsAHeadShape(diffDriver, text) {
  if (!text || /^[}\])]/.test(text) || CONTROL_WORD_START_PATTERN.test(text)) return false;
  const read = readDeclaration(diffDriver, text);
  return (read.scale === METHOD || read.scale === CLASS) && (Boolean(read.isATestCall) || /^[A-Za-z_$][\w$?!]*$/.test(read.name || ""));
}

export function looksLikeDeclaration(diffDriver, line) {
  const text = String(line).trim();
  if (!readsAsAHeadShape(diffDriver, text)) return false;
  return /[{}]\s*$/.test(text) || CLASS_WORDS_PATTERN.test(text) || METHOD_WORDS_PATTERN.test(text);
}

export function endsAWrappedHead(diffDriver, line) {
  const text = String(line).trim();
  return WRAPPED_HEAD_END_PATTERN.test(readCodeOfLine(text).trim()) && !looksLikeDeclaration(diffDriver, text) && readsAsAHeadShape(diffDriver, text);
}

export function looksLikeDeclarationAt(diffDriver, lines, index) {
  const text = String(lines[index] || "");
  if (looksLikeDeclaration(diffDriver, text)) return true;
  return endsAWrappedHead(diffDriver, text) && doesBodyOpenBelow(lines, index);
}

export const startsACallThatSpansLines = (diffDriver, lines, index) => endsAWrappedHead(diffDriver, lines[index]) && !doesBodyOpenBelow(lines, index);

export function readTypeName(diffDriver, head) {
  if (!head) return "";
  const read = readDeclaration(diffDriver, head);
  return read.name && /^[A-Za-z_$][\w$]*$/.test(read.name) ? read.name : "";
}
