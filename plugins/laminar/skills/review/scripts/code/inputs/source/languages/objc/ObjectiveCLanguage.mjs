import { C_FAMILY } from "../../forms/CommentForms.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";

const OBJC_METHOD_PATTERN = /^[-+]\s*\([^)]*\)\s*([A-Za-z_][A-Za-z0-9_]*)/;

const findObjectiveCMethod = head => {
  const objectiveCMethod = OBJC_METHOD_PATTERN.exec(head);
  return objectiveCMethod ? { scale: Scale.METHOD.name, name: objectiveCMethod[1], scope: null } : null;
};

export const ObjectiveCLanguage = Object.freeze({
  diffDriver: "objc",
  extensions: [".m", ".mm"],
  testFileNames: [/Tests?\.[a-z]+$/],
  commentForms: C_FAMILY,
  readDeclaration: findObjectiveCMethod,
});
