import { Scale } from "../../../graph/abstractions/Scale.mjs";
import { NO_COMMENT_FORMS } from "../forms/CommentForms.mjs";

const PHASE_WORDS = new Set(["given", "when", "then", "arrange", "act", "assert"]);

const GIVEN_WHEN_THEN_WORDS = new Set(["given", "when", "then"]);

const STRING_QUOTES = new Set(['"', "'", "`"]);

const ESCAPE_CHARACTER = "\\";

const WORD_BREAK_PATTERN = /[^A-Za-z]+/;

export const isAPhaseComment = text => PHASE_WORDS.has(String(text).trim().replace(/:$/, "").toLowerCase());

const opensWithGivenWhenOrThen = text => GIVEN_WHEN_THEN_WORDS.has(String(text).trim().split(WORD_BREAK_PATTERN)[0].toLowerCase());

function findCommentStart(text, forms) {
  let quote = "";
  for (let at = 0; at < text.length; at++) {
    const character = text[at];
    if (quote) {
      if (character === ESCAPE_CHARACTER) at++;
      else if (character === quote) quote = "";
      continue;
    }
    if (STRING_QUOTES.has(character)) { quote = character; continue; }
    const opened = forms.blockForms.find(form => text.startsWith(form.opens, at));
    if (opened) return { at, marker: opened.opens, form: opened };
    const marker = forms.lineForms.find(form => text.startsWith(form, at));
    if (marker) return { at, marker, form: null };
  }
  return null;
}

class LineSplit {
  constructor(forms) {
    this.forms = forms;
    this.openForm = null;
  }

  split(text) {
    let rest = String(text);
    let code = "";
    const words = [];
    let holdsComment = Boolean(this.openForm);
    for (; rest;) {
      if (this.openForm) {
        const closed = rest.indexOf(this.openForm.closes);
        if (closed < 0) { words.push(rest); break; }
        words.push(rest.slice(0, closed));
        rest = rest.slice(closed + this.openForm.closes.length);
        this.openForm = null;
        continue;
      }
      const start = findCommentStart(rest, this.forms);
      if (!start) { code += rest; break; }
      holdsComment = true;
      code += rest.slice(0, start.at);
      rest = rest.slice(start.at + start.marker.length);
      if (!start.form) { words.push(rest); break; }
      this.openForm = start.form;
    }
    return { code: code.trim(), words: words.join(" ").replace(/\s+/g, " ").trim(), holdsComment };
  }
}

const readLines = (numberedLines, forms) => {
  const split = new LineSplit(forms);
  return numberedLines.map(({ line, text }) => ({ line, ...split.split(text) }));
};

const findCodeBelow = (read, from) => {
  const found = read.find(splitLine => splitLine.line > from && splitLine.code);
  return found ? { line: found.line, text: found.code } : null;
};

const declaresAt = (driver, text) =>
  driver.looksLikeDeclaration(text) || driver.readDeclaration(text).scale === Scale.VARIABLE.name;

const buildComment = (run, read, driver) => {
  const first = run[0];
  const text = run.map(splitLine => splitLine.words).filter(Boolean).join(" ");
  const codeBelow = first.code ? { line: first.line, text: first.code } : findCodeBelow(read, run[run.length - 1].line);
  const aboveADeclaration = Boolean(!first.code && codeBelow && declaresAt(driver, codeBelow.text));
  return {
    from: first.line,
    to: run[run.length - 1].line,
    text,
    aboveADeclaration,
    isPhaseComment: run.length === 1 && isAPhaseComment(text),
    codeBelow: codeBelow || { line: 0, text: "" },
  };
};

const runsOf = read => {
  const runs = [];
  let open = null;
  for (const splitLine of read) {
    if (!splitLine.holdsComment) { open = null; continue; }
    if (splitLine.code) { runs.push([splitLine]); open = null; continue; }
    if (open && open[open.length - 1].line === splitLine.line - 1) { open.push(splitLine); continue; }
    open = [splitLine];
    runs.push(open);
  }
  return runs;
};

const isAWholeFile = numberedLines => numberedLines.every((numberedLine, offset) => numberedLine.line === offset + 1);

function prepareLinesForComments(numberedLines, driver) {
  if (!isAWholeFile(numberedLines)) return numberedLines;
  const plain = driver.readLinesForComments(numberedLines.map(numberedLine => numberedLine.text));
  return numberedLines.map((numberedLine, offset) => ({ line: numberedLine.line, text: plain[offset] }));
}

export function collectComments(numberedLines, driver) {
  const forms = driver ? driver.commentForms : NO_COMMENT_FORMS;
  if (!forms.lineForms.length && !forms.blockForms.length) return [];
  const read = readLines(prepareLinesForComments(numberedLines, driver), forms);
  return runsOf(read).map(run => buildComment(run, read, driver)).filter(comment => comment.text);
}

export const findGivenWhenThenComments = (numberedLines, driver) => collectComments(numberedLines, driver).filter(comment => opensWithGivenWhenOrThen(comment.text));
