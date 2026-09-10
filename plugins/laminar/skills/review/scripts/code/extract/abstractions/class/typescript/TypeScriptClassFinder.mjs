import { hasAPrivateWord } from "../generic/visibility/PrivateWord.mjs";
import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

export class TypeScriptClassFinder extends GenericClassFinder {
  language = "javascript";

  isPrivate(headLine, name, indent) {
    return indent === 0 ? !/^\s*export\b/.test(String(headLine || "")) : hasAPrivateWord(headLine) || String(name).startsWith("#");
  }
}
