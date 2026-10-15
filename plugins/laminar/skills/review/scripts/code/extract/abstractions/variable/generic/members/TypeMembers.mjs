import { walkParenthesesBalances, findClosingParenthesis } from "../../../../../inputs/source/text/Brackets.mjs";
import { splitIntoTopLevelPieces } from "../../../../../inputs/source/text/TopLevelText.mjs";
import { readCodeOfLine } from "../../../../../inputs/source/SourceText.mjs";
import { Scale } from "../../../../../graph/abstractions/Scale.mjs";

const MAX_HEAD_LINES = 40;

const CLASS_MEMBER_PATTERN = /\bstatic\b/;

const indentOf = text => (/^[ \t]*/.exec(text) || [""])[0].length;

const endsTheHead = (text, line, typeLine) => text.includes("{") || text.includes(")") || line > typeLine;

export const listHeadLineNumbers = (lines, typeLine) => {
  const head = [];
  for (const { index, balance } of walkParenthesesBalances(lines, typeLine - 1, Math.min(typeLine - 1 + MAX_HEAD_LINES, lines.length))) {
    head.push(index + 1);
    if (balance <= 0 && endsTheHead(String(lines[index] || ""), index + 1, typeLine)) break;
  }
  return head;
};

const readHeadText = (lines, typeLine) => listHeadLineNumbers(lines, typeLine).map(line => String(lines[line - 1] || "")).join(" ");

const findBodyIndent = (lines, typeLine, span) => {
  for (let line = typeLine + 1; line <= span.to; line++) {
    const text = String(lines[line - 1] || "");
    if (text.trim() && !/^\s*[})\]]/.test(text)) return indentOf(text);
  }
  return -1;
};

const BODY_OPENER = "{";

const findMembersOfABodyOnTheHeadLine = (driver, lines, typeLine) => {
  const code = readCodeOfLine(lines[typeLine - 1]);
  const opening = code.indexOf(BODY_OPENER);
  const closing = opening < 0 ? -1 : findClosingParenthesis(code, opening, BODY_OPENER);
  if (closing < 0) return [];
  return splitIntoTopLevelPieces(code.slice(opening + 1, closing).replace(/;/g, ","))
    .map(piece => driver.findFieldName(piece))
    .filter(Boolean)
    .map(name => ({ name, line: typeLine }));
};

const numberTheLines = (lines, lineNumbers) => lineNumbers.map(line => ({ line, text: String(lines[line - 1] || "") }));

const listLineNumbersOfTheSpan = (span, after) => Array.from({ length: Math.max(0, span.to - after) }, (unused, offset) => after + offset + 1);

const findConstructorMembers = (driver, lines, declarations, position) => declarations
  .filter(declaration => declaration.enclosingHeadOrder === position && declaration.scale === Scale.METHOD.name && driver.isAConstructor(declaration))
  .flatMap(constructor => {
    const headLineNumbers = listHeadLineNumbers(lines, constructor.line);
    const bodyLineNumbers = constructor.span ? listLineNumbersOfTheSpan(constructor.span, headLineNumbers[headLineNumbers.length - 1] || constructor.line) : [];
    return driver.findConstructorFields({ headLines: numberTheLines(lines, headLineNumbers), bodyLines: numberTheLines(lines, bodyLineNumbers) });
  })
  .map(({ name, line }) => ({ name, line }));

const findCodeMembers = (driver, lines, typeLine, span) => {
  const components = driver.findComponentNames(readHeadText(lines, typeLine)).map(name => ({ name, line: typeLine }));
  const indent = findBodyIndent(lines, typeLine, span);
  if (indent < 0) return [...components, ...findMembersOfABodyOnTheHeadLine(driver, lines, typeLine)];
  const fields = [];
  for (let line = typeLine + 1; line <= span.to; line++) {
    const text = String(lines[line - 1] || "");
    if (indentOf(text) !== indent || CLASS_MEMBER_PATTERN.test(text)) continue;
    const name = driver.findFieldName(text);
    if (name) fields.push({ name, line });
  }
  return [...components, ...fields];
};

const findMembersEnclosedBy = (declarations, enclosingHeadOrder) => declarations.filter(declaration => declaration.enclosingHeadOrder === enclosingHeadOrder).map(({ name, line }) => ({ name, line }));

const removeRepeatedNames = found => found.filter((member, index) => found.findIndex(other => other.name === member.name) === index);

export function findMembersOfADeclaredType(source, declarations, position) {
  if (source.driver.fileHoldsTypesOnly) return findMembersEnclosedBy(declarations, position);
  const { line, span } = declarations[position];
  if (!source.lines || !span) return [];
  return removeRepeatedNames([...findCodeMembers(source.driver, source.lines, line, span), ...findConstructorMembers(source.driver, source.lines, declarations, position)]);
}

export const readMemberNames = members => members.map(member => member.name);
