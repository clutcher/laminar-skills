import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class TypeScriptMethodRelationFinder extends GenericMethodRelationFinder {
  language = "javascript";
  privateNamePrefix = "#?";
  methodHeads = "script";
  hasRuntimeGlobals = true;
}
