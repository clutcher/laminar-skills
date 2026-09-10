import { createBlockForm, createForms } from "../../forms/CommentForms.mjs";

export const MarkdownLanguage = Object.freeze({
  diffDriver: "markdown",
  extensions: [".md"],
  holdsProse: true,
  commentForms: createForms([], [createBlockForm("<!--", "-->")]),
});
