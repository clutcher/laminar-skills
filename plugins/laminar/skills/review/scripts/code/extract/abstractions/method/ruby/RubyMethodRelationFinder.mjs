import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class RubyMethodRelationFinder extends GenericMethodRelationFinder {
  language = "ruby";
  receiverSeparators = ["::"];
  callsWithoutParentheses = true;
  trailingBlockCalls = true;
  doBlockCalls = true;
  callsOwnMembersBare = true;
  hasRuntimeGlobals = true;
  assignmentDeclaresALocal = true;
}
