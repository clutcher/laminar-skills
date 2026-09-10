import { buildNamedDeclarationForm, LIST_ENUM_MEMBER } from "../generic/values/NamedDeclarationForms.mjs";
import { buildFieldNameReader, WORDS_NEVER_A_FIELD_TYPE_PATTERN_SOURCE } from "../generic/fields/FieldForms.mjs";
import { readParameterName } from "../../method/generic/signatures/ParameterLists.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

const CSHARP_FIELD_PATTERN = new RegExp(`^\\s*(?:\\[[^\\]]*\\]\\s*)*(?:(?:public|protected|private|internal|static|readonly|const|volatile|new|required|override|virtual|sealed|abstract)\\s+)*(?!(?:${WORDS_NEVER_A_FIELD_TYPE_PATTERN_SOURCE})\\b)[A-Za-z_][\\w.]*(?:<.*>)?(?:\\[\\])*\\??\\s+([A-Za-z_]\\w*)\\s*(?:;|=(?![=>]).*|\\{\\s*(?:(?:private|protected|internal)\\s+)?(?:get|set|init)\\b.*)\\s*$`);

const nameOfCsharpField = buildFieldNameReader(CSHARP_FIELD_PATTERN);

export class CSharpVariableFinder extends GenericVariableFinder {
  language = "csharp";
  componentForm = { head: /\brecord\b/, readName: readParameterName };
  valueForms = {
    constants: [buildNamedDeclarationForm("\\b(?:const|static\\s+readonly|readonly\\s+static)\\b[^=;(]*?(?<![\\w$])NAME\\s*=(?!=)")],
    enclosingTypeForms: [{ head: /\benum\b/, member: LIST_ENUM_MEMBER }],
  };
  typeOrder = "before";
  declaredOnlyWithAWordOrAType = true;

  findFieldNameIn(text) {
    return nameOfCsharpField(text);
  }
}
