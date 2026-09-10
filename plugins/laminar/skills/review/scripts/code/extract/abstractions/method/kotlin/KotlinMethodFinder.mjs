import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class KotlinMethodFinder extends GenericMethodFinder {
  language = "kotlin";
  returnTypePlace = "colon";
  parameterNameBeforeType = true;
}
