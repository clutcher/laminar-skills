import { buildNamedDeclarationForm, JAVA_LIKE_ENUM_MEMBER } from "../generic/values/NamedDeclarationForms.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class DartVariableFinder extends GenericVariableFinder {
  language = "dart";
  valueForms = {
    constants: [buildNamedDeclarationForm("\\bstatic\\s+const\\b[^=;(]*?(?<![\\w$])NAME\\s*=(?!=)"), buildNamedDeclarationForm("^const\\s+(?:[\\w<>?]+\\s+)?NAME\\s*=(?!=)")],
    enclosingTypeForms: [{ head: /\benum\b/, member: JAVA_LIKE_ENUM_MEMBER }],
  };
  typeOrder = "before";
  declaredOnlyWithAWordOrAType = true;
}
