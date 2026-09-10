import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class AdaMethodFinder extends GenericMethodFinder {
  language = "ada";
  parameterNameBeforeType = true;
}
