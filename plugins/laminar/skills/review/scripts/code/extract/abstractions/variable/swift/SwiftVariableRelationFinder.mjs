import { GenericVariableRelationFinder } from "../generic/GenericVariableRelationFinder.mjs";

export class SwiftVariableRelationFinder extends GenericVariableRelationFinder {
  language = "swift";
  readsImplicitMembers = true;
}
