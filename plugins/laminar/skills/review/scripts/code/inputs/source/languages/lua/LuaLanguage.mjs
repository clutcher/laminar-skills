import { BODY_ENDS } from "../../forms/BodyEnds.mjs";
import { createBlockForm, createForms } from "../../forms/CommentForms.mjs";
import { BLANK_PATTERN_SOURCE } from "../../forms/FunctionNamePatterns.mjs";

const LUA_FUNCTION_NAME_PATTERN_SOURCE = [
  `^${BLANK_PATTERN_SOURCE}*((local${BLANK_PATTERN_SOURCE}+)?function${BLANK_PATTERN_SOURCE}+[A-Za-z_][A-Za-z0-9_.:]*${BLANK_PATTERN_SOURCE}*\\(.*)`,
  `^${BLANK_PATTERN_SOURCE}*((local${BLANK_PATTERN_SOURCE}+)?[A-Za-z_][A-Za-z0-9_.]*${BLANK_PATTERN_SOURCE}*=${BLANK_PATTERN_SOURCE}*function${BLANK_PATTERN_SOURCE}*\\(.*)`,
  `^((local${BLANK_PATTERN_SOURCE}+)?[A-Za-z_][A-Za-z0-9_.]*${BLANK_PATTERN_SOURCE}*=${BLANK_PATTERN_SOURCE}*(\\{|setmetatable${BLANK_PATTERN_SOURCE}*\\().*)`,
].join("\n");

export const LuaLanguage = Object.freeze({
  diffDriver: "lua",
  extensions: [".lua"],
  commentForms: createForms(["--"], [createBlockForm("--[[", "]]")]),
  functionNamePattern: LUA_FUNCTION_NAME_PATTERN_SOURCE,
  singleQuotedStrings: true,
  bodyEnd: BODY_ENDS.INDENT,
});
