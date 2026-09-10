import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class PythonMethodFinder extends GenericMethodFinder {
  language = "python";
  returnTypePlace = "arrow";
  parameterNameBeforeType = true;
}
