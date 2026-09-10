import { getOrReadAndRemember } from "../../../collections/memos.mjs";
import { findLanguage } from "../../inputs/source/Languages.mjs";
import { doBodiesEndWithoutABrace } from "../../inputs/source/forms/BodyEnds.mjs";
import { ASSIGNING_EQUALS_SIGN_PATTERN_SOURCE } from "../../inputs/source/text/PatternText.mjs";

const BODY_AFTER_THE_PARAMETERS_PATTERN = /\{|=>|=(?!\s*(?:0|delete)\s*;)/;

const PLACEHOLDER_BODY_LINE_PATTERN = /^(?:\.\.\.|pass|end|raise\s+NotImplementedError\b.*|["'].*)$/;

const readsBodilessDeclarations = diffDriver => !doBodiesEndWithoutABrace(findLanguage(diffDriver));

const readFirstStatement = text => text.slice(0, text.indexOf(";") + 1 || text.length);

const ABSTRACT_DECORATOR_PATTERN = /^\s*@.*\babstract(?:method)?\b/;

const WORDS_THAT_NAME_NO_MEMBER = new Set(["if", "for", "while", "switch", "catch", "synchronized", "return", "new", "throw", "super", "this",
  "assert", "when", "func", "function", "fn", "lambda", "typeof", "sizeof", "foreach", "using", "lock", "yield", "await"]);

const WORDS_BEFORE_NO_MEMBER = new Set(["new", "class", "interface", "record", "enum", "struct", "object", "trait", "return", "throw",
  "extends", "implements", "typeof", "throws", "case"]);

const MEMBER_NAME_AT_THE_END_PATTERN = /(?:^|[^\w$.@])([A-Za-z_$][\w$]*)\s*(?:<[^<>]*(?:<[^<>]*>[^<>]*)*>)?\s*$/;

const TOP_LEVEL_ASSIGNMENT_PATTERN = new RegExp(`(?<![=!<>])${ASSIGNING_EQUALS_SIGN_PATTERN_SOURCE}`);

const CONTINUED_STATEMENT_PATTERN = /(?:[=,+\-*/%&|?:.([<]|->|=>)$/;

function findMemberNameBefore(statement) {
  const found = MEMBER_NAME_AT_THE_END_PATTERN.exec(statement);
  if (!found || WORDS_THAT_NAME_NO_MEMBER.has(found[1])) return "";
  const before = statement.slice(0, found.index + found[0].indexOf(found[1]));
  if (TOP_LEVEL_ASSIGNMENT_PATTERN.test(before)) return "";
  const wordBefore = (/([A-Za-z_$][\w$]*)\s*$/.exec(before) || [])[1] || "";
  return WORDS_BEFORE_NO_MEMBER.has(wordBefore) ? "" : found[1];
}

function collectMemberHeads(code, fromIndex, toIndex) {
  const headIndexByMemberNameMap = new Map();
  let braces = 0;
  let parentheses = 0;
  let statement = "";
  let named = false;
  const endStatement = () => { statement = ""; named = false; };
  for (let at = fromIndex; at <= toIndex; at++) {
    const text = code[at] || "";
    for (let position = 0; position < text.length; position++) {
      const character = text[position];
      if (braces === 0) {
        if (character === "{") { braces = 1; endStatement(); }
        continue;
      }
      if (character === "{") { if (braces === 1 && parentheses === 0) endStatement(); braces++; continue; }
      if (character === "}") { braces--; if (braces <= 1) endStatement(); if (braces === 0) return headIndexByMemberNameMap; continue; }
      if (braces !== 1) continue;
      if (character === "(") {
        const name = parentheses === 0 && !named ? findMemberNameBefore(statement) : "";
        if (name && !headIndexByMemberNameMap.has(name)) headIndexByMemberNameMap.set(name, at);
        if (name) named = true;
        parentheses++;
        continue;
      }
      if (character === ")") { parentheses = Math.max(0, parentheses - 1); continue; }
      if (parentheses > 0) continue;
      if (character === ";") { endStatement(); continue; }
      statement += character;
    }
    if (braces === 1 && parentheses === 0 && !CONTINUED_STATEMENT_PATTERN.test(statement.trim())) endStatement();
    else statement += " ";
  }
  return headIndexByMemberNameMap;
}

export const BodilessDeclarations = {
  getOrReadBodilessMembers(typeDeclaration) {
    return getOrReadAndRemember(this.bodilessMembersByTypeDeclarationMap, typeDeclaration, () => this.readBodilessMembersOf(typeDeclaration));
  },

  readBodilessMembersOf(typeDeclaration) {
    const file = this.fileByPathMap.get(typeDeclaration.path);
    const readable = file && readsBodilessDeclarations(file.diffDriver);
    return readable ? collectMemberHeads(file.code, typeDeclaration.line - 1, typeDeclaration.to - 1) : new Map();
  },

  isABodilessDeclaration(method) {
    return readsBodilessDeclarations(method.file.diffDriver) && !this.hasABody(method);
  },

  hasABody(method) {
    const { file } = method;
    const head = (file.code[method.bodyLine] || "").slice(method.bodyCol);
    if (readsBodilessDeclarations(file.diffDriver)) return BODY_AFTER_THE_PARAMETERS_PATTERN.test(readFirstStatement([head, ...file.code.slice(method.bodyLine + 1, method.to)].join("\n")));
    for (let at = method.line - 2; at >= 0 && /^\s*@/.test(file.code[at] || ""); at--) if (ABSTRACT_DECORATOR_PATTERN.test(file.code[at])) return false;
    const onTheHead = head.slice(head.indexOf(":") + 1).trim();
    const body = [onTheHead, ...file.code.slice(method.bodyLine + 1, method.to).map(text => text.trim())].filter(Boolean);
    return !body.every(text => PLACEHOLDER_BODY_LINE_PATTERN.test(text));
  },
};
