import { hasAPrivateWord } from "../generic/visibility/PrivateWord.mjs";
import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

export class CSharpClassFinder extends GenericClassFinder {
  language = "csharp";
  packageHead = /^\s*namespace\b/;

  isPrivate(headLine) {
    return hasAPrivateWord(headLine);
  }
}
