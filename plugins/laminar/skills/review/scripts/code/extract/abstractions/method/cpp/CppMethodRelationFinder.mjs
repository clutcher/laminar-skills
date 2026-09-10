import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class CppMethodRelationFinder extends GenericMethodRelationFinder {
  language = "cpp";
  receiverSeparators = ["->", "::"];
  methodHeads = "typed";
  callsOwnMembersBare = true;
  cStyleCasts = true;
}
