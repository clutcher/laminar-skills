import { readList } from "../model/DesignModel.mjs";
import { isInTheModel } from "./AbstractionStanding.mjs";
import { ROUND_DEFECT_CODES, createRoundDefect } from "./Dispositions.mjs";

const METHOD_MARK = "#";

const readSignatureKey = method => JSON.stringify([readList(method.parameters).map(parameter => parameter.type || ""), method.returns || ""]);

const readMethodNamesKey = theClass => readList(theClass.methods).map(method => method.name).sort().join(",");

// The 1 pair of a gone and an added item that match, where each side has exactly 1 match; an item with 2 matches is no rename, because the script cannot tell which.
const pairTheUniqueMatches = (goneItems, addedItems, isAMatch) => {
  const pairs = [];
  for (const gone of goneItems) {
    const matches = addedItems.filter(added => isAMatch(gone, added));
    if (matches.length !== 1) continue;
    if (goneItems.filter(other => isAMatch(other, matches[0])).length === 1) pairs.push([gone, matches[0]]);
  }
  return pairs;
};

const isTheSameClass = (gone, added) => gone.file === added.file || (readList(gone.methods).length > 0 && readMethodNamesKey(gone) === readMethodNamesKey(added));

const listClassPairs = (modelBefore, model) => {
  const namesNow = new Set(model.classes.map(theClass => theClass.name));
  const namesBefore = new Set(modelBefore.classes.map(theClass => theClass.name));
  const goneClasses = modelBefore.classes.filter(theClass => !namesNow.has(theClass.name));
  const addedClasses = model.classes.filter(theClass => !namesBefore.has(theClass.name) && !theClass.oldName);
  return pairTheUniqueMatches(goneClasses, addedClasses, isTheSameClass);
};

const listMethodPairs = (classBefore, classNow) => {
  const namesNow = new Set(readList(classNow.methods).map(method => method.name));
  const namesBefore = new Set(readList(classBefore.methods).map(method => method.name));
  const goneMethods = readList(classBefore.methods).filter(method => !namesNow.has(method.name));
  const addedMethods = readList(classNow.methods).filter(method => !namesBefore.has(method.name) && !method.oldName);
  return pairTheUniqueMatches(goneMethods, addedMethods, (gone, added) => readSignatureKey(gone) === readSignatureKey(added));
};

// The renames the designer made between 2 rounds, which no oldName records because the base never held the old name: a class gone from the model of the round before with 1 added class of the same file or the same methods, and a method gone from a class with 1 added method of the same parameter types and return. Each maps the old display name to the new one.
const listRenamesOfTheModels = (modelBefore, model) => {
  const newNameOfOldNameMap = new Map();
  if (!modelBefore || !model) return newNameOfOldNameMap;

  const classPairs = listClassPairs(modelBefore, model);
  for (const [classBefore, classNow] of classPairs) newNameOfOldNameMap.set(modelBefore.getClassDisplayName(classBefore), model.getClassDisplayName(classNow));
  const classNowOfBeforeMap = new Map(classPairs);
  for (const classBefore of modelBefore.classes) {
    const classNow = classNowOfBeforeMap.get(classBefore) || model.classes.find(theClass => theClass.name === classBefore.name);
    if (!classNow) continue;
    if (classNow.name !== classBefore.name) {
      for (const method of readList(classBefore.methods).filter(methodBefore => readList(classNow.methods).some(methodNow => methodNow.name === methodBefore.name))) {
        newNameOfOldNameMap.set(`${modelBefore.getClassDisplayName(classBefore)}${METHOD_MARK}${method.name}`, `${model.getClassDisplayName(classNow)}${METHOD_MARK}${method.name}`);
      }
    }
    for (const [methodBefore, methodNow] of listMethodPairs(classBefore, classNow)) {
      newNameOfOldNameMap.set(`${modelBefore.getClassDisplayName(classBefore)}${METHOD_MARK}${methodBefore.name}`, `${model.getClassDisplayName(classNow)}${METHOD_MARK}${methodNow.name}`);
    }
  }
  return newNameOfOldNameMap;
};

// The renames between rounds: those the models show, and those the dispositions of the round give for code the base never held and the model of the round before no longer shows, such as a field or a method moved before round 1 was recorded.
export const listRenamesBetweenRounds = (modelBefore, model, givenRenames = []) => {
  const newNameOfOldNameMap = listRenamesOfTheModels(modelBefore, model);
  for (const rename of givenRenames) newNameOfOldNameMap.set(rename.renamedFrom, rename.displayName);
  return newNameOfOldNameMap;
};

// A given rename holds where an earlier round raised a key under its old name and the model holds its new name.
export const findGivenRenameDefects = (givenRenames, model, earlierKeyStates) => {
  const earlierNames = new Set(earlierKeyStates.map(keyState => keyState.displayName));
  const defects = [];
  for (const rename of givenRenames) {
    if (!earlierNames.has(rename.renamedFrom)) defects.push(createRoundDefect(ROUND_DEFECT_CODES.RENAMED_KEY_UNKNOWN, rename.renamedFrom, `the rename to ${rename.displayName} names ${rename.renamedFrom}, which no finding key of an earlier round holds`));
    if (model && !isInTheModel(model, rename.displayName)) defects.push(createRoundDefect(ROUND_DEFECT_CODES.RENAMED_NAME_ABSENT_FROM_MODEL, rename.displayName, `the rename from ${rename.renamedFrom} names ${rename.displayName}, which the model does not hold`));
  }
  return defects;
};
