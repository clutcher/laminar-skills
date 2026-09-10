import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class ElixirMethodRelationFinder extends GenericMethodRelationFinder {
  language = "elixir";
  callsWithoutParentheses = true;
  doBlockCalls = true;
}
