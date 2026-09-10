import { buildNamedDeclarationForm } from "../generic/values/NamedDeclarationForms.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class SwiftVariableFinder extends GenericVariableFinder {
  language = "swift";
  valueForms = {
    constants: [buildNamedDeclarationForm("\\bstatic\\s+let\\s+NAME\\b"), buildNamedDeclarationForm("^(?:(?:public|internal|private|fileprivate)\\s+)?let\\s+NAME\\b")],
    enclosingTypeForms: [{ head: /\benum\b/, member: buildNamedDeclarationForm("^\\s*(?:indirect\\s+)?case\\s+(?:[A-Za-z_]\\w*(?:\\([^)]*\\))?(?:\\s*=\\s*[^,]+)?\\s*,\\s*)*NAME\\b") }],
  };
  typeOrder = "colon";
  declaredOnlyWithAWordOrAType = true;
}
