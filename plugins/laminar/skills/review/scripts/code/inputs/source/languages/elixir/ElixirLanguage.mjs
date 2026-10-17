import { BODY_ENDS } from "../../forms/BodyEnds.mjs";
import { HASH_ONLY } from "../../forms/CommentForms.mjs";

export const ElixirLanguage = Object.freeze({
  diffDriver: "elixir",
  extensions: [".ex", ".exs"],
  testFileNames: [/_test\.exs?$/],
  testNameAffixes: { openings: [], endings: ["_test"] },
  commentForms: HASH_ONLY,
  singleQuotedStrings: true,
  tripleQuotes: ['"""'],
  bodyEnd: BODY_ENDS.INDENT,
});
