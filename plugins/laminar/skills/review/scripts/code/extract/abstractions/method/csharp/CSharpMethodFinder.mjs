import { GenericMethodFinder } from "../generic/GenericMethodFinder.mjs";

export class CSharpMethodFinder extends GenericMethodFinder {
  language = "csharp";
  returnTypePlace = "before";
}
