import { createForms, SLASH_STAR } from "../../forms/CommentForms.mjs";
import { createHeredocFrame, createMatchedOpener, createShortQuote } from "../../forms/StringForms.mjs";
import { C_COMMENTS, createForm } from "../../forms/LexicalForms.mjs";
import { escapeForAPattern } from "../../text/PatternText.mjs";

const phpHeredoc = createMatchedOpener(/<<<[ \t]*(['"]?)([A-Za-z_]\w*)\1/y, found => createHeredocFrame(new RegExp(`^\\s*${escapeForAPattern(found[2])}(?![\\w$])`)));

export const PhpLanguage = Object.freeze({
  diffDriver: "php",
  extensions: [".php", ".phtml"],
  testFileNames: [/Tests?\.[a-z]+$/],
  commentForms: createForms(["//", "#"], [SLASH_STAR]),
  stringForm: createForm({ lineComments: ["//", "#"], blockComment: C_COMMENTS.blockComment }, [phpHeredoc, createShortQuote("\""), createShortQuote("'")]),
  singleQuotedStrings: true,
  hashBracketIsNoComment: true,
});
