import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class SqlMethodRelationFinder extends GenericMethodRelationFinder {
  language = "sql";
  wordsNeverACallee = ["from"];
}
