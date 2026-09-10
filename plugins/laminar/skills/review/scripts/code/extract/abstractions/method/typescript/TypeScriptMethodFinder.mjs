import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class TypeScriptMethodFinder extends GenericMethodFinder {
  language = "javascript";
  returnTypePlace = "colon";
  parameterNameBeforeType = true;
}
