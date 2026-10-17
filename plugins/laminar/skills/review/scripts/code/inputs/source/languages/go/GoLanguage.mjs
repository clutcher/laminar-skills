import { C_FAMILY } from "../../forms/CommentForms.mjs";
import { createDelimitedOpener, RAW_MULTI_LINE, createShortQuote } from "../../forms/StringForms.mjs";
import { C_COMMENTS, createForm } from "../../forms/LexicalForms.mjs";
import { BLANK_PATTERN_SOURCE, IDENTIFIER_PATTERN_SOURCE } from "../../forms/FunctionNamePatterns.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";

const GO_RECEIVER_PATTERN = /^\s*func\s*\(\s*[A-Za-z_]\w*\s+\*?([A-Za-z_]\w*)\s*\)\s*([A-Za-z_]\w*)/;

const findReceiverMethod = head => {
  const receiver = GO_RECEIVER_PATTERN.exec(head);
  return receiver ? { scale: Scale.METHOD.name, name: receiver[2], scope: receiver[1] } : null;
};

const GOLANG_FUNCTION_NAME_PATTERN_SOURCE = [
  `^${BLANK_PATTERN_SOURCE}*(func(${BLANK_PATTERN_SOURCE}|\\().*)`,
  `^${BLANK_PATTERN_SOURCE}*(type${BLANK_PATTERN_SOURCE}+${IDENTIFIER_PATTERN_SOURCE}.*)`,
].join("\n");

export const GoLanguage = Object.freeze({
  diffDriver: "golang",
  extensions: [".go"],
  testFileNames: [/_test\.go$/],
  testNameAffixes: { openings: [], endings: ["_test"] },
  commentForms: C_FAMILY,
  stringForm: createForm(C_COMMENTS, [createDelimitedOpener("`", "`", RAW_MULTI_LINE), createShortQuote("\""), createShortQuote("'")]),
  functionNamePattern: GOLANG_FUNCTION_NAME_PATTERN_SOURCE,
  readDeclaration: findReceiverMethod,
  backQuotedStrings: true,
  trailingDotContinues: true,
  moduleSeparator: "/",
  conditionsTakeNoParentheses: true,
});
