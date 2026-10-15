import { readCodeOfLine, indentOf } from "../../../../../inputs/source/SourceText.mjs";
import { findClosingParenthesis, ONLY_PARENTHESES } from "../../../../../inputs/source/text/Brackets.mjs";
import { CONTROL_WORD_PATTERN_SOURCE } from "../../../../../inputs/source/forms/FunctionNamePatterns.mjs";

const MAX_LINES_BEFORE_THE_NAME = 3;
const MAX_LINES_OF_THE_PARAMETERS = 12;

const LINE_OF_TYPE_TEXT_PATTERN = /^[\w$<>,.?[\]&@\s]+$/;
const NAME_LINE_PATTERN = /^([\w$<>,.?[\]&\s]*?)\b([A-Za-z_$][\w$]*)\s*\(/;
const CONTINUING_LINE_END_PATTERN = /[=+\-%&|^!?:,.([<]$/;
const BODY_AFTER_THE_PARAMETERS_PATTERN = /^\s*(?:throws\b|\{|;)/;
const WORDS_NEVER_A_TYPE = new Set([...CONTROL_WORD_PATTERN_SOURCE.split("|"), "case", "default", "assert", "else", "package", "import", "extends", "implements", "super", "this"]);

const countOf = (text, character) => text.split(character).length - 1;

const readCode = (lines, index) => readCodeOfLine(lines[index]).trim();

function collectLinesBeforeTheName(lines, index) {
  const before = [];
  for (let at = index - 1; at >= 0 && before.length < MAX_LINES_BEFORE_THE_NAME; at--) {
    const code = readCode(lines, at);
    if (!code || !LINE_OF_TYPE_TEXT_PATTERN.test(code)) return { before, previous: code };
    before.unshift(code);
  }
  return { before, previous: index - before.length - 1 >= 0 ? readCode(lines, index - before.length - 1) : "" };
}

const readHeadWords = prefix => prefix.replace(/@[\w$.]+/g, " ").replace(/<[^<>]*>/g, " ").replace(/<[^<>]*>/g, " ").replace(/<[^<>]*>/g, " ")
  .split(/\s+/).filter(Boolean);

const endsInOneType = (prefix, modifierWords) => {
  if (countOf(prefix, "<") !== countOf(prefix, ">") || /,\s*$/.test(prefix)) return false;
  const words = readHeadWords(prefix);
  if (!words.length || words.some(word => WORDS_NEVER_A_TYPE.has(word) && !modifierWords.has(word))) return false;
  const typeWords = words.filter(word => !modifierWords.has(word));
  return typeWords.length === 1 && /^[A-Za-z_$][\w$.]*(?:\[\])*$/.test(typeWords[0]) && words.indexOf(typeWords[0]) === words.length - 1;
};

function opensABodyAfterTheParameters(lines, index, name) {
  const text = lines.slice(index, index + MAX_LINES_OF_THE_PARAMETERS).map(line => readCodeOfLine(line)).join(" ");
  const opening = text.indexOf("(", text.search(new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\s*\\(`)));
  const closing = opening < 0 ? -1 : findClosingParenthesis(text, opening, ONLY_PARENTHESES);
  return closing >= 0 && BODY_AFTER_THE_PARAMETERS_PATTERN.test(text.slice(closing + 1));
}

export function readHeadWrappedBeforeTheName(lines, index, modifierWords) {
  const found = NAME_LINE_PATTERN.exec(readCode(lines, index));
  if (!found || WORDS_NEVER_A_TYPE.has(found[2])) return null;
  const { before, previous } = collectLinesBeforeTheName(lines, index);
  if (!before.length || CONTINUING_LINE_END_PATTERN.test(previous)) return null;
  const prefix = [...before, found[1]].join(" ").trim();
  if (!endsInOneType(prefix, modifierWords) || !opensABodyAfterTheParameters(lines, index, found[2])) return null;
  const headLines = lines.slice(index - before.length, index + 1).map(line => String(line));
  return { line: index + 1, before: before.join(" "), text: `${" ".repeat(indentOf(headLines[0]))}${headLines.map(line => line.trim()).join(" ")}` };
}

export const findHeadsWrappedBeforeTheName = (lines, modifierWords) => lines
  .map((line, index) => readHeadWrappedBeforeTheName(lines, index, modifierWords))
  .filter(Boolean);
