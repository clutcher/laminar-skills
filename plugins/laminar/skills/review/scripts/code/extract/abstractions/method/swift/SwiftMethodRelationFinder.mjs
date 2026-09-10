import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class SwiftMethodRelationFinder extends GenericMethodRelationFinder {
  language = "swift";
  trailingBlockCalls = true;
  callsOwnMembersBare = true;
  typesInFolderAreInScope = true;
}
