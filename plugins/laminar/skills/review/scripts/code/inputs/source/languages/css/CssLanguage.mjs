import { createForms, SLASH_STAR } from "../../forms/CommentForms.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";

const [CLASS, METHOD] = [Scale.CLASS.name, Scale.METHOD.name];

const CSS_CALLABLE_PATTERN = /^@(mixin|function)\s+([A-Za-z_-][\w-]*)/;

function readCssDeclaration(head) {
  const callable = CSS_CALLABLE_PATTERN.exec(head);
  return callable ? { scale: METHOD, name: callable[2], scope: null } : { scale: CLASS, name: head.slice(0, 60), scope: null };
}

export const CssLanguage = Object.freeze({
  diffDriver: "css",
  holdsPresentationOnly: true,
  extensions: [".css", ".scss", ".less"],
  commentForms: createForms(["//"], [SLASH_STAR]),
  readDeclaration: readCssDeclaration,
});
