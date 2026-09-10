import { shortenText } from "../../inputs/source/text/ShortenedText.mjs";

export const buildShortenedPlace = (filePath, line, text) => ({ path: filePath, line, text: shortenText(String(text).trim()) });

export const formatPlacedSliceLine = (filePath, line, text) => `${filePath}:${line}: ${text}`;

export const PLACED_LINE_PATTERN = /^([^\s:]+):(\d+):\s?([\s\S]*)$/;

export const formatPlaceKey = place => `${place.path}:${place.line}`;

export const compareByPathAndLine = (left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0) || left.line - right.line;

export const doesSpanHoldLine = (span, line) => Boolean(span) && line >= span.from && line <= span.to;

export const doRegionsHoldLine = (regions, line) => regions.some(region => doesSpanHoldLine(region, line));

export const liesInTheTypeOutsideItsMethods = (typeSpan, methodSpans, line) => doesSpanHoldLine(typeSpan, line) && !methodSpans.some(span => doesSpanHoldLine(span, line));

export const findInnermostHolding = (spannedValues, line, spanOf) => spannedValues
  .filter(enclosing => doesSpanHoldLine(spanOf(enclosing), line))
  .reduce((inner, enclosing) => (!inner || spanOf(enclosing).from > spanOf(inner).from ? enclosing : inner), null);

export class Place {
  constructor({ file, startLine = null, endLine = startLine }) {
    this.file = file;
    this.startLine = startLine;
    this.endLine = endLine;
    Object.freeze(this);
  }

  get hasASourceLine() {
    return this.startLine !== null;
  }

  get span() {
    return this.hasASourceLine ? { from: this.startLine, to: this.endLine } : null;
  }

  holdsLine(line) {
    return doesSpanHoldLine(this.span, line);
  }

  toJSON() {
    return this.hasASourceLine ? { file: this.file, startLine: this.startLine, endLine: this.endLine } : { file: this.file };
  }

  static createFromJSON(saved) {
    return new Place(saved);
  }
}
