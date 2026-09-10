const ESCAPE = "\\";
const BLANK = " ";
const EXPRESSION_OPENING = "${";
const VALUE_THAT_GOES_ON_PATTERN = /(?:[=,+\-*/?:.|&([{]|=>)\s*$/;
const STRING_PREFIX_PATTERN = /[rRuUbBfF]{0,2}$/;
const TRIPLE_QUOTE_PATTERN = /[rRuUbBfF]{0,2}(?:"""|''')/g;

const createExpressionFrame = () => ({ holdsText: false, braces: 0 });

class StringScan {
  constructor(form) {
    this.form = form;
    this.frames = [];
    this.waitingHeredocs = [];
    this.insideBlockComment = false;
    this.depth = 0;
    this.closedStatement = null;
  }

  get top() {
    return this.frames[this.frames.length - 1] || null;
  }

  get insideText() {
    return Boolean(this.top && this.top.holdsText);
  }

  get openExpression() {
    const top = this.top;
    return top && !top.holdsText ? top : null;
  }

  scanLine(text) {
    const startsInText = this.insideText;
    const reading = this.top && this.top.heredoc ? this.scanHeredocLine(text) : this.scanCodeLine(text);
    this.frames.push(...this.waitingHeredocs.splice(0));
    const lineReading = { startsInText, endsOpen: this.insideText || this.insideBlockComment, depth: this.depth, ...reading, stringStatement: false };
    for (const frame of this.frames) if (frame.lines) frame.lines.push(lineReading);
    if (this.closedStatement) this.keepStringStatement(lineReading);
    return lineReading;
  }

  keepStringStatement(lineReading) {
    const lines = [...this.closedStatement.lines, lineReading];
    this.closedStatement = null;
    for (const line of lines) line.stringStatement = true;
  }

  scanHeredocLine(text) {
    if (this.top.terminator.test(text)) this.frames.pop();
    return { code: "", plain: BLANK.repeat(text.length) };
  }

  scanCodeLine(text) {
    const plain = [...text];
    let code = "";
    const blankCharacters = (from, length) => { for (let at = from; at < from + length && at < plain.length; at++) plain[at] = BLANK; };
    for (let at = 0; at < text.length; at++) {
      const character = text[at];
      if (this.insideBlockComment) {
        const closing = this.form.blockComment.closes;
        if (text.startsWith(closing, at)) { this.insideBlockComment = false; at += closing.length - 1; }
        continue;
      }
      const frame = this.top;
      if (frame && frame.holdsText) {
        if (frame.spansLines) plain[at] = BLANK;
        if (frame.escapes && character === ESCAPE) { if (frame.spansLines) blankCharacters(at + 1, 1); at++; continue; }
        if (frame.doubled && text.startsWith(frame.closes.repeat(2), at)) { blankCharacters(at, 2); at++; continue; }
        if (text.startsWith(frame.closes, at)) {
          if (frame.spansLines) blankCharacters(at, frame.closes.length);
          at += frame.closes.length - 1;
          this.frames.pop();
          if (frame.standsAlone && !text.slice(at + 1).trim()) this.closedStatement = frame;
          continue;
        }
        if (frame.expressions && text.startsWith(EXPRESSION_OPENING, at)) { blankCharacters(at, 2); this.frames.push(createExpressionFrame()); at++; }
        continue;
      }
      if (this.form.lineComments.some(marker => text.startsWith(marker, at))) break;
      const block = this.form.blockComment;
      if (block && text.startsWith(block.opens, at)) { this.insideBlockComment = true; at += block.opens.length - 1; continue; }
      const opened = this.findOpenerAt(text, at);
      if (opened) {
        this.open(opened.frame, code);
        if (opened.frame && opened.frame.spansLines) blankCharacters(at, opened.length);
        at += opened.length - 1;
        continue;
      }
      if (this.closesAnExpression(character)) { this.frames.pop(); continue; }
      code += character;
      this.readBracket(character);
    }
    if (this.insideText && !this.top.spansLines) this.frames.pop();
    return { code: code.trim(), plain: plain.join("") };
  }

  findOpenerAt(text, at) {
    for (const opener of this.form.openers) {
      const opened = opener.opensAt(text, at);
      if (opened) return opened;
    }
    return null;
  }

  open(frame, codeBefore) {
    if (!frame) return;
    if (frame.heredoc) { this.waitingHeredocs.push(frame); return; }
    const opened = { ...frame };
    if (this.form.docstrings && opened.spansLines && !codeBefore.replace(STRING_PREFIX_PATTERN, "").trim()) {
      opened.standsAlone = true;
      opened.lines = [];
    }
    this.frames.push(opened);
  }

  closesAnExpression(character) {
    const expression = this.openExpression;
    return character === "}" && Boolean(expression) && !expression.braces;
  }

  readBracket(character) {
    const expression = this.openExpression;
    if (character === "{") { if (expression) expression.braces++; else this.depth++; return; }
    if (character === "}") {
      if (expression) expression.braces--; else this.depth--;
      return;
    }
    if (character === "(" || character === "[") this.depth++;
    else if (character === ")" || character === "]") this.depth--;
  }
}

export function buildStringReading(lines, form) {
  const scan = new StringScan(form);
  return (lines || []).map(text => scan.scanLine(String(text)));
}

export const collectTextLines = reading =>
  new Set(reading.map((lineReading, offset) => (lineReading.startsInText ? offset + 1 : 0)).filter(Boolean));

export const opensTextAt = (reading, line) => {
  const lineReading = reading[line - 1];
  const next = reading[line];
  return Boolean(lineReading && next && !lineReading.startsInText && next.startsInText);
};

export function buildCommentReadingLines(reading, lines) {
  return reading.map((lineReading, offset) => {
    if (!lineReading.stringStatement) return lineReading.plain;
    const text = String(lines[offset]);
    const indent = (/^\s*/.exec(text) || [""])[0];
    return `${indent}# ${text.replace(TRIPLE_QUOTE_PATTERN, "").trim()}`;
  });
}

export function findValueEnd(reading, line) {
  const opening = reading[line - 1];
  if (!opening) return 0;
  const baseline = line > 1 ? reading[line - 2].depth : 0;
  for (let offset = line - 1; offset < reading.length; offset++) {
    const lineReading = reading[offset];
    if (lineReading.depth <= baseline && !lineReading.endsOpen && !VALUE_THAT_GOES_ON_PATTERN.test(lineReading.code)) return offset + 1;
  }
  return 0;
}
