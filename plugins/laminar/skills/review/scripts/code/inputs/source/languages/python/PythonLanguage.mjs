import { BODY_ENDS } from "../../forms/BodyEnds.mjs";
import { HASH_ONLY } from "../../forms/CommentForms.mjs";
import { MULTI_LINE, createShortQuote, createTripleQuote } from "../../forms/StringForms.mjs";
import { createForm, HASH_COMMENTS } from "../../forms/LexicalForms.mjs";

export const PythonLanguage = Object.freeze({
  diffDriver: "python",
  extensions: [".py", ".pyi", ".pyw"],
  testFileNames: [/(?:^|\/)test_[^/]*\.py$/, /_test\.py$/],
  testNameAffixes: { openings: ["test_"], endings: ["_test"] },
  commentForms: HASH_ONLY,
  stringForm: createForm(HASH_COMMENTS, [createTripleQuote("\"", MULTI_LINE), createTripleQuote("'", MULTI_LINE), createShortQuote("\""), createShortQuote("'")], { docstrings: true }),
  singleQuotedStrings: true,
  tripleQuotes: ['"""', "'''"],
  bodyEnd: BODY_ENDS.INDENT,
  conditionsTakeNoParentheses: true,
});
