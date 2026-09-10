import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class ErlangMethodRelationFinder extends GenericMethodRelationFinder {
  language = "erlang";
  receiverSeparators = [":"];
}
