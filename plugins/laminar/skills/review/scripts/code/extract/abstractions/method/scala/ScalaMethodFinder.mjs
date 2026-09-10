import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class ScalaMethodFinder extends GenericMethodFinder {
  language = "scala";
  returnTypePlace = "colon";
  parameterNameBeforeType = true;
}
