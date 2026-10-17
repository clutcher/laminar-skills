import { C_FAMILY } from "../../forms/CommentForms.mjs";
import { MULTI_LINE, createShortQuote, createTripleQuote } from "../../forms/StringForms.mjs";
import { C_COMMENTS, createForm } from "../../forms/LexicalForms.mjs";
import { BLANK_PATTERN_SOURCE, IDENTIFIER_PATTERN_SOURCE, rejectStatements } from "../../forms/FunctionNamePatterns.mjs";

const DART_FUNCTION_NAME_PATTERN_SOURCE = [
  rejectStatements("assert", "super", "this", "print"),
  `^${BLANK_PATTERN_SOURCE}*(((abstract|base|final|sealed|interface|mixin|augment)${BLANK_PATTERN_SOURCE}+)*(class|mixin|enum|extension|typedef)${BLANK_PATTERN_SOURCE}+${IDENTIFIER_PATTERN_SOURCE}.*)`,
  `^${BLANK_PATTERN_SOURCE}*(((static|external|const|factory|late)${BLANK_PATTERN_SOURCE}+)*(${IDENTIFIER_PATTERN_SOURCE}(<[^;]*>)?\\??${BLANK_PATTERN_SOURCE}+)?((get|set)${BLANK_PATTERN_SOURCE}+)?` +
    `([A-Z][A-Za-z0-9_]*\\.)?${IDENTIFIER_PATTERN_SOURCE}${BLANK_PATTERN_SOURCE}*(<[^>]*>)?\\([^;]*$)`,
].join("\n");

export const DartLanguage = Object.freeze({
  diffDriver: "dart",
  extensions: [".dart"],
  testFileNames: [/_test\.dart$/],
  testNameAffixes: { openings: [], endings: ["_test"] },
  commentForms: C_FAMILY,
  stringForm: createForm(C_COMMENTS, [createTripleQuote("\"", MULTI_LINE), createTripleQuote("'", MULTI_LINE), createShortQuote("\""), createShortQuote("'")]),
  functionNamePattern: DART_FUNCTION_NAME_PATTERN_SOURCE,
  singleQuotedStrings: true,
  tripleQuotes: ['"""', "'''"],
  trailingDotContinues: true,
});
