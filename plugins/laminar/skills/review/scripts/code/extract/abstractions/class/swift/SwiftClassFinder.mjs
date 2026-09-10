import { hasAPrivateWord } from "../generic/visibility/PrivateWord.mjs";
import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

export class SwiftClassFinder extends GenericClassFinder {
  language = "swift";

  isPrivate(headLine) {
    return hasAPrivateWord(headLine);
  }
}
