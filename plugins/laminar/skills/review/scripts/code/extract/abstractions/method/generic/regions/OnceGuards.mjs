import { findClosingParenthesis } from "../../../../../inputs/source/text/Brackets.mjs";
import { findLanguage } from "../../../../../inputs/source/Languages.mjs";
import { splitNameWords } from "../../../../../inputs/source/names/NameWords.mjs";
import { findBracedEnd, END_OF_LINE, findIndentedEnd, createRegion } from "./BodyRegions.mjs";

const IF_HEAD_PATTERN = /^(\s*(?:\}\s*)?(?:else\s+)?(?:if|elif|elsif)\b)(.*)$/;
const NIL_WORDS = new Set(["nil", "null", "None", "undefined", "NULL"]);
const WORDS_OF_A_LIMIT = new Set(["end", "limit", "max", "size", "batch", "capacity", "cap", "threshold", "chunk", "length", "len"]);
const SIMPLE_OPERAND_PATTERN = /^(?:len\s*\(\s*[\w$.]+\s*\)|[\w$.]+(?:\s*\(\s*\))?)$/;

function readCondition(text, headEnd, diffDriver) {
  const rest = text.slice(headEnd);
  const opening = rest.search(/\S/);
  if (opening >= 0 && rest[opening] === "(" && !findLanguage(diffDriver).conditionsTakeNoParentheses) {
    const closing = findClosingParenthesis(rest, opening);
    return closing < 0 ? rest : rest.slice(opening + 1, closing);
  }
  return rest.replace(/\{\s*$/, "").replace(/:\s*$/, "");
}

function readIfBody(code, lineIndex, lastIndex, text, headEnd) {
  if (/\{\s*$/.test(text)) {
    const brace = text.lastIndexOf("{");
    return createRegion(lineIndex, "if", lineIndex, brace + 1, findBracedEnd(code, lineIndex, brace, lastIndex));
  }
  if (/:\s*$/.test(text)) return createRegion(lineIndex, "if", lineIndex, text.length, findIndentedEnd(code, lineIndex, lastIndex));
  const next = lineIndex + 1 <= lastIndex ? code[lineIndex + 1] || "" : "";
  if (/^\s*\{/.test(next)) return createRegion(lineIndex, "if", lineIndex + 1, next.indexOf("{") + 1, findBracedEnd(code, lineIndex + 1, next.indexOf("{"), lastIndex));
  return createRegion(lineIndex, "if", lineIndex, headEnd, { line: lineIndex, col: END_OF_LINE });
}

const OWN_STATE_PREFIX_PATTERN = /^(?:this\.|self\.|@|\$this->|this->)/;

function findNilCheckedName(condition) {
  const text = condition.trim().replace(/^\(|\)$/g, "").trim();
  const compared = /^((?:this\.|self\.|@|\$this->|this->)?[A-Za-z_$][\w$.]*)\s*(?:==|===|\bis\b)\s*([A-Za-z]+)$/.exec(text);
  const negated = /^(?:!|not\s+)\s*((?:this\.|self\.|@|\$this->|this->)[A-Za-z_$][\w$.]*)$/.exec(text);
  return compared && NIL_WORDS.has(compared[2]) ? compared[1] : negated ? negated[1] : "";
}

const namesOwnOrOuterState = (name, isLocal) => OWN_STATE_PREFIX_PATTERN.test(name) || !isLocal(name.split(".")[0]);

function isANilGuard(condition, isLocal) {
  const name = findNilCheckedName(condition);
  return Boolean(name) && namesOwnOrOuterState(name, isLocal);
}

function isALimitGuard(condition) {
  const found = /^\(?\s*(.+?)\s*(>=|>|==)\s*(.+?)\s*\)?$/.exec(condition.trim());
  if (!found || /&&|\|\||\band\b|\bor\b/.test(condition)) return false;
  const [, left, , right] = found;
  if (!SIMPLE_OPERAND_PATTERN.test(left.trim()) || !SIMPLE_OPERAND_PATTERN.test(right.trim())) return false;
  return splitNameWords(right.replace(/\(\s*\)$/, "")).some(word => WORDS_OF_A_LIMIT.has(word));
}

export function findOnceGuardRegions({ code, firstIndex: fromIndex, toIndex, diffDriver, isLocal }) {
  const regions = [];
  for (let index = fromIndex; index <= toIndex; index++) {
    const text = code[index] || "";
    if (!text.trim()) continue;
    const head = IF_HEAD_PATTERN.exec(text);
    if (!head) continue;
    const condition = readCondition(text, head[1].length, diffDriver);
    if (isALimitGuard(condition) || isANilGuard(condition, isLocal)) {
      regions.push(readIfBody(code, index, toIndex, text, head[1].length + condition.length));
    }
  }
  return regions;
}
