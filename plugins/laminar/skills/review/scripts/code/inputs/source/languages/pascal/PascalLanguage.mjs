import { BODY_ENDS } from "../../forms/BodyEnds.mjs";
import { createBlockForm, createForms } from "../../forms/CommentForms.mjs";

const PASCAL_TYPE_PATTERN = /([A-Za-z_]\w*)\s*=\s*$/;

export const PascalLanguage = Object.freeze({
  diffDriver: "pascal",
  extensions: [".pas"],
  commentForms: createForms(["//"], [createBlockForm("(*", "*)"), createBlockForm("{", "}")]),
  findTypeNameBefore: prefix => (PASCAL_TYPE_PATTERN.exec(prefix) || [])[1] || null,
  singleQuotedStrings: true,
  bodyEnd: BODY_ENDS.CLOSING_MARK,
});
