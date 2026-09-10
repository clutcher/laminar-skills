import { buildNamedDeclarationForm, KOTLIN_OBJECT_VAL } from "../generic/values/NamedDeclarationForms.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class ScalaVariableFinder extends GenericVariableFinder {
  language = "scala";
  valueForms = {
    constants: [buildNamedDeclarationForm("\\bcase\\s+object\\s+NAME\\b"), buildNamedDeclarationForm("\\bfinal\\s+val\\s+NAME\\b")],
    enclosingTypeForms: [{ head: /\bobject\b/, member: KOTLIN_OBJECT_VAL }, { head: /\benum\b/, member: buildNamedDeclarationForm("^\\s*case\\s+(?:[\\w\\s,]*,\\s*)?NAME\\b") }],
  };
  typeOrder = "colon";
  declaredOnlyWithAWordOrAType = true;
}
