import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class RustMethodFinder extends GenericMethodFinder {
  language = "rust";
  returnTypePlace = "arrow";
  parameterNameBeforeType = true;
}
