import { C_FAMILY } from "../../forms/CommentForms.mjs";
import { RAW_MULTI_LINE } from "../../forms/StringForms.mjs";
import { createTripleQuotedJvmForm } from "../../forms/LexicalForms.mjs";
import { BLANK_PATTERN_SOURCE, IDENTIFIER_PATTERN_SOURCE, rejectStatements } from "../../forms/FunctionNamePatterns.mjs";

const SCALA_FUNCTION_NAME_PATTERN_SOURCE = [
  rejectStatements("match", "finally"),
  `^${BLANK_PATTERN_SOURCE}*(((private|protected|final|abstract|sealed|implicit|lazy|override|case|inline|transparent|opaque|open|infix)${BLANK_PATTERN_SOURCE}+)*` +
    `(def|class|object|trait|enum|type)${BLANK_PATTERN_SOURCE}+${IDENTIFIER_PATTERN_SOURCE}.*)`,
].join("\n");

export const ScalaLanguage = Object.freeze({
  diffDriver: "scala",
  extensions: [".scala", ".sc"],
  testFileNames: [/Tests?\.[a-z]+$/, /[a-z\d]IT\.[a-z]+$/, /Spec\.[a-z]+$/],
  commentForms: C_FAMILY,
  stringForm: createTripleQuotedJvmForm(RAW_MULTI_LINE),
  functionNamePattern: SCALA_FUNCTION_NAME_PATTERN_SOURCE,
  tripleQuotes: ['"""'],
  trailingDotContinues: true,
  family: "jvm",
});
