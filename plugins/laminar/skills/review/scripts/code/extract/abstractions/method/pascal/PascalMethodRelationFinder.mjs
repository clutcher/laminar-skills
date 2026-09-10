import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class PascalMethodRelationFinder extends GenericMethodRelationFinder {
  language = "pascal";
  callsWithoutParentheses = true;
}
