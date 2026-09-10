import { buildNamedDeclarationForm } from "../generic/values/NamedDeclarationForms.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class GoVariableFinder extends GenericVariableFinder {
  language = "golang";
  valueForms = {
    constants: [buildNamedDeclarationForm("^\\s*const\\s+NAME\\b"), buildNamedDeclarationForm("^var\\s+NAME\\b[^=]*=(?!=)")],
    enclosingTypeForms: [{ head: /^\s*const$/, member: buildNamedDeclarationForm("^\\s*NAME\\b(?:\\s+[\\w.*[\\]]+)?\\s*(?:=(?!=)|$)") }],
  };
  typeOrder = "nameThenType";
  typeAfterTheName = "\\*?(?:\\[\\]|map\\[[^\\]]*\\])?\\*?[A-Za-z_][\\w.]*";
  forEachForm = /^\s*for\s+(?:([A-Za-z_]\w*)\s*,\s*)?([A-Za-z_]\w*)\s*:?=\s*range\s+(.+?)\s*\{?\s*$/;
  forEachNamesAKeyFirst = true;
  declaredOnlyWithAWordOrAType = true;
  capitalCallIsAFunction = true;
  callMayOpenABlock = true;
  initializerForms = [
    [/^&?((?:\[\]|map\[[^\]]*\])[*\w.]+|[A-Za-z_][\w.]*)(?:\[[^\]]*\])?\s*\{/, found => found[1]],
    [/^(?:make|new)\(\s*((?:\[\]|map\[[^\]]*\])?[*\w.]+)(?:\[[^\]]*\])?\s*[,)]/, found => found[1]],
  ];
}
