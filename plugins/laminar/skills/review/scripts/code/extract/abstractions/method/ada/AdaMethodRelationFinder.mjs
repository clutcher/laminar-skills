import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class AdaMethodRelationFinder extends GenericMethodRelationFinder {
  language = "ada";
  callsWithoutParentheses = true;
}
