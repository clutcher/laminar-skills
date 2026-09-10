import { HASH_ONLY } from "../../forms/CommentForms.mjs";

export const BashLanguage = Object.freeze({
  diffDriver: "bash",
  extensions: [".sh", ".bash", ".zsh", ".ksh"],
  commentForms: HASH_ONLY,
  singleQuotedStrings: true,
});
