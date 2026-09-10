import { hasAPrivateWord } from "../generic/visibility/PrivateWord.mjs";
import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

export class JavaClassFinder extends GenericClassFinder {
  language = "java";

  isPrivate(headLine) {
    return hasAPrivateWord(headLine);
  }
}
