import { buildNamedDeclarationForm } from "../generic/values/NamedDeclarationForms.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class RustVariableFinder extends GenericVariableFinder {
  language = "rust";
  valueForms = {
    constants: [buildNamedDeclarationForm("^\\s*(?:pub(?:\\([^)]*\\))?\\s+)?(?:const|static)\\s+(?:mut\\s+)?NAME\\s*:")],
    enclosingTypeForms: [{ head: /\benum\b/, member: buildNamedDeclarationForm("^\\s*(?:#\\[[^\\]]*\\]\\s*)*NAME\\s*(?:[({,}]|=(?!=)|$)") }],
  };
  typeOrder = "colon";
  declaredOnlyWithAWordOrAType = true;
}
