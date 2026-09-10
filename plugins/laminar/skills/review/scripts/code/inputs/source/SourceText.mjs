import { FinderContext } from "../../extract/finders/FinderContext.mjs";
import { COMMENT_LINE_FORMS, isACommentLine } from "./forms/CommentForms.mjs";

const CODE_CHARACTER_PATTERN = /[^\s}\])`,;]/;

export const isACodeLine = (line, commentForm = COMMENT_LINE_FORMS.ANY_LANGUAGE) => CODE_CHARACTER_PATTERN.test(line) && !isACommentLine(line, commentForm);

export const holdsCode = lines => lines.some(line => isACodeLine(line));

export const filterLinesHoldingCode = lines => lines.filter(line => isACodeLine(line));

export const numberFileLines = lines => lines.map((text, offset) => ({ text, line: offset + 1 }));

export const splitTextIntoLines = text => text.split(/\r?\n/);

export const joinLinesAsFileText = lines => lines.map(line => `${line}\n`).join("");

const TEXT_OR_COMMENT_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)'|\/\/.*$/g;

export const countBraces = text => {
  const code = String(text).replace(TEXT_OR_COMMENT_PATTERN, "");
  return { opened: (code.match(/{/g) || []).length, closed: (code.match(/}/g) || []).length };
};

export const readCodeOfLine = text => String(text || "").replace(TEXT_OR_COMMENT_PATTERN, "\"\"");

export const indentOf = text => (/^\s*/.exec(text) || [""])[0].length;

export const stripTypeArguments = text => {
  let out = text;
  for (let previous = null; previous !== out;) {
    previous = out;
    out = out.replace(/<[^<>]*>|\[[^[\]]*\]/g, "");
  }
  return out;
};

const NO_LINES = Object.freeze(new Set());

export const closeTheBlocksEndedAtIndent = (openBlocks, indent) => {
  while (openBlocks.length && openBlocks[openBlocks.length - 1].indent >= indent) openBlocks.pop();
};

export const measureHeadIndent = text => /^[ \t]*/.exec(text)[0].length;

export class SourceText {
  constructor({ path: filePath, driver, lines = null, stretches = [], lastLine = lines ? lines.length : 1, readings = [], heads = null, opens = [], lexical = {} }) {
    Object.assign(this, { path: filePath, driver, lines, stretches, lastLine, readings, heads, opens });
    this.lexical = lexical;
  }

  static createForFile(filePath, lines, driver) {
    return new SourceText({ path: filePath, driver, lines, stretches: [{ first: 1, lines }], readings: [numberFileLines(lines)] });
  }

  get language() {
    return this.driver ? this.driver.diffDriver : null;
  }

  get finderContext() {
    return this.givenContext || FinderContext.createForLanguage(this.language);
  }

  setContext(context) {
    this.givenContext = context;
    return this;
  }

  setHeads(heads) {
    this.heads = heads;
    return this;
  }

  createWithReadings(readings, opens = []) {
    return new SourceText({ path: this.path, driver: this.driver, lines: this.lines, stretches: this.stretches, lastLine: this.lastLine, readings, opens, lexical: this.lexical });
  }

  readRemembered(key, read) {
    if (!(key in this.lexical)) this.lexical[key] = read();
    return this.lexical[key];
  }

  get textLines() {
    return this.readRemembered("textLines", () => this.collectLinesAcrossStretches(lines => this.driver.findTextLines(lines)));
  }

  get textOpeningLines() {
    return this.readRemembered("textOpeningLines", () => this.collectLinesAcrossStretches(lines => this.driver.findTextOpeningLines(lines)));
  }

  get readValueEndAt() {
    return this.readRemembered("valueEndAt", () => this.endsAcrossStretches(lines => this.driver.findValueEnds(lines)));
  }

  get blockEndAt() {
    return this.readRemembered("blockEndAt", () => this.endsAcrossStretches(lines => this.driver.findBlockEnds(lines)));
  }

  cannotHoldADeclarationHeadAt(texts, offset, line) {
    return this.textLines.has(line) || this.driver.startsACallThatSpansLines(texts, offset);
  }

  collectLinesAcrossStretches(linesOf) {
    if (!this.stretches.length) return NO_LINES;
    return new Set(this.stretches.flatMap(({ first, lines }) => [...linesOf(lines)].map(line => line + first - 1)));
  }

  endsAcrossStretches(endsOf) {
    const read = this.stretches.map(stretch => ({ ...stretch, endAt: endsOf(stretch.lines) }));
    return line => {
      const stretch = read.find(({ first, lines }) => line >= first && line < first + lines.length);
      const end = stretch ? stretch.endAt(line - stretch.first + 1) : 0;
      return end ? end + stretch.first - 1 : 0;
    };
  }

  readRegion(span) {
    if (!this.lines) return [];
    return this.lines.slice(span.from - 1, span.to);
  }
}
