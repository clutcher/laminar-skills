import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class CppMethodFinder extends GenericMethodFinder {
  language = "cpp";
  returnTypePlace = "before";
}
