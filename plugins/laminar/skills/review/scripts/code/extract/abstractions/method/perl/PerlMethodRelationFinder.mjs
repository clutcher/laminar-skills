import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class PerlMethodRelationFinder extends GenericMethodRelationFinder {
  language = "perl";
  receiverSeparators = ["->", "::"];
  callsWithoutParentheses = true;
  hasRuntimeGlobals = true;
}
