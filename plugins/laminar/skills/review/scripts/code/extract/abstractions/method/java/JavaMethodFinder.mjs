import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class JavaMethodFinder extends GenericMethodFinder {
  language = "java";
  returnTypePlace = "before";
}
