import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";

const FASTAPI_MAPPING_PATTERN = /^\s*@[A-Za-z_]\w*\.(get|post|put|delete|patch)\s*\(/;

export class PythonFastapiMethodRoleFinder extends GenericMethodRoleFinder {
  language = "python";
  framework = "fastapi";
  dependencyLinePatterns = [/^fastapi\b/i];
  frameworkMarkPatterns = [/^\s*(?:from|import)\s+fastapi\b/];
  methodMapping = FASTAPI_MAPPING_PATTERN;

  readVerb(text) {
    return ((FASTAPI_MAPPING_PATTERN.exec(text) || [])[1] || "").toUpperCase();
  }
}
