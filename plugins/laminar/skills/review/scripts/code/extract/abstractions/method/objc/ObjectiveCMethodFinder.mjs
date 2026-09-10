import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class ObjectiveCMethodFinder extends GenericMethodFinder {
  language = "objc";
  returnTypePlace = "before";
}
