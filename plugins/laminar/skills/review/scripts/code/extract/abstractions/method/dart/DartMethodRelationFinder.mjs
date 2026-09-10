import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class DartMethodRelationFinder extends GenericMethodRelationFinder {
  language = "dart";
  methodHeads = "typed";
  callsOwnMembersBare = true;
}
