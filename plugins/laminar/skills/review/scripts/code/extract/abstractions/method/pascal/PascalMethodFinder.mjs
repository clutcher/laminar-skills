import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class PascalMethodFinder extends GenericMethodFinder {
  language = "pascal";
  returnTypePlace = "colon";
  parameterNameBeforeType = true;
}
