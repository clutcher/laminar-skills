import { GenericModuleFinder } from "../generic/GenericModuleFinder.mjs";

const PUBLIC_WORD_PATTERN = /(^|[^\w$])public([^\w$]|$)/;

export class CSharpModuleFinder extends GenericModuleFinder {
  language = "csharp";
  rootForm = "the nearest folder that holds a project file";
  rootExtensions = [".csproj"];

  isExposed(head) {
    return PUBLIC_WORD_PATTERN.test(head);
  }
}
