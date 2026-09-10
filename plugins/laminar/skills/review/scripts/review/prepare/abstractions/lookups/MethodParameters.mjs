import { NO_PARAMETER_TEXT, findParameterTextAfterTheName } from "../../../../code/index.mjs";

const CONSTRUCTOR_NAMES = new Set(["constructor", "__init__", "init", "new", "initialize"]);

const RECEIVER_PARAMETERS = new Set(["self", "cls", "this", "&self", "&mut", "mut"]);

export const isAConstructor = method => method.name === method.enclosingTypeName || CONSTRUCTOR_NAMES.has(method.name);

const readLeadingWordsOfTheParameters = parameters => parameters.split(",").map(parameterText => parameterText.trim().split(/[:\s=]/)[0]);

const takesAValueIn = (head, name) => {
  const parameters = findParameterTextAfterTheName(head, name);
  if (parameters === NO_PARAMETER_TEXT) return true;
  return readLeadingWordsOfTheParameters(parameters).some(word => word && !RECEIVER_PARAMETERS.has(word));
};

export class MethodParameters {
  constructor(methodText) {
    this.methodText = methodText;
  }

  canReceiveAValue(method) {
    return !isAConstructor(method) && takesAValueIn(this.methodText.readTheHeadOf(method), method.name);
  }
}
