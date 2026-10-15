import { walkParenthesesBalances } from "../../../../../inputs/source/text/Brackets.mjs";

const MAX_HEAD_LINES = 12;

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

const findCodeMembers = (driver, lines, typeLine, span) => {
  const components = driver.findComponentNames(readHeadText(lines, typeLine)).map(name => ({ name, line: typeLine }));
  const indent = findBodyIndent(lines, typeLine, span);
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
  return removeRepeatedNames(findCodeMembers(source.driver, source.lines, line, span));
}

export const readMemberNames = members => members.map(member => member.name);
