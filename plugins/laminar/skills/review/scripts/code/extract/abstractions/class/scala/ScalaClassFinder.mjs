import { hasAPrivateWord } from "../generic/visibility/PrivateWord.mjs";
import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

export class ScalaClassFinder extends GenericClassFinder {
  language = "scala";

  isPrivate(headLine) {
    return hasAPrivateWord(headLine);
  }
}
