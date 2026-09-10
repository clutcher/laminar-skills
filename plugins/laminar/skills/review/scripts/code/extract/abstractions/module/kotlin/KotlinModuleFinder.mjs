import { GenericModuleFinder } from "../generic/GenericModuleFinder.mjs";

const HIDDEN_KOTLIN_WORD_PATTERN = /(^|[^\w$])(private|internal|protected)([^\w$]|$)/;

export class KotlinModuleFinder extends GenericModuleFinder {
  language = "kotlin";
  packageLine = /^\s*package\s+([A-Za-z_][\w.]*)\s*;?\s*$/;
  importLine = /^\s*import\s+(?:static\s+)?([A-Za-z_][\w.]*)\s*;?\s*$/;

  isExposed(head) {
    return !HIDDEN_KOTLIN_WORD_PATTERN.test(head);
  }
}
