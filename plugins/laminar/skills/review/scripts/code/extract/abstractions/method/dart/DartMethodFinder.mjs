import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class DartMethodFinder extends GenericMethodFinder {
  language = "dart";
  returnTypePlace = "before";
}
