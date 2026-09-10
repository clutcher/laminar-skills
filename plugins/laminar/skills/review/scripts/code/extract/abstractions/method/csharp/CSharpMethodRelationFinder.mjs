import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class CSharpMethodRelationFinder extends GenericMethodRelationFinder {
  language = "csharp";
  methodHeads = "typed";
  callsOwnMembersBare = true;
  cStyleCasts = true;
}
