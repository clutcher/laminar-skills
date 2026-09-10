import { FUNCTION_VALUE_PATTERN } from "../generic/values/ValueForms.mjs";
import { buildNamedDeclarationForm, LIST_ENUM_MEMBER } from "../generic/values/NamedDeclarationForms.mjs";
import { readCodeOfLine } from "../../../../inputs/source/SourceText.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

const SCRIPT_TYPED_PROPERTY_PATTERN = /^\s*(?:@\S+\s+)*(?:(?:public|private|protected|readonly|static|declare|override|abstract|accessor)\s+)*#?([A-Za-z_$][\w$]*)[?!]?\s*:\s*[^\s=;(){}][^=;]*?\s*(?:=(?![=>])(.*?))?;?\s*$/;
const SCRIPT_ASSIGNED_PROPERTY_PATTERN = /^\s*(?:@\S+\s+)*(?:(?:public|private|protected|readonly|static|declare|override|abstract|accessor)\s+)*#?([A-Za-z_$][\w$]*)[!]?\s*=(?![=>])(.*?);?\s*$/;
const SCRIPT_PARAMETER_PROPERTY_PATTERN = /^\s*(?:@\S+\s+)*(?:(?:public|private|protected|readonly|override)\s+)+([A-Za-z_$][\w$]*)\??\s*(?:[:=)]|$)/;
const PARAMETER_SEPARATOR_PATTERN = /[(),]/;

const findNameOfScriptProperty = text => {
  const found = SCRIPT_TYPED_PROPERTY_PATTERN.exec(text) || SCRIPT_ASSIGNED_PROPERTY_PATTERN.exec(text);
  return found && !FUNCTION_VALUE_PATTERN.test(found[2] || "") ? found[1] : null;
};

const findParameterPropertiesIn = headLines => headLines.flatMap(({ line, text }) => readCodeOfLine(text).split(PARAMETER_SEPARATOR_PATTERN)
  .map(piece => (SCRIPT_PARAMETER_PROPERTY_PATTERN.exec(piece) || [])[1])
  .filter(Boolean)
  .map(name => ({ name, line, text })));

export class TypeScriptVariableFinder extends GenericVariableFinder {
  language = "javascript";
  constructorFieldForm = { name: "constructor", findFields: ({ headLines }) => findParameterPropertiesIn(headLines) };
  valueForms = {
    constants: [
      buildNamedDeclarationForm("^(?:export\\s+)?(?:declare\\s+)?const\\s+NAME\\s*(?::[^=]*)?=(?!=)(?!\\s*(?:async\\s+)?(?:function\\b|\\([^)]*\\)\\s*(?::[^=]*)?=>|[A-Za-z_$][\\w$]*\\s*=>))"),
      buildNamedDeclarationForm("\\bstatic\\s+readonly\\s+NAME\\b"),
    ],
    enclosingTypeForms: [
      { head: /\benum\b/, member: LIST_ENUM_MEMBER },
      { head: /^(?:export\s+)?const\s+[A-Za-z_$][\w$]*\s*(?::[^=]*)?=/, member: buildNamedDeclarationForm("^\\s*NAME\\s*:") },
    ],
  };
  typeOrder = "colon";
  literalTypes = { map: "Object", list: "Array", text: "String", pattern: "RegExp" };
  forEachForm = /^\s*for\s*(?:await\s*)?\(\s*(?:const|let|var)\s+()([A-Za-z_$][\w$]*)\s+of\s+(.+?)\)\s*\{?\s*$/;
  declaredOnlyWithAWordOrAType = true;
  ownFieldAssignmentDeclares = true;

  findFieldNameIn(text) {
    return findNameOfScriptProperty(text);
  }
}
