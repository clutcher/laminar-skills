import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class LuaMethodRelationFinder extends GenericMethodRelationFinder {
  language = "lua";
  receiverSeparators = [":"];
  hasRuntimeGlobals = true;
}
