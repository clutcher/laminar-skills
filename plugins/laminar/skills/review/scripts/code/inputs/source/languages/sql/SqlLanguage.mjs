import { BODY_ENDS } from "../../forms/BodyEnds.mjs";
import { createForms, SLASH_STAR } from "../../forms/CommentForms.mjs";
import { BLANK_PATTERN_SOURCE, buildCaselessPattern } from "../../forms/FunctionNamePatterns.mjs";
import { NO_DECLARATION } from "../../drivers/LanguageDriver.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";

const [CLASS, METHOD, VARIABLE] = [Scale.CLASS.name, Scale.METHOD.name, Scale.VARIABLE.name];

const SQL_HEAD_PATTERN = /^create\s+(?:or\s+replace\s+)?(?:(?:temp|temporary|unlogged|materialized|unique|global|local)\s+)*(table|view|function|procedure|trigger|type|index|sequence)\s+(?:if\s+not\s+exists\s+)?[`"[]?([A-Za-z_][\w.$]*)/i;
const SQL_SCALE_BY_HEAD_WORD_MAP = { table: CLASS, view: CLASS, type: CLASS, function: METHOD, procedure: METHOD, trigger: METHOD, index: VARIABLE, sequence: VARIABLE };

function readSqlDeclaration(head) {
  const found = SQL_HEAD_PATTERN.exec(head);
  return found ? { scale: SQL_SCALE_BY_HEAD_WORD_MAP[found[1].toLowerCase()], name: found[2], scope: null } : NO_DECLARATION;
}

const SQL_HEAD_WORDS = ["table", "view", "function", "procedure", "trigger", "type", "index", "sequence"];

const SQL_FUNCTION_NAME_PATTERN_SOURCE =
  `^${BLANK_PATTERN_SOURCE}*(${buildCaselessPattern("create")}${BLANK_PATTERN_SOURCE}+(${buildCaselessPattern("or")}${BLANK_PATTERN_SOURCE}+${buildCaselessPattern("replace")}${BLANK_PATTERN_SOURCE}+)?` +
  `((${["temp", "temporary", "unlogged", "materialized", "unique", "global", "local"].map(buildCaselessPattern).join("|")})${BLANK_PATTERN_SOURCE}+)*` +
  `(${SQL_HEAD_WORDS.map(buildCaselessPattern).join("|")})${BLANK_PATTERN_SOURCE}+.*)`;

export const SqlLanguage = Object.freeze({
  diffDriver: "sql",
  extensions: [".sql", ".ddl", ".psql", ".pgsql", ".plsql"],
  commentForms: createForms(["--"], [SLASH_STAR]),
  functionNamePattern: SQL_FUNCTION_NAME_PATTERN_SOURCE,
  readDeclaration: readSqlDeclaration,
  singleQuotedStrings: true,
  bodyEnd: BODY_ENDS.CLOSING_MARK,
});
