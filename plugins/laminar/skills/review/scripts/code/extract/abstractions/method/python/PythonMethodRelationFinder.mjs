import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class PythonMethodRelationFinder extends GenericMethodRelationFinder {
  language = "python";
  wordsNeverACallee = ["from"];
  hasRuntimeGlobals = true;
  assignmentDeclaresALocal = true;
}
