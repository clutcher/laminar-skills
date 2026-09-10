import { createForms } from "../../forms/CommentForms.mjs";

export const BibtexLanguage = Object.freeze({
  diffDriver: "bibtex",
  extensions: [".bib"],
  holdsProse: true,
  commentForms: createForms(["%"]),
});
