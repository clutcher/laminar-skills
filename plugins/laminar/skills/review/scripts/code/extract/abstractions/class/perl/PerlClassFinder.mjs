import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

export class PerlClassFinder extends GenericClassFinder {
  language = "perl";
  scopeIsFlat = true;
}
