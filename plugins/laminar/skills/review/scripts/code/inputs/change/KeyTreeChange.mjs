import { Scale } from "../../graph/abstractions/Scale.mjs";
import { CHANGE_KINDS } from "./AbstractionChange.mjs";
import { readTextAfterTheChange, readTextBeforeTheChange } from "./TextAroundTheChange.mjs";

export const MAX_KEY_CLASSES_PER_FILE = 12;

const holdsTheSameNames = (left, right) => left.length === right.length && left.every(name => right.includes(name));

const declaresA = scale => reviewedKey => reviewedKey.declaration.scale === scale.name;

const holdsChangedLeaves = reviewedClass => reviewedClass.changedLeaves.length > 0;

const isACreatedKeyOrAChangedLeaf = reviewedKey => reviewedKey.changeKind === CHANGE_KINDS.CREATED || (declaresA(Scale.VARIABLE)(reviewedKey) && Boolean(reviewedKey.changeKind));

const compareByPlace = (left, right) => left.key.line - right.key.line || left.key.segments.length - right.key.segments.length;

function groupByParent(leaves) {
  const leavesByParentMap = new Map();
  for (const leaf of leaves) {
    if (!leavesByParentMap.has(leaf.key.parent)) leavesByParentMap.set(leaf.key.parent, []);
    leavesByParentMap.get(leaf.key.parent).push(leaf);
  }
  return [...leavesByParentMap.values()];
}

export class KeyTreeChange {
  constructor(file, driver) {
    this.file = file;
    this.driver = driver;
    this.after = file.existsAfterTheChange ? driver.readKeyTree(readTextAfterTheChange(file)) : driver.readKeyTree([]);
    this.before = driver.readKeyTree(readTextBeforeTheChange(file));
  }

  get trivialHunkCount() {
    return 0;
  }

  readKeyChangeKind(key) {
    const keyBefore = this.before.findKey(key.path);
    if (!keyBefore) return CHANGE_KINDS.CREATED;
    if (key.holdsChildren !== keyBefore.holdsChildren) return CHANGE_KINDS.BOUNDARY_CHANGED;
    if (key.holdsChildren) return holdsTheSameNames(key.childNames, keyBefore.childNames) ? null : CHANGE_KINDS.BOUNDARY_CHANGED;
    return key.value === keyBefore.value ? null : CHANGE_KINDS.INTERNALS_CHANGED;
  }

  readTheKeysOfTheChange() {
    return this.after.listKeys()
      .map(key => ({ key, declaration: this.driver.readDeclarationOfKey(key), changeKind: this.readKeyChangeKind(key) }))
      .filter(reviewedKey => reviewedKey.declaration.scale);
  }

  listReviewedKeys() {
    const keys = this.readTheKeysOfTheChange();
    const changedLeaves = keys.filter(declaresA(Scale.VARIABLE)).filter(reviewedKey => reviewedKey.changeKind);
    const changedPaths = new Set(keys.filter(isACreatedKeyOrAChangedLeaf).map(reviewedKey => reviewedKey.key.path));
    const holdsAChangedChild = reviewedKey => reviewedKey.key.children.some(child => changedPaths.has(child.path));
    const classes = keys.filter(declaresA(Scale.CLASS))
      .filter(reviewedKey => reviewedKey.changeKind || holdsAChangedChild(reviewedKey))
      .map(reviewedKey => ({
        ...reviewedKey,
        changeKind: reviewedKey.changeKind || CHANGE_KINDS.INTERNALS_CHANGED,
        changedLeaves: changedLeaves.filter(leaf => leaf.key.parent === reviewedKey.key),
      }));
    const kept = [...classes.filter(holdsChangedLeaves), ...classes.filter(reviewedClass => !holdsChangedLeaves(reviewedClass))].slice(0, MAX_KEY_CLASSES_PER_FILE);
    const classKeys = new Set(classes.map(reviewedClass => reviewedClass.key));
    const leafGroups = groupByParent(changedLeaves.filter(leaf => !classKeys.has(leaf.key.parent)));
    return {
      classes: kept.sort(compareByPlace),
      leafGroupsOutsideAClass: leafGroups.slice(0, MAX_KEY_CLASSES_PER_FILE),
      groupsLeftOut: classes.length - kept.length + Math.max(0, leafGroups.length - MAX_KEY_CLASSES_PER_FILE),
    };
  }
}
