import { buildNamedDeclarationForm } from "../generic/values/NamedDeclarationForms.mjs";
import { readCodeOfLine } from "../../../../inputs/source/SourceText.mjs";
import { buildFieldNameReader } from "../generic/fields/FieldForms.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

const PYTHON_ATTRIBUTE_PATTERN = /^\s*([A-Za-z_]\w*)\s*(?::\s*[^=\s][^=]*?)?\s*=(?!=)/;
const PYTHON_ANNOTATED_ATTRIBUTE_PATTERN = /^\s*([A-Za-z_]\w*)\s*:\s*[^=\s][^=]*$/;
const PYTHON_SELF_ATTRIBUTE_PATTERN = /^\s*self\.([A-Za-z_]\w*)\s*(?::\s*[^=]+?)?\s*=(?!=)/;

const findSelfAttributesIn = bodyLines => bodyLines
  .map(({ line, text }) => ({ name: (PYTHON_SELF_ATTRIBUTE_PATTERN.exec(readCodeOfLine(text)) || [])[1], line, text }))
  .filter(field => field.name);

const nameOfPythonAttribute = buildFieldNameReader(PYTHON_ATTRIBUTE_PATTERN);

const nameOfPythonAnnotatedAttribute = buildFieldNameReader(PYTHON_ANNOTATED_ATTRIBUTE_PATTERN);

export class PythonVariableFinder extends GenericVariableFinder {
  language = "python";
  constructorFieldForm = { name: "__init__", findFields: ({ bodyLines }) => findSelfAttributesIn(bodyLines) };
  headByIndent = true;
  valueForms = {
    constants: [buildNamedDeclarationForm("^NAME\\s*:\\s*Final\\b")],
    enclosingTypeForms: [{ head: /^class\b.*\b(?:Enum|IntEnum|StrEnum|Flag|IntFlag)\b/, member: buildNamedDeclarationForm("^\\s*NAME\\s*(?::[^=]*)?=(?!=)") }],
  };
  typeOrder = "colon";
  literalTypes = { map: "dict", list: "list", text: "str" };
  forEachForm = /^\s*(?:async\s+)?for\s+(?:([A-Za-z_]\w*)\s*,\s*)?([A-Za-z_]\w*)\s+in\s+(.+?)\s*:\s*$/;

  findFieldNameIn(text) {
    return nameOfPythonAttribute(text) || nameOfPythonAnnotatedAttribute(text);
  }
}
