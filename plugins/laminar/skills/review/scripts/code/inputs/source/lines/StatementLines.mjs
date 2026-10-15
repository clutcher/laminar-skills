import { countOpened } from "../text/Brackets.mjs";
import { STRING_LITERAL_PATTERN } from "../text/TextLiterals.mjs";

const ROUND_AND_SQUARE_BRACKETS = "([";
const MAX_LINES_OF_A_STATEMENT = 8;

const STARTS_AS_A_CONTINUATION_PATTERN = /^\s*(?:\?|:(?!:)|&&|\|\||\band\b|\bor\b)/;
const ENDS_OPEN_PATTERN = /(?:\?|&&|\|\||[^=!<>]=|\band|\bor)\s*$/;
const ENDS_THE_STATEMENT_PATTERN = /[;{}]\s*$/;

const readCode = text => String(text || "").replace(STRING_LITERAL_PATTERN, " ");

const countBracketsLeftOpen = text => countOpened(readCode(text), ROUND_AND_SQUARE_BRACKETS);

const goesOnFrom = (statement, nextText) => {
  if (statement.lines.length >= MAX_LINES_OF_A_STATEMENT) return false;
  if (STARTS_AS_A_CONTINUATION_PATTERN.test(readCode(nextText))) return true;
  const lastCode = readCode(statement.lastText);
  return !ENDS_THE_STATEMENT_PATTERN.test(lastCode) && (statement.open > 0 || ENDS_OPEN_PATTERN.test(lastCode));
};

const startStatement = numberedLine => ({ lines: [numberedLine.line], texts: [numberedLine.text], lastText: numberedLine.text, open: countBracketsLeftOpen(numberedLine.text) });

const extendStatement = (statement, numberedLine) => ({
  lines: [...statement.lines, numberedLine.line],
  texts: [...statement.texts, numberedLine.text],
  lastText: numberedLine.text,
  open: statement.open + countBracketsLeftOpen(numberedLine.text),
});

const finishStatement = statement => ({ from: statement.lines[0], to: statement.lines[statement.lines.length - 1], text: statement.texts.map(text => text.trim()).join(" ") });

export function joinStatementLines(numberedLines) {
  const statements = [];
  let current = null;
  for (const numberedLine of numberedLines) {
    if (current && goesOnFrom(current, numberedLine.text)) { current = extendStatement(current, numberedLine); continue; }
    if (current) statements.push(finishStatement(current));
    current = startStatement(numberedLine);
  }
  if (current) statements.push(finishStatement(current));
  return statements;
}

export const joinStatementTexts = texts => joinStatementLines(texts.map((text, offset) => ({ line: offset + 1, text }))).map(statement => statement.text);

export function readStatementAt(fileLines, line, reach = MAX_LINES_OF_A_STATEMENT) {
  const from = Math.max(1, line - reach);
  const to = Math.min(fileLines.length, line + reach);
  const numberedLines = [];
  for (let at = from; at <= to; at++) numberedLines.push({ line: at, text: String(fileLines[at - 1] ?? "") });
  return joinStatementLines(numberedLines).find(statement => statement.from <= line && line <= statement.to) || { from: line, to: line, text: String(fileLines[line - 1] ?? "") };
}
