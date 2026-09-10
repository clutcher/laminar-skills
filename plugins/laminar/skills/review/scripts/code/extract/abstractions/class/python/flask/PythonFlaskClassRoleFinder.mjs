import { GenericClassRoleFinder } from "../../generic/GenericClassRoleFinder.mjs";

export class PythonFlaskClassRoleFinder extends GenericClassRoleFinder {
  language = "python";
  framework = "flask";
  typeMapping = /^\s*@[A-Za-z_]\w*\.route\s*\(/;
}
