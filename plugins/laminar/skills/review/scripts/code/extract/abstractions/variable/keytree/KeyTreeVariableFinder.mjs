import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { KEY_TREE_FAMILY } from "../../../../inputs/source/keys/KeyPaths.mjs";
import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class KeyTreeVariableFinder extends GenericVariableFinder {
  family = KEY_TREE_FAMILY;

  findDeclaration(key) {
    if (!key || key.holdsChildren) return null;
    return { scale: Scale.VARIABLE.name, name: key.name, scope: key.isAtTheRoot ? null : key.parent.path };
  }
}
