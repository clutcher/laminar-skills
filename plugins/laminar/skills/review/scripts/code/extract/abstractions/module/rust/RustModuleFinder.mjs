import { GenericModuleFinder } from "../generic/GenericModuleFinder.mjs";

const PUB_WORD_PATTERN = /(^|[^\w$])pub([^\w$]|$)/;

export class RustModuleFinder extends GenericModuleFinder {
  language = "rust";
  rootForm = "the nearest folder that holds a crate root or a module file";
  rootFileNames = ["lib.rs", "main.rs", "mod.rs"];

  isExposed(head) {
    return PUB_WORD_PATTERN.test(head);
  }
}
