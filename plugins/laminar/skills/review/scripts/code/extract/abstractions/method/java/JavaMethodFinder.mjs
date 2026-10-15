import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class JavaMethodFinder extends GenericMethodFinder {
  language = "java";
  returnTypePlace = "before";
  wordsBeforeAWrappedResultType = new Set(["public", "protected", "private", "static", "final", "abstract", "synchronized", "native", "default", "strictfp"]);
}
