import { hasAPrivateWord } from "../generic/visibility/PrivateWord.mjs";
import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

export class KotlinClassFinder extends GenericClassFinder {
  language = "kotlin";

  isPrivate(headLine) {
    return hasAPrivateWord(headLine);
  }
}
