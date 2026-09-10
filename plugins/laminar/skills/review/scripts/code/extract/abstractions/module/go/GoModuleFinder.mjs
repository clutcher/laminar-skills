import { GenericModuleFinder } from "../generic/GenericModuleFinder.mjs";

const CAPITAL_FIRST_PATTERN = /^[A-Z]/;

export class GoModuleFinder extends GenericModuleFinder {
  language = "golang";
  rootForm = "the folder that holds the package files";
  rootExtensions = [".go"];

  isExposed(head, name) {
    return CAPITAL_FIRST_PATTERN.test(String(name));
  }
}
