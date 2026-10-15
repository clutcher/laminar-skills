import { LanguageDriver, NO_DECLARATION } from "../LanguageDriver.mjs";
import { findLanguage } from "../../Languages.mjs";
import { KeyTree } from "../../keys/KeyTree.mjs";
import { CLASS_FINDER_REGISTRY } from "../../../../extract/abstractions/class/index.mjs";
import { VARIABLE_FINDER_REGISTRY } from "../../../../extract/abstractions/variable/index.mjs";
import { FinderContext } from "../../../../extract/finders/FinderContext.mjs";

export class KeyTreeDriver extends LanguageDriver {
  get commentForms() {
    return findLanguage(this.diffDriver).commentForms;
  }

  get holdsKeyTrees() {
    return true;
  }

  readKeyTree(lines) {
    return KeyTree.createFromKeyLines(findLanguage(this.diffDriver).readKeyLines(lines));
  }

  readDeclarationOfKey(key) {
    for (const finder of this.listFindersOfTheKeys()) {
      const declaration = finder.findDeclaration(key);
      if (declaration) return declaration;
    }
    return NO_DECLARATION;
  }

  listFindersOfTheKeys() {
    const context = FinderContext.createForLanguage(this.diffDriver);
    return [CLASS_FINDER_REGISTRY, VARIABLE_FINDER_REGISTRY].map(registry => registry.findFinder(context)).filter(Boolean);
  }

  findTypeDisplayName(headText) {
    return String(headText || "").trim() || null;
  }
}
