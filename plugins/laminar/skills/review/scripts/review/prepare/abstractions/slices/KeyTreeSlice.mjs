import { findDriver, Scale } from "../../../../code/index.mjs";
import { numberLines } from "../../formats/SliceFormat.mjs";

const NO_KEY_TREE_SECTIONS = null;

const numberTheKeyLines = (keyLines, lines) => keyLines.flatMap(line => numberLines([lines[line - 1] ?? ""], line));

const readLeafNames = abstraction => (abstraction.fields ? abstraction.fields.map(field => field.name) : [abstraction.name]);

function readSectionsOfAKeyWithChildren(tree, abstraction, lines) {
  const key = tree.findKey(abstraction.displayName);
  return key ? { ownLines: numberTheKeyLines(key.listLines(), lines) } : NO_KEY_TREE_SECTIONS;
}

function readSectionsOfTheLeaves(tree, abstraction, lines) {
  const parentKey = tree.findKey(abstraction.enclosingTypeName) || tree.root;
  const leafKeys = readLeafNames(abstraction).map(name => parentKey.findChild(name)).filter(Boolean);
  if (!leafKeys.length) return NO_KEY_TREE_SECTIONS;
  const ownLines = new Set(leafKeys.flatMap(leafKey => leafKey.listLines()));
  const parentLines = parentKey === tree.root ? [] : parentKey.listLines().filter(line => !ownLines.has(line));
  return {
    ownLines: numberTheKeyLines([...ownLines].sort((left, right) => left - right), lines),
    typeHeads: numberTheKeyLines(parentLines, lines),
  };
}

export function readKeyTreeSections(abstraction, lines) {
  const tree = findDriver(abstraction.path).readKeyTree(lines);
  if (abstraction.scale === Scale.CLASS.name) return readSectionsOfAKeyWithChildren(tree, abstraction, lines);
  if (abstraction.scale === Scale.VARIABLE.name) return readSectionsOfTheLeaves(tree, abstraction, lines);
  return NO_KEY_TREE_SECTIONS;
}
