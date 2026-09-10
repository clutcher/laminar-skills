import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class KotlinMethodRelationFinder extends GenericMethodRelationFinder {
  language = "kotlin";
  trailingBlockCalls = true;
  callsOwnMembersBare = true;
  typesInFolderAreInScope = true;
}
