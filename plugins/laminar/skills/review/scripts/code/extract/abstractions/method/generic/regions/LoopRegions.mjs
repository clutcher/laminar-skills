import { findClosingParenthesis, EVERY_OPENER, countOpened, findUnmatchedOpenerBefore } from "../../../../../inputs/source/text/Brackets.mjs";
import { readCallEffects } from "../../../../finders/LanguageStrategies.mjs";
import { findLanguage } from "../../../../../inputs/source/Languages.mjs";
import { doBodiesEndWithoutABrace } from "../../../../../inputs/source/forms/BodyEnds.mjs";
import { splitNameWords } from "../../../../../inputs/source/names/NameWords.mjs";
import { findBracedEnd, END_OF_LINE, findIndentedEnd, indentOf, MAX_LINES_TO_A_BODY, createRegion } from "./BodyRegions.mjs";

export const LOOP_FORMS = Object.freeze({
  RECURSION: "recursion",
});

const STATEMENT_LOOP_PATTERN = /^\s*(?:[A-Za-z_]\w*\s*:\s*)?(for|foreach|while|until|loop|repeat)\b(?!\s*[=:.(]\s*$)/;
const ALWAYS_TRUE_CONDITION_PATTERN = /^\(?\s*(?:true|True|1|;\s*;)?\s*\)?$/;
const WORDS_OF_A_STOP_BOOLEAN = new Set(["stop", "stopped", "closed", "close", "done", "shutdown", "cancelled", "canceled", "interrupted",
  "finished", "exit", "quit", "terminated", "ready", "success", "succeeded", "connected", "found", "complete", "completed"]);
const WORDS_OF_A_RUN_BOOLEAN = new Set(["running", "alive", "active", "run", "keep", "polling", "started"]);
const WORDS_OF_A_CHUNK_COUNTER = new Set(["remain", "remaining", "left", "bytes", "offset", "written", "pos", "position", "pending"]);
const WORDS_OF_A_RETRY_BOUND = new Set(["retry", "retries", "attempt", "attempts", "tries", "try"]);
const MAX_ELEMENTS_OF_A_FIXED_LIST = 3;
const LINES_TO_THE_END_OF_A_LITERAL = 12;
const CONDITION_RUNS_EACH_TIME = new Set(["while", "until"]);
const INDENTED_BODY_OPENING_PATTERN = /(?::|\bdo(?:\s*\|[^|]*\|)?|\bthen|\bloop|\bbegin)\s*$/;
const LAMBDA_MARKER_PATTERN = /->|=>|\blambda\b|\|[^|]*\||\bfn\b|\bfunc\s*\(|\bfun\s*\(|\bdo\b|\{/;

const readLastWord = name => splitNameWords(name).pop() || "";

function countTopLevelPieces(inside) {
  if (!inside.trim()) return 0;
  let depth = 0;
  let count = 1;
  for (const character of inside) {
    if ("([{".includes(character)) depth++;
    else if (")]}".includes(character)) depth--;
    else if (character === "," && depth === 0) count++;
  }
  return inside.trim().endsWith(",") ? count - 1 : count;
}

function countLiteralElements(text) {
  const trimmed = String(text || "").trim().replace(/^(?:new\s+[\w.<>]+\s*\[\s*\]\s*|\[\]\s*[\w.*]+\s*|(?:List|Set|Arrays)\.(?:of|asList)\s*|(?:list|set|tuple|frozenset)\s*\(\s*|Object\.(?:keys|values|entries)\s*\(\s*)/, "");
  const opening = trimmed[0];
  if (!"([{".includes(opening || "x")) return -1;
  const closing = findClosingParenthesis(trimmed, 0);
  if (closing < 0) return -1;
  const inside = trimmed.slice(1, closing);
  return /\.\.\./.test(inside) ? -1 : countTopLevelPieces(inside);
}

function countConstantLiteralElements(code, name) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) return -1;
  const binding = new RegExp(`^\\s*(?:export\\s+)?(?:(?:const|let|var|final|static|private|public|val)\\s+)*(?:[\\w.<>\\[\\]]+\\s+)?${name}\\s*(?::[^=]*)?=\\s*(.*)$`);
  for (let index = 0; index < code.length; index++) {
    const found = binding.exec(code[index] || "");
    if (!found) continue;
    const text = [found[1], ...code.slice(index + 1, index + LINES_TO_THE_END_OF_A_LITERAL)].join(" ");
    return countLiteralElements(text);
  }
  return -1;
}

const isAFixedList = count => count >= 0 && count <= MAX_ELEMENTS_OF_A_FIXED_LIST;

function isIterableFixed(code, iterable) {
  const text = String(iterable || "").trim().replace(/[:{]\s*$/, "").trim();
  if (isAFixedList(countLiteralElements(text))) return true;
  const wrapped = /^(?:Object\.(?:keys|values|entries)\s*\(\s*)?([A-Z][A-Z0-9_]*)\s*\)?(?:\.(?:items|keys|values)\s*\(\s*\))?$/.exec(text);
  return Boolean(wrapped) && isAFixedList(countConstantLiteralElements(code, wrapped[1]));
}

function doesConditionRunUntilAStop(condition) {
  const text = condition.trim().replace(/^\(|\)\s*[{:]?\s*$/g, "").replace(/[{:]\s*$/, "").trim();
  if (ALWAYS_TRUE_CONDITION_PATTERN.test(text) || !text) return true;
  const negated = /^(?:!|not\s+)\s*([\w$.]+(?:\(\s*\))?)$/.exec(text);
  if (negated) return WORDS_OF_A_STOP_BOOLEAN.has(readLastWord(negated[1].replace(/\(\s*\)$/, "").replace(/^(?:is|get|has)(?=[A-Z])/, "")));
  const plain = /^([\w$.]+(?:\(\s*\))?)$/.exec(text);
  if (plain) return splitNameWords(plain[1]).some(piece => WORDS_OF_A_RUN_BOOLEAN.has(piece));
  const counter = /^([\w$.]+)\s*(?:>|!=)\s*0$/.exec(text);
  return Boolean(counter) && splitNameWords(counter[1]).some(piece => WORDS_OF_A_CHUNK_COUNTER.has(piece));
}

const namesARetryLimit = bound => splitNameWords(bound).some(piece => WORDS_OF_A_RETRY_BOUND.has(piece));

const namesAMaximumConstant = bound => /^[A-Z][A-Z0-9_]*$/.test(bound) && splitNameWords(bound).includes("max");

function isCountedByAFixedBound(header) {
  const text = header.trim();
  const boundMatch = /\brange\s*\(\s*(?:\d+\s*,\s*)?([\w.]+)\s*\)|\brange\s+(\d+)\b|;\s*[\w$]+\s*<=?\s*([\w.$]+)\s*;|\b(\d+)\s*\.\.\.?\s*(\d+|[\w.]+)\b/.exec(text);
  if (!boundMatch) return false;
  const bound = boundMatch[1] || boundMatch[2] || boundMatch[3] || boundMatch[5] || "";
  return /^\d+$/.test(bound) || namesARetryLimit(bound) || namesAMaximumConstant(bound);
}

function findIterableOfAForHeader(header) {
  const found = /(?:\bin\b|\bof\b|:(?!:)|\brange\b)\s*(.+)$/.exec(header.replace(/\)\s*\{?\s*$/, ")").replace(/\s*[{:]\s*$/, ""));
  return found ? found[1].replace(/\)\s*$/, found[1].trim().startsWith("(") ? ")" : "") : "";
}

const DEQUEUE_PATTERN = /\.(?:pop|take|shift|next|popleft|popitem|dequeue|readLine|readline|Next|Scan|nextToken)\s*\(|=\s*<-\s*[\w$.]+|\bnext\s*\(/;

function readBodyText(code, fromLine, to) {
  return code.slice(fromLine, Math.min(to.line, fromLine + MAX_LINES_TO_A_BODY) + 1).join("\n");
}

function isLoopPerItem(code, keyword, header, body) {
  if (DEQUEUE_PATTERN.test(body())) return true;
  if (keyword === "loop" || keyword === "repeat") return false;
  if (keyword === "while" || keyword === "until") return !doesConditionRunUntilAStop(header);
  if (!header.trim() || /^\s*\{?\s*$/.test(header) || /^\s*\(\s*;\s*;\s*\)/.test(header)) return false;
  if (isCountedByAFixedBound(header)) return false;
  const iterable = findIterableOfAForHeader(header);
  if (!iterable && !/;/.test(header)) return !doesConditionRunUntilAStop(header);
  return !(iterable && isIterableFixed(code, iterable));
}

function findHeaderEnd(text, keywordEnd) {
  const opening = text.indexOf("(", keywordEnd);
  if (opening >= 0 && !text.slice(keywordEnd, opening).trim()) {
    const closing = findClosingParenthesis(text, opening);
    return closing >= 0 ? closing + 1 : text.length;
  }
  return keywordEnd;
}

function createStatementRegion(code, lineIndex, lastIndex, keyword, keywordEnd) {
  const text = code[lineIndex];
  const bodyFrom = CONDITION_RUNS_EACH_TIME.has(keyword) ? keywordEnd : null;
  const headerEnd = findHeaderEnd(text, keywordEnd);
  const brace = /\{\s*$/.test(text) ? text.lastIndexOf("{") : text.indexOf("{", headerEnd);
  const isPerItem = (header, end) => isLoopPerItem(code, keyword, header, () => readBodyText(code, lineIndex, end));
  if (brace >= 0) {
    const end = findBracedEnd(code, lineIndex, brace, lastIndex);
    return createRegion(lineIndex, keyword, lineIndex, bodyFrom ?? brace + 1, end, isPerItem(text.slice(keywordEnd, brace), end));
  }
  if (INDENTED_BODY_OPENING_PATTERN.test(text)) {
    const end = findIndentedEnd(code, lineIndex, lastIndex);
    return createRegion(lineIndex, keyword, lineIndex, bodyFrom ?? text.length, end, isPerItem(text.slice(keywordEnd), end));
  }
  const next = lineIndex + 1 <= lastIndex ? code[lineIndex + 1] || "" : "";
  if (/^\s*\{/.test(next)) {
    const end = findBracedEnd(code, lineIndex + 1, next.indexOf("{"), lastIndex);
    return createRegion(lineIndex, keyword, lineIndex, bodyFrom ?? text.length, end, isPerItem(text.slice(keywordEnd), end));
  }
  const oneLine = text.slice(headerEnd).replace(/[:;]/g, "").trim().length > 0;
  const colon = text.indexOf(":", headerEnd);
  const from = bodyFrom ?? (colon >= 0 && oneLine ? colon + 1 : headerEnd);
  const end = oneLine ? { line: lineIndex, col: END_OF_LINE } : { line: Math.min(lineIndex + 1, lastIndex), col: END_OF_LINE };
  return createRegion(lineIndex, keyword, lineIndex, from, end, isPerItem(text.slice(keywordEnd, headerEnd), end));
}

function isCallOverAFixedList(code, lineIndex, call) {
  const text = code[lineIndex] || "";
  if (call.receiver) return isAFixedList(countConstantLiteralElements(code, call.receiver));
  if (call.receiverAt === undefined || call.receiverAt < 0) return false;
  const before = text.slice(0, call.receiverAt + 1);
  const opening = findUnmatchedOpenerBefore(before, call.receiverAt);
  if (opening >= 0 && before[opening] === "[" && !/[\w$)\]]\s*$/.test(before.slice(0, opening))) return isAFixedList(countLiteralElements(before.slice(opening)));
  const keys = /Object\.(?:keys|values|entries)\s*\(\s*([A-Z][A-Z0-9_]*)\s*\)\s*$/.exec(before);
  return Boolean(keys) && isAFixedList(countConstantLiteralElements(code, keys[1]));
}

function findCallRegion(code, lineIndex, lastIndex, call) {
  const found = findLambdaBodyRegionOfTheCall(code, lineIndex, lastIndex, call);
  return found && isCallOverAFixedList(code, lineIndex, call) ? { ...found, perItem: false } : found;
}

function findLambdaBodyRegionOfTheCall(code, lineIndex, lastIndex, call) {
  const text = code[lineIndex];
  const start = call.opening >= 0 ? call.opening : call.col + call.callee.length;
  const closing = call.opening >= 0 ? findClosingParenthesis(text, call.opening) : -1;
  const marker = LAMBDA_MARKER_PATTERN.exec(text.slice(start, closing >= 0 ? closing : text.length));
  if (!marker) return null;
  const markerAt = start + marker.index;
  if (countOpened(text, EVERY_OPENER, start) > 0) {
    if (/\bdo(?:\s*\|[^|]*\|)?\s*$/.test(text) && !text.includes("{", start)) return createRegion(lineIndex, call.callee, lineIndex, markerAt, findIndentedEnd(code, lineIndex, lastIndex));
    const opening = call.opening >= 0 ? call.opening : text.indexOf("{", start);
    return createRegion(lineIndex, call.callee, lineIndex, markerAt, findBracedEnd(code, lineIndex, opening >= 0 ? opening : start, lastIndex));
  }
  if (/\bdo(?:\s*\|[^|]*\|)?\s*$/.test(text)) return createRegion(lineIndex, call.callee, lineIndex, markerAt, findIndentedEnd(code, lineIndex, lastIndex));
  return createRegion(lineIndex, call.callee, lineIndex, markerAt, { line: lineIndex, col: closing >= 0 ? closing : END_OF_LINE });
}

export function findLoopRegions({ code, firstIndex: fromIndex, toIndex, callsAt, diffDriver }) {
  const regions = [];
  for (let index = fromIndex; index <= toIndex; index++) {
    const text = code[index] || "";
    if (!text.trim()) continue;
    const statement = STATEMENT_LOOP_PATTERN.exec(text);
    if (statement) regions.push(createStatementRegion(code, index, toIndex, statement[1], statement.index + statement[0].length));
    for (const call of callsAt(index)) {
      const found = readCallEffects(diffDriver).isALoopCallee(call.callee) ? findCallRegion(code, index, toIndex, call) : null;
      if (found) regions.push(found);
    }
  }
  return regions;
}

const startsBefore = (left, right) => left.fromLine - right.fromLine || left.fromCol - right.fromCol;

export const holds = (region, lineIndex, col) => {
  const afterStart = lineIndex > region.fromLine || (lineIndex === region.fromLine && col >= region.fromCol);
  const beforeEnd = lineIndex < region.toLine || (lineIndex === region.toLine && col < region.toCol);
  return afterStart && beforeEnd;
};

export function findLoopHolding(regions, lineIndex, col) {
  let innermost = null;
  for (const region of regions) {
    if (!region.perItem || !holds(region, lineIndex, col)) continue;
    if (!innermost || startsBefore(region, innermost) > 0) innermost = region;
  }
  return innermost;
}

export function findInnermostLoop(regions, lineIndex, col) {
  let innermost = null;
  for (const region of regions) {
    if (!holds(region, lineIndex, col)) continue;
    if (!innermost || startsBefore(region, innermost) > 0) innermost = region;
  }
  return innermost;
}

const STOPPING_WORD_PATTERN = /(?:^|[^\w$.])(?:return|throw|raise)(?![\w$])|(?:^|[^\w$.])(?:panic|os\.Exit|log\.Fatal\w*|log\.Panic\w*|sys\.exit)\s*\(/;
const BREAK_WORD_PATTERN = /(?:^|[^\w$.])break(?![\w$])/;
const BRANCHING_HEAD_PATTERN = /\b(?:switch|select|match)\b[^{]*$/;
function findOpeningBraceBefore(code, lineIndex, col, stopLine) {
  let depth = 0;
  for (let index = lineIndex; index >= stopLine; index--) {
    const text = code[index] || "";
    for (let at = (index === lineIndex ? col : text.length) - 1; at >= 0; at--) {
      if (text[at] === "}") depth++;
      else if (text[at] === "{") {
        if (depth === 0) return { line: index, col: at };
        depth--;
      }
    }
  }
  return null;
}

function collectStatementsAfterInBraces(code, lineIndex, col, loop) {
  const levels = [];
  let from = { line: lineIndex, col };
  for (let guard = 0; guard < 50; guard++) {
    const opening = findOpeningBraceBefore(code, from.line, from.col, loop.fromLine);
    if (!opening || opening.line < loop.fromLine || (opening.line === loop.fromLine && opening.col < loop.fromCol - 1)) break;
    const end = findBracedEnd(code, opening.line, opening.col, loop.toLine);
    const branching = BRANCHING_HEAD_PATTERN.test((code[opening.line] || "").slice(0, opening.col));
    const pieces = [];
    let depth = 0;
    for (let index = from.line; index <= end.line; index++) {
      const text = code[index] || "";
      const to = index === end.line ? Math.min(end.col, text.length) : text.length;
      let piece = "";
      for (let at = index === from.line ? from.col : 0; at < to; at++) {
        const character = text[at];
        if (character === "{") depth++;
        else if (character === "}") depth--;
        else if (depth === 0) piece += character;
      }
      pieces.push(piece);
    }
    levels.push({ text: pieces.join("\n"), branching });
    if (end.line > loop.toLine || (end.line === loop.toLine && end.col >= loop.toCol)) break;
    from = { line: end.line, col: end.col + 1 };
  }
  return levels;
}

function findHeaderAtIndentBefore(code, lineIndex, indent) {
  for (let index = lineIndex - 1; index >= 0; index--) {
    const text = code[index] || "";
    if (text.trim() && indentOf(text) === indent) return text;
    if (text.trim() && indentOf(text) < indent) return "";
  }
  return "";
}

function collectStatementsAfterIndented(code, lineIndex, loop) {
  const head = indentOf(code[loop.head] || "");
  let level = indentOf(code[lineIndex] || "");
  let insideATry = false;
  let inTheTailOfATry = false;
  const levels = [{ text: code[lineIndex] || "", branching: false }];
  for (let index = lineIndex + 1; index <= loop.toLine; index++) {
    const text = code[index] || "";
    if (!text.trim()) continue;
    const indent = indentOf(text);
    if (indent <= head) break;
    if (indent > level) {
      if (inTheTailOfATry) levels[levels.length - 1].text += `\n${text}`;
      continue;
    }
    if (indent < level) {
      level = indent;
      insideATry = /^\s*try\s*:/.test(findHeaderAtIndentBefore(code, lineIndex, indent));
      levels.push({ text: "", branching: false });
    }
    inTheTailOfATry = insideATry && /^\s*(?:else|finally)\s*:/.test(text);
    if (/^\s*(?:else|elif|except|finally|catch)\b/.test(text) && !inTheTailOfATry) continue;
    levels[levels.length - 1].text += `\n${text}`;
  }
  return levels;
}

export function stopsTheLoop({ code, diffDriver, lineIndex, col, loop, regions }) {
  if (!loop || typeof loop.form !== "string" || !STATEMENT_KEYWORDS.has(loop.form)) return false;
  const lineStart = (code[lineIndex] || "").slice(0, col);
  if (/^\s*(?:return|throw|raise)\b/.test(lineStart)) return true;
  const levels = doBodiesEndWithoutABrace(findLanguage(diffDriver)) ? collectStatementsAfterIndented(code, lineIndex, loop) : collectStatementsAfterInBraces(code, lineIndex, col, loop);
  if (levels.some(level => STOPPING_WORD_PATTERN.test(level.text))) return true;
  if (!levels.some(level => !level.branching && BREAK_WORD_PATTERN.test(level.text))) return false;
  return findInnermostLoop(regions, lineIndex, col) === loop;
}

const STATEMENT_KEYWORDS = new Set(["for", "foreach", "while", "until", "loop", "repeat"]);

export const isInsideAny = (regions, lineIndex, col) => regions.some(region => holds(region, lineIndex, col));
