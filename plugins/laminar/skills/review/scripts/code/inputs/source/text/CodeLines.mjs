import { findDiffDriver, findLanguage } from "../Languages.mjs";
import { NO_COMMENT_FORMS } from "../forms/CommentForms.mjs";

const TRAILING_DOT_PATTERN = /(?:[A-Za-z_$][\w$]*|[)\]}])\s*\.\s*$/;
const LEADING_DOT_PATTERN = /^\s*\??\.(?!\.)\s*[A-Za-z_$]/;

const DOUBLE_QUOTED_PATTERN = /"(?:[^"\\]|\\.)*"/g;
const SINGLE_QUOTED_PATTERN = /'(?:[^'\\]|\\.)*'/g;
const ONE_CHARACTER_PATTERN = /'(?:[^'\\]|\\.)'/g;
const BACK_QUOTED_PATTERN = /`(?:[^`\\]|\\.)*`/g;
const REGEX_LITERAL_PATTERN = /((?:^|[=(,:[!&|?{};]|\breturn)\s*)\/(?![*/\s])(?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+\/[a-z]*/g;

const maskRun = run => run[0] + " ".repeat(Math.max(0, run.length - 2)) + run[run.length - 1];

const maskMatches = (text, pattern) => text.replace(pattern, maskRun);

function maskStrings(text, form) {
  let out = maskMatches(text, DOUBLE_QUOTED_PATTERN);
  out = maskMatches(out, form.singleQuotedStrings ? SINGLE_QUOTED_PATTERN : ONE_CHARACTER_PATTERN);
  if (form.backQuotedStrings) out = maskMatches(out, BACK_QUOTED_PATTERN);
  if (form.regexLiterals) out = out.replace(REGEX_LITERAL_PATTERN, (run, before) => before + maskRun(run.slice(before.length)));
  return out;
}

const blankCharacters = (text, from, to) => text.slice(0, from) + " ".repeat(Math.max(0, to - from)) + text.slice(to);

export class CodeLines {
  constructor(lines, diffDriver, commentForms) {
    this.raw = lines;
    this.diffDriver = diffDriver;
    this.language = findLanguage(diffDriver);
    this.lineForms = (commentForms && commentForms.lineForms) || [];
    this.blockForms = [...(this.language.tripleQuotes || []).map(quote => ({ opens: quote, closes: quote })), ...(this.language.openAcrossLines || []), ...((commentForms && commentForms.blockForms) || [])];
    this.code = this.maskLines();
    this.chainHeads = this.collectChainHeads();
  }

  collectChainHeads() {
    const heads = [];
    const continues = Boolean(this.language.trailingDotContinues);
    const joinLine = (head, line) => (head ? head + line.trim() : line.trimEnd());
    let head = "";
    let previous = null;
    for (const line of this.code) {
      const own = continues && previous && LEADING_DOT_PATTERN.test(line) ? joinLine(previous.head, previous.line) : head;
      heads.push(own);
      if (!line.trim()) continue;
      previous = { head: own, line };
      head = continues && TRAILING_DOT_PATTERN.test(line) ? joinLine(own, line) : "";
    }
    return heads;
  }

  maskLines() {
    let open = null;
    return this.raw.map(text => {
      let line = String(text || "");
      if (open) {
        const end = line.indexOf(open.closes);
        if (end < 0) return " ".repeat(line.length);
        line = blankCharacters(line, 0, end + open.closes.length);
        open = null;
      }
      line = maskStrings(line, this.language);
      line = this.stripLineComment(line);
      for (;;) {
        const opened = this.findFirstBlockOpening(line);
        if (!opened) break;
        const end = line.indexOf(opened.form.closes, opened.at + opened.form.opens.length);
        if (end < 0) { open = opened.form; line = blankCharacters(line, opened.at, line.length); break; }
        line = blankCharacters(line, opened.at, end + opened.form.closes.length);
      }
      return line;
    });
  }

  stripLineComment(line) {
    let cut = line.length;
    for (const opening of this.lineForms) {
      const at = line.indexOf(opening);
      if (at >= 0 && at < cut && !(opening === "#" && this.language.hashBracketIsNoComment && line[at + 1] === "[")) cut = at;
    }
    return cut < line.length ? blankCharacters(line, cut, line.length) : line;
  }

  findFirstBlockOpening(line) {
    let first = null;
    for (const form of this.blockForms) {
      const at = line.indexOf(form.opens);
      if (at >= 0 && (!first || at < first.at)) first = { at, form };
    }
    return first;
  }
}

export const createCodeLines = (lines, filePath) => {
  const diffDriver = findDiffDriver(filePath);
  return new CodeLines(lines, diffDriver || "", diffDriver ? findLanguage(diffDriver).commentForms || NO_COMMENT_FORMS : null);
};
