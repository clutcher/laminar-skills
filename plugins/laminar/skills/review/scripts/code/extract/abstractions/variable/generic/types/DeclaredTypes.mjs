import { findATypeWord, COLON_TYPE_PATTERN_SOURCE, TYPE_PATTERN_SOURCE } from "../../../../../inputs/source/text/TypeText.mjs";
import { findVariableFinder } from "../../../../finders/LanguageStrategies.mjs";
import { escapeForAPattern } from "../../../../../inputs/source/text/PatternText.mjs";
import { findClosingParenthesis, ONLY_PARENTHESES } from "../../../../../inputs/source/text/Brackets.mjs";

export const WORDS_THAT_INFER_A_TYPE = new Set(["var", "val", "let", "auto", "dynamic", "const", "final"]);

const OWN_PREFIX_PATTERN_SOURCE = "(?:self\\.|this\\.|@|\\$this->|this->)?";

const DEFAULT_LITERAL_TYPES = { map: "Map", list: "List", text: "String" };

const INITIALIZER_FORMS = [
  [/^(?:await\s+)?new\s+([A-Za-z_\\][\w.:\\]*)/, found => found[1]],
  [/^(?:[a-z_]\w*\.)?New([A-Z]\w*)\s*\(/, found => found[1]],
];

const DECLARING_WORD_BEFORE_PATTERN = /(?:^|[^\w$.])(?:var|let|const|val|auto|final|my|local|def|dim)\s+(?:mut\s+)?$/;

const CONSTRUCTOR_CALL_FORM_PATTERN = /^([A-Za-z_][\w.:]*?)(?:::new)?\s*(?:<[^()]*>)?\s*\(/;

const CALL_INITIALIZER_PATTERN = /^(?:await\s+|try\s+|yield\s+)?((?:this\.|self\.|\$this->|this->)?[A-Za-z_$][\w$]*(?:\s*(?:\.|->|::)\s*[A-Za-z_$][\w$]*)*)\s*(?:<[^()<>]*>)?\s*\(/;

const NAME_ALONE_PATTERN = /^[A-Za-z_$@][\w$]*\s*[;,)]?\s*$/;

const readCallText = text => text.replace(/\s+/g, "").replace(/->|::/g, ".");

function findCallOfInitializer(text, diffDriver) {
  const found = CALL_INITIALIZER_PATTERN.exec(text);
  if (!found) return "";
  const closing = findClosing(text, text.indexOf("(", found[0].length - 1));
  const rest = closing < 0 ? "" : text.slice(closing + 1).trim();
  if (rest && !/^[;,)]*\s*(?:\{|\?|!!|;|$)/.test(rest) && !(findVariableFinder(diffDriver).callMayOpenABlock && /^\{?$/.test(rest))) return "";
  return readCallText(found[1]);
}

const findClosing = (text, opening) => (opening < 0 ? -1 : findClosingParenthesis(text, opening, ONLY_PARENTHESES));

function findLiteralType(initializer, diffDriver) {
  const types = findVariableFinder(diffDriver).literalTypes || DEFAULT_LITERAL_TYPES;
  if (/^\{/.test(initializer) || /^dict\(|^defaultdict\(|^OrderedDict\(/.test(initializer)) return types.map;
  if (/^\[/.test(initializer)) return types.list;
  if (/^set\(/.test(initializer)) return "set";
  if (/^["'`]/.test(initializer)) return types.text;
  if (types.pattern && /^\/(?![/*])/.test(initializer)) return types.pattern;
  return "";
}

export function readTypeOfInitializer(initializer, diffDriver) {
  const text = String(initializer || "").trim();
  if (!text) return { type: "" };
  const literal = findLiteralType(text, diffDriver);
  if (literal) return { type: literal };
  const call = findCallOfInitializer(text, diffDriver);
  for (const [pattern, typeOf] of [...(findVariableFinder(diffDriver).initializerForms || []), ...INITIALIZER_FORMS]) {
    const found = pattern.exec(text);
    if (found) {
      const type = typeOf(found);
      if (type) return { type, call };
    }
  }
  const constructed = findVariableFinder(diffDriver).capitalCallIsAFunction ? null : CONSTRUCTOR_CALL_FORM_PATTERN.exec(text);
  if (constructed && /^[A-Z]/.test(constructed[1].split(/\.|::/).pop())) return { type: constructed[1] };
  if (call) return { type: "", call };
  const alone = NAME_ALONE_PATTERN.test(text);
  return alone ? { type: "", untyped: true, alias: text.replace(/[\s;,)]+$/, "") } : { type: "", untyped: false };
}

function findForEachDeclarationIn(code, name, diffDriver) {
  const finder = findVariableFinder(diffDriver);
  const found = finder.forEachForm ? finder.forEachForm.exec(code) : null;
  if (!found) return null;
  if (found[2] === name) {
    if (finder.forEachNamesAKeyFirst ? !found[1] : Boolean(found[1])) return { type: "", untyped: true };
    return { type: "", iteratedExpression: found[3].trim() };
  }
  if (found[1] === name) return { type: "", untyped: true };
  return null;
}

const NAME_IN_A_LIST_PATTERN_SOURCE = "[A-Za-z_$][\\w$]*";

class NamePatterns {
  constructor(name, diffDriver) {
    const word = escapeForAPattern(name);
    this.multiple = new RegExp(`(?<![\\w$@.])((?:${NAME_IN_A_LIST_PATTERN_SOURCE}\\s*,\\s*)*)${word}((?:\\s*,\\s*${NAME_IN_A_LIST_PATTERN_SOURCE})*)\\s*(?::=|=(?![=>~]))\\s*(.+)$`);
    const finder = findVariableFinder(diffDriver);
    this.before = finder.typeOrder === "before"
      ? new RegExp(`(?:^|[\\s(,<])(${TYPE_PATTERN_SOURCE})\\s+[*&]?${word}\\s*(?:[=;,):]|->|&&|\\|\\||\\?|\\bwhen\\b|$)`) : null;
    this.colon = finder.typeOrder === "colon"
      ? new RegExp(`(?<![\\w$@?.])${OWN_PREFIX_PATTERN_SOURCE}${word}\\s*:\\s*(${COLON_TYPE_PATTERN_SOURCE})`) : null;
    this.go = finder.typeOrder === "nameThenType"
      ? new RegExp(`(?<![\\w$."])${word}\\s*(?:,\\s*[A-Za-z_]\\w*\\s*)*\\s+(${finder.typeAfterTheName})`) : null;
    this.initializer = new RegExp(`(?<![\\w$@.])${OWN_PREFIX_PATTERN_SOURCE}${word}\\s*(?::\\s*[^=;]*)?(?::=|=(?![=>~]))\\s*(.+)$`);
  }
}

const patternsByKeyMap = new Map();

const readPatterns = (name, diffDriver) => {
  const key = `${diffDriver}\u0000${name}`;
  if (!patternsByKeyMap.has(key)) patternsByKeyMap.set(key, new NamePatterns(name, diffDriver));
  return patternsByKeyMap.get(key);
};

function isADeclaration(code, found, value, diffDriver) {
  const finder = findVariableFinder(diffDriver);
  if (!finder.declaredOnlyWithAWordOrAType) return true;
  const valueAt = found.index + found[0].length - value.length;
  if (/:=\s*$/.test(code.slice(0, valueAt))) return true;
  if (finder.ownFieldAssignmentDeclares && /^this\./.test(found[0])) return true;
  return DECLARING_WORD_BEFORE_PATTERN.test(code.slice(0, found.index));
}

function isAnArgumentOfACall(code, at) {
  let depth = 0;
  for (let position = at - 1; position >= 0; position--) {
    if (code[position] === ")") depth++;
    else if (code[position] === "(") {
      if (depth === 0) return /[\w$]\s*$/.test(code.slice(0, position));
      depth--;
    }
  }
  return false;
}

export function findDeclarationInLine(code, name, diffDriver, withAssignments = true) {
  const looped = findForEachDeclarationIn(code, name, diffDriver);
  if (looped) return looped;
  const patterns = readPatterns(name, diffDriver);
  for (const pattern of [patterns.before, patterns.colon, patterns.go]) {
    if (!pattern) continue;
    const found = pattern.exec(code);
    if (!found) continue;
    const type = findATypeWord(found[1]);
    if (!type) continue;
    if (!WORDS_THAT_INFER_A_TYPE.has(type.split(/\s/)[0])) return { type };
  }
  const listed = code.includes(",") && code.includes("=") ? patterns.multiple.exec(code) : null;
  const multiple = listed && !isAnArgumentOfACall(code, listed.index) ? listed : null;
  const multipleDeclares = multiple && (withAssignments || isADeclaration(code, multiple, multiple[3], diffDriver));
  if (multiple && (multiple[1] || multiple[2]) && multipleDeclares) {
    const found = readTypeOfInitializer(multiple[3], diffDriver);
    const position = multiple[1] ? multiple[1].split(",").length - 1 : 0;
    return found.call ? { type: position === 0 ? found.type || "" : "", call: found.call, position } : { type: "", untyped: true };
  }
  const assigned = patterns.initializer.exec(code);
  if (!assigned || isAnArgumentOfACall(code, assigned.index)) return null;
  if (!withAssignments && !isADeclaration(code, assigned, assigned[1], diffDriver)) return null;
  return readTypeOfInitializer(assigned[1], diffDriver);
}

export function findDeclarationIn(code, lineIndexes, name, diffDriver, withAssignments = true) {
  for (const index of lineIndexes) {
    const text = code[index];
    if (!text || !text.includes(name)) continue;
    const found = findDeclarationInLine(text, name, diffDriver, withAssignments);
    if (found && (found.type || found.call || found.iteratedExpression || found.untyped)) return { ...found, index };
  }
  return null;
}
