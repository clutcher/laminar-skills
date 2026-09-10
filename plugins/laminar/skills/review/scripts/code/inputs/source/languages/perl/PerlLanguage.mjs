import { HASH_ONLY } from "../../forms/CommentForms.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { splitScopeAndName } from "../../names/QualifiedNames.mjs";

const PERL_PACKAGE_PATTERN = /^package\s+([A-Za-z_][\w:]*)/;

const findPackageDeclaration = head => {
  const declaredPackage = PERL_PACKAGE_PATTERN.exec(head);
  return declaredPackage ? { scale: Scale.CLASS.name, ...splitScopeAndName(declaredPackage[1].replace(/::/g, ".")) } : null;
};

export const PerlLanguage = Object.freeze({
  diffDriver: "perl",
  extensions: [".pl", ".pm"],
  commentForms: HASH_ONLY,
  readDeclaration: findPackageDeclaration,
  singleQuotedStrings: true,
});
