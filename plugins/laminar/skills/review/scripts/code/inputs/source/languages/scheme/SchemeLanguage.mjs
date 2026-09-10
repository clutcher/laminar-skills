import { BODY_ENDS } from "../../forms/BodyEnds.mjs";
import { createBlockForm, createForms } from "../../forms/CommentForms.mjs";
import { NO_DECLARATION } from "../../drivers/LanguageDriver.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";

const [CLASS, METHOD, VARIABLE] = [Scale.CLASS.name, Scale.METHOD.name, Scale.VARIABLE.name];

const SCHEME_HEAD_PATTERN = /^\((define(?:-[a-z-]+)?)\s+(\(?)\s*([^\s()]+)/;

function readSchemeDeclaration(head) {
  const found = SCHEME_HEAD_PATTERN.exec(head);
  if (!found) return NO_DECLARATION;
  if (found[1] === "define-record-type") return { scale: CLASS, name: found[3], scope: null };
  if (found[1] === "define-syntax" || found[2] === "(") return { scale: METHOD, name: found[3], scope: null };
  return { scale: VARIABLE, name: found[3], scope: null };
}

export const SchemeLanguage = Object.freeze({
  diffDriver: "scheme",
  extensions: [".scm"],
  commentForms: createForms([";"], [createBlockForm("#|", "|#")]),
  readDeclaration: readSchemeDeclaration,
  bodyEnd: BODY_ENDS.CLOSING_MARK,
});
