import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class SwiftMethodFinder extends GenericMethodFinder {
  language = "swift";
  returnTypePlace = "arrow";
  parameterNameBeforeType = true;
}
