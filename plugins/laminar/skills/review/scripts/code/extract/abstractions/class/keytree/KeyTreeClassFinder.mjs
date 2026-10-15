import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { isAnIndexSegment, KEY_TREE_FAMILY } from "../../../../inputs/source/keys/KeyPaths.mjs";
import { GenericClassFinder } from "../generic/GenericClassFinder.mjs";

export class KeyTreeClassFinder extends GenericClassFinder {
  family = KEY_TREE_FAMILY;

  findDeclaration(key) {
    if (!key || !key.holdsChildren || isAnIndexSegment(key.name)) return null;
    return { scale: Scale.CLASS.name, name: key.name, scope: key.isAtTheRoot ? null : key.parent.path, displayName: key.path };
  }
}
