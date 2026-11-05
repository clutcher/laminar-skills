import { readList } from "../model/DesignModel.mjs";

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
export const listRenamesBetweenRounds = (modelBefore, model) => {
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
