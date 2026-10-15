import { C_FAMILY } from "../../forms/CommentForms.mjs";
import { MULTI_LINE } from "../../forms/StringForms.mjs";
import { createTripleQuotedJvmForm } from "../../forms/LexicalForms.mjs";
import { BLANK_PATTERN_SOURCE, IDENTIFIER_PATTERN_SOURCE, rejectStatements } from "../../forms/FunctionNamePatterns.mjs";

const JAVA_TYPE_WORD_PATTERN_SOURCE = `[A-Za-z_<>&?@][][?&<>.,A-Za-z_0-9]*`;

const JAVA_FUNCTION_NAME_PATTERN_SOURCE = [
  rejectStatements("instanceof", "assert", "case", "package", "import"),
  `^${BLANK_PATTERN_SOURCE}*((@${IDENTIFIER_PATTERN_SOURCE}${BLANK_PATTERN_SOURCE}+)*([a-z-]+${BLANK_PATTERN_SOURCE}+)*(class|enum|interface|record|@interface)${BLANK_PATTERN_SOURCE}+${IDENTIFIER_PATTERN_SOURCE}.*)`,
  `^${BLANK_PATTERN_SOURCE}*((${JAVA_TYPE_WORD_PATTERN_SOURCE}${BLANK_PATTERN_SOURCE}+)+${IDENTIFIER_PATTERN_SOURCE}${BLANK_PATTERN_SOURCE}*\\([^;]*)$`,
  `^${BLANK_PATTERN_SOURCE}*((${JAVA_TYPE_WORD_PATTERN_SOURCE}${BLANK_PATTERN_SOURCE}+)+${IDENTIFIER_PATTERN_SOURCE}${BLANK_PATTERN_SOURCE}*\\([^;{]*\\)${BLANK_PATTERN_SOURCE}*(throws${BLANK_PATTERN_SOURCE}+[^;{]*)?\\{.*)$`,
  `^${BLANK_PATTERN_SOURCE}*((${JAVA_TYPE_WORD_PATTERN_SOURCE}${BLANK_PATTERN_SOURCE}+)+${IDENTIFIER_PATTERN_SOURCE}${BLANK_PATTERN_SOURCE}*\\([^;]*\\)${BLANK_PATTERN_SOURCE}*(throws${BLANK_PATTERN_SOURCE}+[^;]*)?;${BLANK_PATTERN_SOURCE}*(//.*)?)$`,
  `^${BLANK_PATTERN_SOURCE}*([A-Z][A-Za-z0-9_$]*${BLANK_PATTERN_SOURCE}*\\((${BLANK_PATTERN_SOURCE}*\\)${BLANK_PATTERN_SOURCE}*(throws${BLANK_PATTERN_SOURCE}+[^;{]*)?\\{|${BLANK_PATTERN_SOURCE}*(${JAVA_TYPE_WORD_PATTERN_SOURCE}${BLANK_PATTERN_SOURCE}+)+${IDENTIFIER_PATTERN_SOURCE}${BLANK_PATTERN_SOURCE}*(,|\\)|$)).*)$`,
].join("\n");

export const JavaLanguage = Object.freeze({
  diffDriver: "java",
  extensions: [".java"],
  testFileNames: [/Tests?\.[a-z]+$/, /[a-z\d]IT\.[a-z]+$/],
  commentForms: C_FAMILY,
  stringForm: createTripleQuotedJvmForm(MULTI_LINE),
  functionNamePattern: JAVA_FUNCTION_NAME_PATTERN_SOURCE,
  trailingDotContinues: true,
  family: "jvm",
});
