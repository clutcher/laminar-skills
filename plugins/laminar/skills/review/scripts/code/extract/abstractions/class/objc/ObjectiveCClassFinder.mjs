import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

export class ObjectiveCClassFinder extends GenericClassFinder {
  language = "objc";
  scopeIsFlat = true;
}
