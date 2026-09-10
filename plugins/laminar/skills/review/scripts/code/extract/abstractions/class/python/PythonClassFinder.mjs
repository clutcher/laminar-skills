import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

export class PythonClassFinder extends GenericClassFinder {
  language = "python";

  isPrivate(headLine, name) {
    return String(name).startsWith("_");
  }
}
