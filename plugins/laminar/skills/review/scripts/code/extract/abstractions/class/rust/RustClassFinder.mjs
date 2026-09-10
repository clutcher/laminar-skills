import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

export class RustClassFinder extends GenericClassFinder {
  language = "rust";
  packageHead = /^\s*(?:pub(?:\([^)]*\))?\s+)?mod\b/;
}
