import { Scale } from "../../../graph/abstractions/Scale.mjs";
import { measureHeadIndent } from "../SourceText.mjs";
import { opensAnAnnotation } from "../lines/Annotations.mjs";

export const LINE_BEFORE_A_DECLARATION_PATTERN = /^\s*(@|#\[|\/\/|\/\*|\*|#|$)/;

const OPENING_BRACKETS_PATTERN = /[([{]/g;

const CLOSING_BRACKETS_PATTERN = /[)\]}]/g;

const countMatches = (text, pattern) => (text.match(pattern) || []).length;

const countClosingBracketsBeyondOpening = text => countMatches(text, CLOSING_BRACKETS_PATTERN) - countMatches(text, OPENING_BRACKETS_PATTERN);

const standsAtTheIndentOf = (text, declaration) => measureHeadIndent(text) <= declaration.indent;

const leadsIntoTheDeclaration = (text, declaration) =>
  !text.trim() || ((LINE_BEFORE_A_DECLARATION_PATTERN.test(text) || opensAnAnnotation(text)) && standsAtTheIndentOf(text, declaration));

const opensTheArgumentsOfAnAnnotation = (text, declaration) => opensAnAnnotation(text) && standsAtTheIndentOf(text, declaration);

export function collectLeadingLines(declaration, lines, floor) {
  let firstLeadingLine = declaration.line;
  let unclosedArguments = 0;
  for (let line = declaration.line - 1; line > floor; line--) {
    const text = String(lines[line - 1] ?? "");
    if (unclosedArguments === 0 && leadsIntoTheDeclaration(text, declaration)) { firstLeadingLine = line; continue; }
    unclosedArguments += countClosingBracketsBeyondOpening(text);
    if (unclosedArguments > 0) continue;
    if (!opensTheArgumentsOfAnAnnotation(text, declaration)) break;
    firstLeadingLine = line;
    unclosedArguments = 0;
  }
  return lines.slice(firstLeadingLine - 1, declaration.line - 1);
}

const measureLastLineBefore = (next, floor, source) => next.line - 1 - (source.lines ? collectLeadingLines(next, source.lines, floor).length : 0);

const findOwnEnd = (declaration, source) => {
  if (declaration.scale === Scale.VARIABLE.name) return source.readValueEndAt(declaration.line);
  return source.blockEndAt(declaration.line) || (declaration.indent === 0 ? source.readValueEndAt(declaration.line) : 0);
};

function measureSpanBefore(declaration, next, source) {
  const end = next ? measureLastLineBefore(next, declaration.line, source) : source.lastLine;
  const ownEnd = findOwnEnd(declaration, source);
  return { from: declaration.line, to: ownEnd ? Math.min(ownEnd, end) : end };
}

const endsTheSpanOf = (other, declaration) => other.line > declaration.line && other.indent <= declaration.indent;

export function measureSpanAmong(declaration, declarations, source) {
  if (declaration.span) return declaration.span;
  const next = declarations.filter(other => endsTheSpanOf(other, declaration)).sort((left, right) => left.line - right.line)[0];
  return measureSpanBefore(declaration, next, source);
}

function findNextAfter(byLine, at) {
  const { declaration } = byLine[at];
  for (let later = at + 1; later < byLine.length; later++) {
    if (endsTheSpanOf(byLine[later].declaration, declaration)) return byLine[later].declaration;
  }
  return null;
}

export function measureSpans(declarations, source) {
  const byLine = declarations.map((declaration, position) => ({ declaration, position })).sort((left, right) => left.declaration.line - right.declaration.line);
  const spans = new Array(declarations.length);
  byLine.forEach(({ declaration, position }, at) => {
    spans[position] = declaration.span || measureSpanBefore(declaration, findNextAfter(byLine, at), source);
  });
  return spans;
}
