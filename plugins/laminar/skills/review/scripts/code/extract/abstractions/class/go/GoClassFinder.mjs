import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

export class GoClassFinder extends GenericClassFinder {
  language = "golang";

  isPrivate(headLine, name) {
    return /^[a-z_]/.test(String(name));
  }
}
