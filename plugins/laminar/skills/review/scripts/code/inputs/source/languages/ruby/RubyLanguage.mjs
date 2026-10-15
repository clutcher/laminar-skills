import { BODY_ENDS } from "../../forms/BodyEnds.mjs";
import { createBlockForm, createForms } from "../../forms/CommentForms.mjs";
import { createHeredocFrame, createMatchedOpener, createShortQuote } from "../../forms/StringForms.mjs";
import { createForm, HASH_COMMENTS } from "../../forms/LexicalForms.mjs";
import { escapeForAPattern } from "../../text/PatternText.mjs";

const rubyIndentedHeredoc = createMatchedOpener(/<<[~-](['"`]?)([A-Za-z_]\w*)\1/y, found => createHeredocFrame(new RegExp(`^\\s*${escapeForAPattern(found[2])}\\s*$`)));
const rubyHeredoc = createMatchedOpener(/<<(['"`]?)([A-Z_][A-Z0-9_]*)\1(?![\w$])/y, found => createHeredocFrame(new RegExp(`^${escapeForAPattern(found[2])}\\s*$`)));

export const RubyLanguage = Object.freeze({
  diffDriver: "ruby",
  extensions: [".rb", ".rake", ".gemspec", ".ru"],
  testFileNames: [/_test\.rb$/, /_spec\.rb$/],
  commentForms: createForms(["#"], [createBlockForm("=begin", "=end")]),
  stringForm: createForm(HASH_COMMENTS, [rubyIndentedHeredoc, rubyHeredoc, createShortQuote("\""), createShortQuote("'")]),
  singleQuotedStrings: true,
  bodyEnd: BODY_ENDS.INDENT,
});
