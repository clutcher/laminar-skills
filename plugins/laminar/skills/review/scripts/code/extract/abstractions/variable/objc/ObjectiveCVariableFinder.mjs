import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class ObjectiveCVariableFinder extends GenericVariableFinder {
  language = "objc";
  typeOrder = "before";
  declaredOnlyWithAWordOrAType = true;
}
