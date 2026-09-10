import { createForms } from "../../forms/CommentForms.mjs";

export const TexLanguage = Object.freeze({
  diffDriver: "tex",
  extensions: [".tex"],
  holdsProse: true,
  commentForms: createForms(["%"]),
});
