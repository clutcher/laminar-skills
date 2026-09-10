import { C_FAMILY } from "../../forms/CommentForms.mjs";
import { RAW_MULTI_LINE } from "../../forms/StringForms.mjs";
import { createTripleQuotedJvmForm } from "../../forms/LexicalForms.mjs";
import { BLANK_PATTERN_SOURCE } from "../../forms/FunctionNamePatterns.mjs";

const KOTLIN_FUNCTION_NAME_PATTERN_SOURCE = `^${BLANK_PATTERN_SOURCE}*(([a-z]+${BLANK_PATTERN_SOURCE}+)*(fun|class|interface|object|typealias)(${BLANK_PATTERN_SOURCE}|\\{|$).*)`;

export const KotlinLanguage = Object.freeze({
  diffDriver: "kotlin",
  extensions: [".kt", ".kts"],
  testFileNames: [/Tests?\.[a-z]+$/],
  commentForms: C_FAMILY,
  stringForm: createTripleQuotedJvmForm(RAW_MULTI_LINE),
  functionNamePattern: KOTLIN_FUNCTION_NAME_PATTERN_SOURCE,
  backQuotedStrings: true,
  tripleQuotes: ['"""'],
  trailingDotContinues: true,
  family: "jvm",
});
