import { KINDS, getFileOfTheChild, getFolderPath, isAMethodName, readList } from "../model/DesignModel.mjs";

// How the design model holds the abstraction of a still-open finding key, which decides whether the key stays open.
export const STANDINGS = Object.freeze({ STANDS: "stands", UNCHANGED: "unchanged", REMOVED: "removed", RENAMED: "renamed", ABSENT: "absent" });

const METHOD_MARK = "#";

const ENCLOSING_MARK = " in ";

const FOLDER_MARK = "/";

const createStanding = (standing, newDisplayName = "") => ({ standing, newDisplayName });

const readStandingOfTheKind = kind => {
  if (kind === KINDS.REMOVED) return createStanding(STANDINGS.REMOVED);
  return createStanding(kind === KINDS.UNCHANGED ? STANDINGS.UNCHANGED : STANDINGS.STANDS);
};

const listFolderPlaces = model => [
  ...model.folders.map(folder => ({ path: getFolderPath(folder), kind: folder.kind, oldPath: "" })),
  ...model.folders.flatMap(folder => readList(folder.children).map(child => ({ path: getFileOfTheChild(folder, child), kind: child.kind, oldPath: child.oldPath || "" }))),
];

// A folder the model lists stands by its kind, so a folder of kind removed is removed; a folder that the oldPath of a child names is renamed to that child; a folder the model holds nowhere is absent, because only an explicit removal closes a key.
const findStandingOfTheFolder = (model, folderPath) => {
  const places = listFolderPlaces(model);
  const samePath = places.filter(place => place.path === folderPath);
  if (samePath.some(place => place.kind === KINDS.REMOVED)) return createStanding(STANDINGS.REMOVED);
  if (samePath.length) return readStandingOfTheKind(samePath[0].kind);

  const movedHere = places.find(place => place.oldPath === folderPath);
  return movedHere ? createStanding(STANDINGS.RENAMED, movedHere.path) : createStanding(STANDINGS.ABSENT);
};

const readClassName = classDisplayName => classDisplayName.split(METHOD_MARK).pop();

const findClassOfTheOldName = (model, classDisplayName) => model.classes.find(theClass => theClass.oldName === readClassName(classDisplayName)) || null;

const isAListedRemovedClass = (model, classDisplayName) => model.folders
  .some(folder => readList(folder.children).some(child => readList(child.removedClasses).includes(readClassName(classDisplayName))));

// A class the model holds nowhere is removed only where the removedClasses of a file child lists it.
const findStandingOfAMissingClass = (model, classDisplayName) => createStanding(isAListedRemovedClass(model, classDisplayName) ? STANDINGS.REMOVED : STANDINGS.ABSENT);

const findStandingOfTheClass = (model, classDisplayName) => {
  const theClass = model.findClass(classDisplayName);
  if (theClass) return readStandingOfTheKind(model.getKindOfClass(theClass));

  const renamedClass = findClassOfTheOldName(model, classDisplayName);
  return renamedClass ? createStanding(STANDINGS.RENAMED, model.getClassDisplayName(renamedClass)) : findStandingOfAMissingClass(model, classDisplayName);
};

const findMethodOfTheName = (theClass, methodName) => readList(theClass.methods).find(method => method.name === methodName)
  || readList(theClass.methods).find(method => method.oldName === methodName)
  || null;

const findStandingOfTheMethod = (model, displayName) => {
  const methodAt = displayName.lastIndexOf(METHOD_MARK);
  const classDisplayName = displayName.slice(0, methodAt);
  const methodName = displayName.slice(methodAt + 1);
  const theClass = model.findClass(classDisplayName) || findClassOfTheOldName(model, classDisplayName);
  if (!theClass) return findStandingOfAMissingClass(model, classDisplayName);
  const classKind = model.getKindOfClass(theClass);
  if (classKind === KINDS.REMOVED) return createStanding(STANDINGS.REMOVED);

  const method = findMethodOfTheName(theClass, methodName);
  if (!method) return createStanding(readList(theClass.removed).includes(methodName) ? STANDINGS.REMOVED : STANDINGS.ABSENT);
  const newDisplayName = model.getMethodDisplayName(theClass, method);
  if (newDisplayName !== displayName) return createStanding(STANDINGS.RENAMED, newDisplayName);
  return createStanding(method.unchanged === true || classKind === KINDS.UNCHANGED ? STANDINGS.UNCHANGED : STANDINGS.STANDS);
};

// A variable stands as its enclosing abstraction stands, because the model holds no variable.
const readEnclosingOfTheVariable = displayName => {
  const enclosingAt = displayName.indexOf(ENCLOSING_MARK);
  const methodAt = displayName.indexOf(METHOD_MARK);
  return enclosingAt >= 0 && (methodAt < 0 || enclosingAt < methodAt) ? displayName.slice(enclosingAt + ENCLOSING_MARK.length) : "";
};

const findStandingAgainstTheBase = (model, displayName) => {
  if (isAMethodName(displayName)) return findStandingOfTheMethod(model, displayName);
  if (displayName.includes(METHOD_MARK)) return findStandingOfTheClass(model, displayName);
  if (displayName.includes(FOLDER_MARK)) return findStandingOfTheFolder(model, displayName);
  return findStandingOfTheClass(model, displayName);
};

const findStandingOfTheAbstraction = (model, displayName, newNameOfOldNameMap) => {
  const enclosing = readEnclosingOfTheVariable(displayName);
  if (!enclosing) return findStandingAgainstTheBase(model, displayName);

  const standing = findStandingInTheModel(model, enclosing, newNameOfOldNameMap);
  return standing.standing === STANDINGS.RENAMED ? createStanding(STANDINGS.RENAMED, displayName.replace(enclosing, standing.newDisplayName)) : standing;
};

// An abstraction absent from the model is renamed where the designer renamed it between rounds, by the model of the round before or by a rename the dispositions of the round give.
export const findStandingInTheModel = (model, displayName, newNameOfOldNameMap = new Map()) => {
  const standing = findStandingOfTheAbstraction(model, displayName, newNameOfOldNameMap);
  if (standing.standing !== STANDINGS.ABSENT || !newNameOfOldNameMap.has(displayName)) return standing;
  return createStanding(STANDINGS.RENAMED, newNameOfOldNameMap.get(displayName));
};

// The review names a field as its class and its name, joined by the method mark.
const isAFieldOfTheModel = (model, displayName) => {
  const fieldAt = displayName.lastIndexOf(METHOD_MARK);
  const theClass = fieldAt > 0 ? model.findClass(displayName.slice(0, fieldAt)) : null;
  return Boolean(theClass) && readList(theClass.fields).some(field => field.name === displayName.slice(fieldAt + 1));
};

// The model holds a display name where its abstraction stands, as it stands or unchanged, or where it names a field of a class of the model.
export const isInTheModel = (model, displayName) => {
  const { standing } = findStandingOfTheAbstraction(model, displayName, new Map());
  return standing === STANDINGS.STANDS || standing === STANDINGS.UNCHANGED || isAFieldOfTheModel(model, displayName);
};
