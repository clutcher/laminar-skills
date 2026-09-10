import { findIndexWhereTheParenthesesBalance, NOT_BALANCED, countParenthesesOpened } from "../../text/Brackets.mjs";
import { findDiffDriver } from "../../Languages.mjs";

const GRAPHQL = "graphql";

export const TYPE_HEAD_PATTERN = /^\s*(?:extend\s+)?(?:type|input|enum|interface|union|scalar)\s+([A-Za-z_]\w*)/;
const FIELD_PATTERN = /^\s*([A-Za-z_]\w*)\s*[(:]/;
const ENUM_VALUE_PATTERN = /^\s*([A-Za-z_]\w*)\s*(?:@.*)?$/;
const INDENTED_LINE_PATTERN = /^\s/;
const DESCRIPTION_FENCE = '"""';
const ONE_LINE_STRING_PATTERN = /"(?:[^"\\]|\\.)*"/g;
const COMMENT_PATTERN = /#.*$/;
const QUERY_OPENING_PATTERN = /^(?:(?:query|mutation|subscription|fragment)\b|\{)/;
const SCHEMA_HEAD_PATTERN = /^\s*(?:extend\s+)?(?:type|input|enum|interface|union|scalar|schema|directive)\b/;
const COMMENT_LINE_PATTERN = /^\s*#/;

export const GRAPHQL_FILE_KINDS = Object.freeze({ SCHEMA: "schema", QUERY: "query", NONE: "none" });

const countCharacter = (text, character) => text.split(character).length - 1;

export const readCodeOfAHead = headLine => String(headLine || "").replace(ONE_LINE_STRING_PATTERN, "\"\"").replace(COMMENT_PATTERN, "");

class SchemaLines {
  constructor() {
    this.inDescription = false;
  }

  readCode(text) {
    let rest = String(text);
    let code = "";
    for (;;) {
      if (this.inDescription) {
        const closed = rest.indexOf(DESCRIPTION_FENCE);
        if (closed < 0) return code;
        rest = rest.slice(closed + DESCRIPTION_FENCE.length);
        this.inDescription = false;
        continue;
      }
      const opened = rest.indexOf(DESCRIPTION_FENCE);
      if (opened < 0) return (code + rest).replace(ONE_LINE_STRING_PATTERN, "\"\"").replace(COMMENT_PATTERN, "");
      code += rest.slice(0, opened);
      rest = rest.slice(opened + DESCRIPTION_FENCE.length);
      this.inDescription = true;
    }
  }
}

export const findMemberName = code => (FIELD_PATTERN.exec(code) || ENUM_VALUE_PATTERN.exec(code) || [])[1] || null;

const isAnIndentedMember = code => INDENTED_LINE_PATTERN.test(code) && Boolean(findMemberName(code));

const findLastLineOfTheMember = (codes, index) => {
  const balancedAt = findIndexWhereTheParenthesesBalance(codes, index);
  return balancedAt === NOT_BALANCED ? codes.length : balancedAt + 1;
};

class SchemaScanPosition {
  constructor() {
    this.braces = 0;
    this.parentheses = 0;
    this.typeHeadOpen = false;
    this.insideATypeBody = false;
  }

  get atTopLevel() {
    return this.braces === 0 && this.parentheses === 0;
  }

  get atAMemberOfAType() {
    return this.braces === 1 && this.parentheses === 0 && this.insideATypeBody;
  }

  declaresAt(code) {
    if (this.atTopLevel) return TYPE_HEAD_PATTERN.test(code) || isAnIndentedMember(code);
    return this.atAMemberOfAType && Boolean(findMemberName(code));
  }

  readHead(code) {
    if (!this.atTopLevel) return;
    if (TYPE_HEAD_PATTERN.test(code)) this.typeHeadOpen = true;
    else if (!INDENTED_LINE_PATTERN.test(code)) this.typeHeadOpen = false;
  }

  readBody(code) {
    this.enterTypeBody(code);
    this.readBrackets(code);
    this.leaveTypeBody();
  }

  enterTypeBody(code) {
    if (this.braces === 0 && countCharacter(code, "{")) this.insideATypeBody = this.typeHeadOpen;
  }

  readBrackets(code) {
    this.braces = Math.max(0, this.braces + countCharacter(code, "{") - countCharacter(code, "}"));
    this.parentheses = Math.max(0, this.parentheses + countParenthesesOpened(code));
  }

  leaveTypeBody() {
    if (this.braces === 0) this.insideATypeBody = false;
  }
}

export function collectSchemaHeads(lines) {
  const schemaLines = new SchemaLines();
  const position = new SchemaScanPosition();
  const heads = [];
  (lines || []).forEach((text, index) => {
    const code = schemaLines.readCode(text);
    if (!code.trim()) return;
    if (position.declaresAt(code)) heads.push({ line: index + 1, head: code.trim() });
    position.readHead(code);
    position.readBody(code);
  });
  return heads;
}

export function findMemberEnds(lines) {
  const schemaLines = new SchemaLines();
  const codes = (lines || []).map(text => schemaLines.readCode(text));
  const endByLineMap = new Map(collectSchemaHeads(lines)
    .filter(({ head }) => !TYPE_HEAD_PATTERN.test(head))
    .map(({ line }) => [line, findLastLineOfTheMember(codes, line - 1)]));
  return line => endByLineMap.get(line) || 0;
}

const findFirstCodeLine = lines => (lines || []).map(text => String(text).trim()).find(text => text && !COMMENT_LINE_PATTERN.test(text)) || "";

export function readGraphQlFileKind(lines) {
  if (QUERY_OPENING_PATTERN.test(findFirstCodeLine(lines))) return GRAPHQL_FILE_KINDS.QUERY;
  return (lines || []).some(text => SCHEMA_HEAD_PATTERN.test(String(text))) ? GRAPHQL_FILE_KINDS.SCHEMA : GRAPHQL_FILE_KINDS.NONE;
}

export const isASchemaFile = (filePath, lines) => findDiffDriver(filePath) === GRAPHQL && readGraphQlFileKind(lines) === GRAPHQL_FILE_KINDS.SCHEMA;
