import { BODY_ENDS } from "../../forms/BodyEnds.mjs";
import { createForms } from "../../forms/CommentForms.mjs";
import { BLANK_PATTERN_SOURCE } from "../../forms/FunctionNamePatterns.mjs";

const ERLANG_FUNCTION_NAME_PATTERN_SOURCE = `^[a-z][A-Za-z0-9_@]*\\(.*->${BLANK_PATTERN_SOURCE}*$`;

export const ErlangLanguage = Object.freeze({
  diffDriver: "erlang",
  extensions: [".erl", ".hrl"],
  testFileNames: [/_test\.erl$/],
  commentForms: createForms(["%"]),
  functionNamePattern: ERLANG_FUNCTION_NAME_PATTERN_SOURCE,
  singleQuotedStrings: true,
  bodyEnd: BODY_ENDS.CLOSING_MARK,
});
