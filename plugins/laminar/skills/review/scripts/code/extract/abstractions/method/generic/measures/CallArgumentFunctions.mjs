const OPENING_BRACKETS = new Set(["(", "[", "{"]);
const CLOSING_BRACKETS = new Set([")", "]", "}"]);
const SEPARATORS = new Set([",", ";"]);
const CALL_BRACKET = "(";
const BRACE = "{";

const IDENTIFIER_CHARACTER_PATTERN = /[\w$]/;
const BLOCK_WITH_PARAMETERS_PATTERN = /^\{\s*(\|[^|]*\||[\w$,\s():<>?]+?\s*(->|\bin\b))/;
const DOTTED_CALL_BEFORE_PATTERN = /\.[A-Za-z_$][\w$]*(\s*\([^()]*\)\s*|\s+)$/;
const CONSTRUCTOR_CALL_BEFORE_PATTERN = /\bnew\s+[\w$.<>]+\s*(\([^()]*\))?\s*$/;
const BLOCK_OF_A_BRANCH_PATTERN = /\b(if|while|for|foreach|match|switch|guard|unless|until|when|select|case|cond|with)\b/;
const PARAMETERS_BEFORE_AN_ARROW_PATTERN = /[\w$)]\s*$/;
const NAME_BEFORE_A_FAT_ARROW_PATTERN = /([:$]?[\w$]+|\))\s*$/;
const BRACE_AFTER_AN_ARROW_PATTERN = /^\s*\{/;
const PIPE_PARAMETERS_PATTERN = /^\|[^|]*\|/;
const EMPTY_PIPE_PARAMETERS = "||";
const OPENING_OF_AN_ARGUMENT_BEFORE_PATTERN = /(^|[(,=]|\bmove)\s*$/;
const BRACKETED_LAMBDA_PATTERN = /^\[[^\]]*\]\s*(\([^()]*\))?\s*(mutable\s*)?(->\s*[\w:<>]+\s*)?\{/;
const FUNCTION_KEYWORD_PATTERN = /^function\b(?=\s*\*?\s*[\w$]*\s*\()/;
const FUNC_KEYWORD_PATTERN = /^func(?=\s*\()/;
const KEYWORD_WITH_A_BRACE_PATTERN = /^(lambda|proc)\s*\{/;
const LAMBDA_KEYWORD_PATTERN = /^lambda\b(?!\s*(do\b|\{))/;
const FN_WITH_AN_ARROW_PATTERN = /^fn\b[^>]*?->/;
const DO_BLOCK_PATTERN = /^do\b(?!\s*[:(.=])(\s*\|[^|]*\|)?/;
const END_PATTERN = /^end\b/;

const FRAME_ENDS = Object.freeze({ AT_ITS_BRACKET: "AT_ITS_BRACKET", AT_A_SEPARATOR: "AT_A_SEPARATOR", AT_END: "AT_END" });

const isContent = character => !/\s/.test(character) && !OPENING_BRACKETS.has(character) && !CLOSING_BRACKETS.has(character) && !SEPARATORS.has(character);

const followsAnIdentifier = (code, at) => at > 0 && IDENTIFIER_CHARACTER_PATTERN.test(code[at - 1]);

const isTheLastCodeAfter = (code, at) => !code.slice(at + 1).trim();

const opensAnArrowFunction = (code, at) => {
  const before = code.slice(0, at);
  const after = code.slice(at + 2);
  if (!PARAMETERS_BEFORE_AN_ARROW_PATTERN.test(before)) return false;
  return (/\s$/.test(before) && (/^\s/.test(after) || !after)) || BRACE_AFTER_AN_ARROW_PATTERN.test(after);
};

const opensAFatArrowFunction = (code, at) => {
  if (at > 0 && /[=<>!]/.test(code[at - 1])) return false;
  const named = NAME_BEFORE_A_FAT_ARROW_PATTERN.exec(code.slice(0, at));
  return Boolean(named) && !/^[:$]/.test(named[1]);
};

const opensATrailingBlock = (code, at) => {
  const before = code.slice(0, at);
  if (!DOTTED_CALL_BEFORE_PATTERN.test(before) || CONSTRUCTOR_CALL_BEFORE_PATTERN.test(before)) return false;
  return !(isTheLastCodeAfter(code, at) && BLOCK_OF_A_BRANCH_PATTERN.test(before));
};

const opensADoBlock = (code, at, length) => !(isTheLastCodeAfter(code, at + length - 1) && BLOCK_OF_A_BRANCH_PATTERN.test(code.slice(0, at)));

export class CallArgumentFunctions {
  constructor() {
    this.brackets = [];
    this.frames = [];
    this.found = [];
  }

  readLine({ line, text, code, indent }) {
    this.dropTheFramesEndedAtIndent(indent);
    const opened = [];
    let deepest = { count: -1, frames: [] };
    for (let at = 0; at < code.length;) {
      const consumed = this.readOpening(code, at, { line, text, indent }, opened) || this.readClosing(code, at);
      if (consumed) { at += consumed; continue; }
      if (isContent(code[at]) && this.frames.length > deepest.count) deepest = { count: this.frames.length, frames: [...this.frames] };
      at++;
    }
    return { deepestFrames: deepest.frames };
  }

  listOpenFrames() {
    return [...this.frames];
  }

  listFound(isKept) {
    const keptOuterOf = frame => (frame.outer && !isKept(frame.outer) ? keptOuterOf(frame.outer) : frame.outer);
    const depthOf = frame => (keptOuterOf(frame) ? depthOf(keptOuterOf(frame)) + 1 : 1);
    return this.found.filter(isKept).map(frame => ({
      line: frame.header.line,
      text: frame.header.text,
      depth: depthOf(frame),
      outerLine: keptOuterOf(frame) ? keptOuterOf(frame).header.line : null,
    }));
  }

  dropTheFramesEndedAtIndent(indent) {
    this.frames = this.frames.filter(frame => (frame.ends === FRAME_ENDS.AT_END ? indent > frame.indent : indent >= frame.indent));
  }

  readOpening(code, at, place, opened) {
    const rest = code.slice(at);
    const character = code[at];
    if (character === BRACE) {
      const withParameters = BLOCK_WITH_PARAMETERS_PATTERN.exec(rest);
      if (withParameters) return this.openABraceFunction(place, opened, withParameters[0].length);
      if (opensATrailingBlock(code, at)) return this.openABraceFunction(place, opened, 1);
    }
    if (character === "[" && OPENING_OF_AN_ARGUMENT_BEFORE_PATTERN.test(code.slice(0, at))) {
      const bracketed = BRACKETED_LAMBDA_PATTERN.exec(rest);
      if (bracketed) return this.openABraceFunction(place, opened, bracketed[0].length);
    }
    if (rest.startsWith("->") && opensAnArrowFunction(code, at)) return this.openAnArgumentFunction(place, opened, 2);
    if (rest.startsWith("=>") && opensAFatArrowFunction(code, at)) return this.openAnArgumentFunction(place, opened, 2);
    if (character === "|" && OPENING_OF_AN_ARGUMENT_BEFORE_PATTERN.test(code.slice(0, at))) {
      const piped = PIPE_PARAMETERS_PATTERN.exec(rest);
      if (piped && (piped[0] !== EMPTY_PIPE_PARAMETERS || code.slice(0, at).trim())) return this.openAnArgumentFunction(place, opened, piped[0].length);
    }
    if (followsAnIdentifier(code, at)) return this.openBracket(character);
    const keywordWithABrace = KEYWORD_WITH_A_BRACE_PATTERN.exec(rest);
    if (keywordWithABrace) return this.openABraceFunction(place, opened, keywordWithABrace[0].length);
    for (const pattern of [FUNCTION_KEYWORD_PATTERN, FUNC_KEYWORD_PATTERN, LAMBDA_KEYWORD_PATTERN]) {
      const keyword = pattern.exec(rest);
      if (keyword) return this.openAnArgumentFunction(place, opened, keyword[0].length);
    }
    const fn = FN_WITH_AN_ARROW_PATTERN.exec(rest);
    if (fn) return this.openAnArgumentFunction(place, opened, fn[0].length, FRAME_ENDS.AT_END);
    const doBlock = DO_BLOCK_PATTERN.exec(rest);
    if (doBlock && opensADoBlock(code, at, doBlock[0].length)) return this.openFrame(place, opened, FRAME_ENDS.AT_END, doBlock[0].length);
    if (END_PATTERN.test(rest)) return this.closeAnEndedFrame(opened);
    return this.openBracket(character);
  }

  openBracket(character) {
    if (!OPENING_BRACKETS.has(character)) return 0;
    this.brackets.push(character);
    return 1;
  }

  readClosing(code, at) {
    const character = code[at];
    if (CLOSING_BRACKETS.has(character)) {
      this.brackets.pop();
      this.frames = this.frames.filter(frame => frame.base <= this.brackets.length);
      return 1;
    }
    if (SEPARATORS.has(character)) {
      this.frames = this.frames.filter(frame => !(frame.ends === FRAME_ENDS.AT_A_SEPARATOR && frame.base === this.brackets.length));
    }
    return 0;
  }

  openAnArgumentFunction(place, opened, length, ends = FRAME_ENDS.AT_A_SEPARATOR) {
    if (this.brackets[this.brackets.length - 1] !== CALL_BRACKET) return 0;
    return this.openFrame(place, opened, ends, length);
  }

  openABraceFunction(place, opened, length) {
    this.brackets.push(BRACE);
    return this.openFrame(place, opened, FRAME_ENDS.AT_ITS_BRACKET, length);
  }

  openFrame({ line, text, indent }, opened, ends, length) {
    const outer = this.frames[this.frames.length - 1] || null;
    const frame = { header: { line, text: text.trim() }, indent, ends, base: this.brackets.length, outer };
    this.frames.push(frame);
    this.found.push(frame);
    opened.push(frame);
    return length;
  }

  closeAnEndedFrame(opened) {
    const ended = [...this.frames].reverse().find(frame => frame.ends === FRAME_ENDS.AT_END && opened.includes(frame));
    if (ended) this.frames = this.frames.slice(0, this.frames.indexOf(ended));
    return 3;
  }
}
