import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";

export class PythonFlaskMethodRoleFinder extends GenericMethodRoleFinder {
  language = "python";
  framework = "flask";
  dependencyLinePatterns = [/^flask\b/i];
  frameworkMarkPatterns = [/^\s*(?:from|import)\s+flask\b/];
  methodMapping = /^\s*@[A-Za-z_]\w*\.route\s*\(/;
}
