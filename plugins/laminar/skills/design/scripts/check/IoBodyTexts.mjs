import { isAText, isATestFileOfTheModel, isMarkedUnchanged, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

const QUOTED_TEXT = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'`;

// The ways each stack builds a text from a value, each read on 1 statement of the body.
const TEXT_BUILDING_FORMS = Object.freeze([
  // A quoted text joined to a value by a plus, in Java, Kotlin, C#, JavaScript, TypeScript and Python.
  new RegExp(`(?:${QUOTED_TEXT})\\s*\\+|\\+\\s*(?:${QUOTED_TEXT})`),
  // A template or an interpolated text: a template literal of JavaScript and TypeScript, a text of Kotlin, Groovy, C# or Ruby with a value inside it, and an f-string of Python.
  /`[^`]*\$\{|"[^"\n]*\$\{|\$"[^"\n]*\{|"[^"\n]*#\{|\bf"[^"\n]*\{|\bf'[^'\n]*\{/,
  // A call that formats a value into a text, such as String.format and formatted of Java, format of a date formatter, str.format and strftime of Python, and toFixed and the locale texts of JavaScript.
  /\b(?:format|formatted|strftime|toFixed|toLocaleString|toLocaleDateString|toLocaleTimeString|toISOString)\s*\(/,
  // A builder of a text in Java, Kotlin and C#.
  /\b(?:StringBuilder|StringBuffer|StringJoiner)\b/,
  // A quoted text formatted by the percent operator of Python.
  new RegExp(`(?:${QUOTED_TEXT})\\s*%\\s*[\\w(]`),
]);

// A log line starts with a call of a logger, which every stack names log, logger, console or logging, in any case.
const LOG_LINE = /^(?:(?:this|self)\.)?(?:log|logger|console|logging)\b\s*[.(]/i;

// A failure line throws or raises, or makes a failure type, which every stack names with Exception or Error at its end.
const FAILURE_LINE = /^(?:throw|raise)\b|\b\w*(?:Exception|Error)\s*\(/;

// A brace opens a block, which holds statements of its own, so only parentheses and brackets join lines.
const OPENING_MARKS = /[([]/g;

const CLOSING_MARKS = /[)\]]/g;

const countMarks = (text, marks) => (text.match(marks) || []).length;

// The depth of the open parentheses and brackets of a line, its quoted texts left out, so a call over several lines is read as 1 statement.
const readDepthChange = line => {
  const code = line.replace(new RegExp(QUOTED_TEXT, "g"), "\"\"");
  return countMarks(code, OPENING_MARKS) - countMarks(code, CLOSING_MARKS);
};

const listStatementsOfTheBody = body => {
  const statements = [];
  let openStatement = "";
  let depth = 0;
  for (const line of body.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    openStatement = openStatement ? `${openStatement} ${trimmedLine}` : trimmedLine;
    depth += readDepthChange(trimmedLine);
    if (depth > 0) continue;
    statements.push(openStatement);
    openStatement = "";
    depth = 0;
  }
  return openStatement ? [...statements, openStatement] : statements;
};

const isALogOrFailureLine = statement => LOG_LINE.test(statement) || FAILURE_LINE.test(statement);

const buildsAText = statement => !isALogOrFailureLine(statement) && TEXT_BUILDING_FORMS.some(form => form.test(statement));

const listTheFromNames = model => new Set(readList(model.decisions.exits).map(exit => exit.from).filter(isAText).map(from => model.normalizeName(from)));

// An I/O body is the body of a method that an object of exits runs from, where the model creates or changes that method.
const isAnIoBody = (model, fromNames, { theClass, method, displayName }) => isAText(method.body)
  && !isMarkedUnchanged(method)
  && model.isChangedClass(theClass)
  && !isATestFileOfTheModel(model, theClass.file || "")
  && fromNames.has(model.normalizeName(displayName));

const dropTheClosingSemicolon = statement => statement.replace(/;\s*$/, "");

const createTheTextDefect = (model, { theClass, method, displayName }, statements) => createRecheckDefect(
  DEFECT_CODES.IO_BODY_BUILDS_A_TEXT,
  model.getMethodPath(theClass, method),
  `${displayName} is an I/O body, which holds only its I/O line and its failure line (design-model.md, section 1), and it builds a text or formats a value outside a log line and a failure line: ${statements.map(dropTheClosingSemicolon).join(" | ")}; name a private part for that work, such as a method named for the text it returns, or move the work to the caller`,
);

// An I/O body that builds a text or formats a value holds a detail beside its I/O line, so the designer names a part for it or moves it up.
export const findIoBodyTextDefects = model => {
  const fromNames = listTheFromNames(model);
  const defects = [];
  for (const methodWithClass of model.listMethodsWithClass().filter(each => isAnIoBody(model, fromNames, each))) {
    const statements = listStatementsOfTheBody(methodWithClass.method.body).filter(buildsAText);
    if (statements.length) defects.push(createTheTextDefect(model, methodWithClass, statements));
  }
  return defects;
};
