import { readFieldHeadsIn } from "../generic/fields/FieldHeads.mjs";
import { buildNamedDeclarationForm, JAVA_LIKE_ENUM_MEMBER } from "../generic/values/NamedDeclarationForms.mjs";
import { buildFieldNameReader, WORDS_NEVER_A_FIELD_TYPE_PATTERN_SOURCE } from "../generic/fields/FieldForms.mjs";
import { readParameterName } from "../../method/generic/signatures/ParameterLists.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

const JAVA_FIELD_PATTERN = new RegExp(`^\\s*(?:@[\\w.]+(?:\\([^()]*\\))?\\s+)*(?:(?:public|protected|private|static|final|transient|volatile)\\s+)*(?!(?:${WORDS_NEVER_A_FIELD_TYPE_PATTERN_SOURCE})\\b)[A-Za-z_$][\\w$.]*(?:<.*>)?(?:\\[\\])*\\s+([A-Za-z_$][\\w$]*)\\s*(?:;|=(?!=).*)\\s*$`);

const nameOfJavaField = buildFieldNameReader(JAVA_FIELD_PATTERN);

export class JavaVariableFinder extends GenericVariableFinder {
  language = "java";
  componentForm = { head: /\brecord\s/, readName: readParameterName };
  valueForms = {
    constants: [buildNamedDeclarationForm("\\bstatic\\s+final\\b[^=;(]*?(?<![\\w$])NAME\\s*=(?!=)")],
    enclosingTypeForms: [{ head: /\benum\b/, member: JAVA_LIKE_ENUM_MEMBER }],
  };
  typeOrder = "before";
  declaredOnlyWithAWordOrAType = true;

  findFieldNameIn(text) {
    return nameOfJavaField(text);
  }

  findIn(parent, source) {
    return readFieldHeadsIn(parent, source, text => this.findFieldNameIn(text));
  }
}
