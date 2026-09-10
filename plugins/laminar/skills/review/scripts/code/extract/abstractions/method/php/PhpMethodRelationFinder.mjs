import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class PhpMethodRelationFinder extends GenericMethodRelationFinder {
  language = "php";
  receiverSeparators = ["->", "::"];
  hasRuntimeGlobals = true;
}
