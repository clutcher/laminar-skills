import { createBlockForm, createForms } from "../../forms/CommentForms.mjs";

export const HtmlLanguage = Object.freeze({
  diffDriver: "html",
  extensions: [".html", ".htm", ".xhtml"],
  holdsProse: true,
  commentForms: createForms([], [createBlockForm("<!--", "-->")]),
});
