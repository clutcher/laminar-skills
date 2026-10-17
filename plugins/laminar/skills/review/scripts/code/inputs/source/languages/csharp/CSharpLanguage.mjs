import { C_FAMILY } from "../../forms/CommentForms.mjs";
import { createMatchedOpener, RAW_MULTI_LINE, createShortQuote, createTextFrame } from "../../forms/StringForms.mjs";
import { C_COMMENTS, createForm } from "../../forms/LexicalForms.mjs";

const rawCSharpString = createMatchedOpener(/"{3,}/y, found => createTextFrame(found[0], RAW_MULTI_LINE));
const verbatimCSharpString = createMatchedOpener(/(?:\$@|@\$?)"/y, () => createTextFrame("\"", { spansLines: true, escapes: false, doubled: true }));

export const CSharpLanguage = Object.freeze({
  diffDriver: "csharp",
  extensions: [".cs", ".csx"],
  testFileNames: [/Tests?\.[a-z]+$/],
  testNameAffixes: { openings: [], endings: ["Tests", "Test"] },
  commentForms: C_FAMILY,
  stringForm: createForm(C_COMMENTS, [rawCSharpString, verbatimCSharpString, createShortQuote("\""), createShortQuote("'")]),
  trailingDotContinues: true,
});
