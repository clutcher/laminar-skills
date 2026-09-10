import { buildNamedDeclarationForm, LIST_ENUM_MEMBER } from "../generic/values/NamedDeclarationForms.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class CppVariableFinder extends GenericVariableFinder {
  language = "cpp";
  valueForms = {
    constants: [buildNamedDeclarationForm("^\\s*#\\s*define\\s+NAME\\b"), buildNamedDeclarationForm("\\bconstexpr\\b[^=;(]*?(?<![\\w$])NAME\\s*[={]")],
    enclosingTypeForms: [{ head: /\benum\b/, member: LIST_ENUM_MEMBER }],
  };
  typeOrder = "before";
  declaredOnlyWithAWordOrAType = true;
}
