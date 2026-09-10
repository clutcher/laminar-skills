import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class PhpMethodFinder extends GenericMethodFinder {
  language = "php";
  returnTypePlace = "colon";
}
