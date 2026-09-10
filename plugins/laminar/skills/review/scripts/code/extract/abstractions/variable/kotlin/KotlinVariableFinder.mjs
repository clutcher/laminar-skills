import { readFieldHeadsIn } from "../generic/fields/FieldHeads.mjs";
import { buildNamedDeclarationForm, JAVA_LIKE_ENUM_MEMBER, KOTLIN_OBJECT_VAL } from "../generic/values/NamedDeclarationForms.mjs";
import { buildFieldNameReader } from "../generic/fields/FieldForms.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

const KOTLIN_PROPERTY_PATTERN = /^\s*(?:@\S+\s+)*(?:(?:private|protected|internal|public|override|open|final|abstract|lateinit|const)\s+)*(?:val|var)\s+([A-Za-z_]\w*)/;
const KOTLIN_PROPERTY_PARAMETER_PATTERN = /^\s*(?:@\S+\s+)*(?:(?:private|protected|internal|public|override|open|final)\s+)*(?:val|var)\s+([A-Za-z_]\w*)/;

const nameOfKotlinProperty = buildFieldNameReader(KOTLIN_PROPERTY_PATTERN);

export class KotlinVariableFinder extends GenericVariableFinder {
  language = "kotlin";
  componentForm = { head: /\bclass\s/, readName: parameterText => (KOTLIN_PROPERTY_PARAMETER_PATTERN.exec(parameterText) || [])[1] };
  valueForms = {
    constants: [
      buildNamedDeclarationForm("\\bconst\\s+val\\s+NAME\\b"),
      buildNamedDeclarationForm("^(?:(?:public|internal|private)\\s+)?val\\s+NAME\\s*(?::[^=]*)?=(?!=)"),
      buildNamedDeclarationForm("^\\s*(?:(?:data|public|internal|private)\\s+)*object\\s+NAME\\s*:"),
    ],
    enclosingTypeForms: [{ head: /\benum\s+class\b/, member: JAVA_LIKE_ENUM_MEMBER }, { head: /\bobject\b/, member: KOTLIN_OBJECT_VAL }],
  };
  typeOrder = "colon";
  declaredOnlyWithAWordOrAType = true;

  findFieldNameIn(text) {
    return nameOfKotlinProperty(text);
  }

  findIn(parent, source) {
    return readFieldHeadsIn(parent, source, text => this.findFieldNameIn(text));
  }
}
