import { COMMENT_LINE_FORMS, isACommentLine } from "../../../../../inputs/source/forms/CommentForms.mjs";
import { closeTheBlocksEndedAtIndent, indentOf } from "../../../../../inputs/source/SourceText.mjs";
import { CallArgumentFunctions } from "./CallArgumentFunctions.mjs";

const STRING_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;
const TRAILING_COMMENT_PATTERN = /\s(\/\/|#)\s.*$/;
const LEADING_CLOSERS_PATTERN = /^[\s})\]]+/;
const LOOP_LABEL_PATTERN = /^[A-Za-z_$][\w$]*:\s*(?=(for|while|do|loop)\b)/;
const LEADING_AWAIT_PATTERN = /^(async|await)\s+/;
const BRACE_ALONE_PATTERN = /^\{$/;

const BRANCH_LOOP_OR_TRY_PATTERN = /^(if|else|elif|elsif|unless|for|foreach|while|until|do|loop|try|catch|except|finally|rescue|ensure|with|using|lock|synchronized|begin|default)\b/;
const CASE_ARM_PATTERN = /^case\b.*(:|->|=>)\s*\{?$/;
const WHEN_ARM_PATTERN = /^when\b(?!\s*[({])/;
const SWITCH_HEAD_PATTERN = /^(switch|match|select|case|cond|when)\b/;

const NAMED_DECLARATION_PATTERN = /^(def|defp|defmodule|class|module|struct|interface|enum|record|trait|impl|object)\b|^fn\s+[\w$]+\s*[<(]|^fun\s+[\w$.<>]+\s*\(|^func\s+(\([^)]*\)\s*)?[\w$]+\s*[<([]|^function\s*\*?\s*[\w$]+\s*\(/;
const ARROW_BODY_PATTERN = /(->|=>)\s*\{?$/;
const BLOCK_WITH_PARAMETERS_PATTERN = /\{\s*(\|[^|]*\||[\w$,\s():<>?]+\s*(->|\bin\b))\s*$/;
const DO_BLOCK_PATTERN = /\bdo(\s*\|[^|]*\|)?\s*$/;
const ANONYMOUS_FUNCTION_PATTERN = /\b(function|func|fn|lambda|proc)\s*\*?\s*\(/;
const CLOSURE_BODY_PATTERN = /\|[^|]*\|\s*\{$/;
const TRAILING_BLOCK_PATTERN = /\.[A-Za-z_$][\w$]*\s*(\([^()]*\))?\s*\{$/;
const CONSTRUCTOR_CALL_PATTERN = /\bnew\b/;

const readCode = text => String(text).replace(STRING_PATTERN, "\"\"").replace(TRAILING_COMMENT_PATTERN, "").trim();

const readHead = code => code.replace(LEADING_CLOSERS_PATTERN, "").replace(LOOP_LABEL_PATTERN, "").replace(LEADING_AWAIT_PATTERN, "");

const opensABranchLoopOrTry = head => BRANCH_LOOP_OR_TRY_PATTERN.test(head) || CASE_ARM_PATTERN.test(head) || WHEN_ARM_PATTERN.test(head);

const opensAnInlineFunction = head => ARROW_BODY_PATTERN.test(head)
  || BLOCK_WITH_PARAMETERS_PATTERN.test(head)
  || DO_BLOCK_PATTERN.test(head)
  || ANONYMOUS_FUNCTION_PATTERN.test(head)
  || CLOSURE_BODY_PATTERN.test(head)
  || (TRAILING_BLOCK_PATTERN.test(head) && !CONSTRUCTOR_CALL_PATTERN.test(head));

export const opensAConstruct = code => {
  const head = readHead(code);
  if (opensABranchLoopOrTry(head)) return true;
  if (SWITCH_HEAD_PATTERN.test(head) || NAMED_DECLARATION_PATTERN.test(head)) return false;
  return opensAnInlineFunction(head);
};

const isCode = (text, offset, textLines) => !textLines.has(offset + 1) && String(text).trim() && !isACommentLine(text, COMMENT_LINE_FORMS.ATTRIBUTES_ARE_CODE);

const NOTHING_OPEN = Object.freeze({ deepestLine: null, constructs: [] });

const NO_HEAD_INDENT = -1;

const findHeadIndent = (numberedLines, headLine) => {
  const head = numberedLines.find(numberedLine => numberedLine.line === headLine);
  return head ? indentOf(head.text) : NO_HEAD_INDENT;
};

const byLine = (left, right) => left.line - right.line;

const opensAFunctionStillOpen = (functions, header) => functions.listOpenFrames().some(frame => frame.header.line === header.line);

export function findOpenConstructsAndCallArgumentFunctions(numberedLines, { textLines = new Set(), headLine = null } = {}) {
  const headIndent = findHeadIndent(numberedLines, headLine);
  const insideTheBody = frame => frame.indent > headIndent;
  const blocks = [];
  const functions = new CallArgumentFunctions();
  let deepest = NOTHING_OPEN;
  let previous = null;
  numberedLines.forEach(({ line, text }, offset) => {
    if (!isCode(text, offset, textLines)) return;
    const indent = indentOf(text);
    closeTheBlocksEndedAtIndent(blocks, indent);
    const code = readCode(text);
    const read = functions.readLine({ line, text, code, indent });
    const open = [...blocks.filter(block => block.opens).map(block => block.header), ...read.deepestFrames.filter(insideTheBody).map(frame => frame.header)].sort(byLine);
    if (open.length > deepest.constructs.length) deepest = { deepestLine: { line, text: text.trim() }, constructs: open };
    const header = BRACE_ALONE_PATTERN.test(code) && previous ? previous : { line, text: text.trim(), code };
    const opensABlock = opensAConstruct(header.code) && (opensABranchLoopOrTry(readHead(header.code)) || !opensAFunctionStillOpen(functions, header));
    blocks.push({ indent, opens: indent > headIndent && opensABlock, header: { line: header.line, text: header.text } });
    previous = { line, text: text.trim(), code };
  });
  return { ...deepest, callArgumentFunctions: functions.listFound(insideTheBody) };
}
