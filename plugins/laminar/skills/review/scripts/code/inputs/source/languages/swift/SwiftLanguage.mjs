import { C_FAMILY } from "../../forms/CommentForms.mjs";
import { MULTI_LINE, createShortQuote, createTripleQuote } from "../../forms/StringForms.mjs";
import { C_COMMENTS, createForm } from "../../forms/LexicalForms.mjs";
import { BLANK_PATTERN_SOURCE, IDENTIFIER_PATTERN_SOURCE, rejectStatements } from "../../forms/FunctionNamePatterns.mjs";

const SWIFT_FUNCTION_NAME_PATTERN_SOURCE = [
  rejectStatements("guard", "repeat", "defer"),
  `^${BLANK_PATTERN_SOURCE}*(((public|private|fileprivate|internal|open|static|final|override|mutating|nonmutating|class|convenience|required|indirect|dynamic|@[A-Za-z]+)${BLANK_PATTERN_SOURCE}+)*` +
    `(func|init|deinit|subscript|class|struct|enum|protocol|extension|actor|typealias)(${BLANK_PATTERN_SOURCE}+${IDENTIFIER_PATTERN_SOURCE}|${BLANK_PATTERN_SOURCE}*[(<{?!]).*)`,
].join("\n");

export const SwiftLanguage = Object.freeze({
  diffDriver: "swift",
  extensions: [".swift"],
  testFileNames: [/Tests?\.[a-z]+$/],
  commentForms: C_FAMILY,
  stringForm: createForm(C_COMMENTS, [createTripleQuote("\"", MULTI_LINE), createShortQuote("\"")]),
  functionNamePattern: SWIFT_FUNCTION_NAME_PATTERN_SOURCE,
  tripleQuotes: ['"""'],
  trailingDotContinues: true,
});
