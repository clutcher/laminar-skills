import { C_FAMILY } from "../../forms/CommentForms.mjs";
import { createDelimitedOpener, createMatchedOpener, MULTI_LINE, RAW_MULTI_LINE, createTextFrame } from "../../forms/StringForms.mjs";
import { C_COMMENTS, createForm } from "../../forms/LexicalForms.mjs";

const rawRustString = createMatchedOpener(/r(#*)"/y, found => createTextFrame(`"${found[1]}`, RAW_MULTI_LINE));
const rustCharacter = createMatchedOpener(/'(?:\\.|[^\\'])'/y, () => null);

export const RustLanguage = Object.freeze({
  diffDriver: "rust",
  extensions: [".rs"],
  commentForms: C_FAMILY,
  stringForm: createForm(C_COMMENTS, [rawRustString, createDelimitedOpener("\"", "\"", MULTI_LINE), rustCharacter]),
  trailingDotContinues: true,
  moduleSeparator: "::",
});
