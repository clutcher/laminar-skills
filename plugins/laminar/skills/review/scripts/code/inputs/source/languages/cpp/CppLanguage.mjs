import { C_FAMILY } from "../../forms/CommentForms.mjs";
import { BLANK_PATTERN_SOURCE, IDENTIFIER_PATTERN_SOURCE, rejectStatements } from "../../forms/FunctionNamePatterns.mjs";

const CPP_FUNCTION_NAME_PATTERN_SOURCE = [
  rejectStatements("case", "default", "using", "typedef", "friend", "goto", "delete", "sizeof", "static_assert"),
  `^${BLANK_PATTERN_SOURCE}*((template${BLANK_PATTERN_SOURCE}*<[^>]*>${BLANK_PATTERN_SOURCE}*)?(class|struct|union|enum(${BLANK_PATTERN_SOURCE}+(class|struct))?|namespace)${BLANK_PATTERN_SOURCE}+${IDENTIFIER_PATTERN_SOURCE}.*)`,
  `^${BLANK_PATTERN_SOURCE}*((((static|virtual|inline|explicit|constexpr|extern|friend|const|volatile|unsigned|signed|typename|template${BLANK_PATTERN_SOURCE}*<[^>]*>)${BLANK_PATTERN_SOURCE}+)*` +
    `(([A-Za-z_][A-Za-z0-9_:<>,*&]*${BLANK_PATTERN_SOURCE}+)+)?[~A-Za-z_][A-Za-z0-9_:]*${BLANK_PATTERN_SOURCE}*\\([^;]*\\)(${BLANK_PATTERN_SOURCE}*(const|override|final|noexcept|&&|&|->[^;{]*|\\{|:[^;]*|=${BLANK_PATTERN_SOURCE}*(default|delete|0)))*${BLANK_PATTERN_SOURCE}*$))`,
].join("\n");

export const CppLanguage = Object.freeze({
  diffDriver: "cpp",
  extensions: [".c", ".h", ".cc", ".cpp", ".cxx", ".c++", ".hpp", ".hh", ".hxx", ".h++", ".inl", ".ipp", ".tpp"],
  testFileNames: [/Tests?\.[a-z]+$/, /_test\.[a-z]+$/],
  commentForms: C_FAMILY,
  functionNamePattern: CPP_FUNCTION_NAME_PATTERN_SOURCE,
  trailingDotContinues: true,
});
