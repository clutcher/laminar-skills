import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class ScalaMethodRelationFinder extends GenericMethodRelationFinder {
  language = "scala";
  callsWithoutParentheses = true;
  trailingBlockCalls = true;
  callsOwnMembersBare = true;
  typesInFolderAreInScope = true;
}
