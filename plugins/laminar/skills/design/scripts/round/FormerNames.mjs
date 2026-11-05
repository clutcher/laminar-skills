import { isAMethodName, isAText, readFolderOfTheFile, readList } from "../model/DesignModel.mjs";

const METHOD_MARK = "#";

const ENCLOSING_MARK = " in ";

const FOLDER_MARK = "/";

const NESTED_MARK = ".";

// An oldName of a nested class may name the inner type alone, so it takes the outer names of the class's own name.
const readFormerClassName = theClass => {
  if (!isAText(theClass.oldName)) return theClass.name;
  if (theClass.oldName.includes(NESTED_MARK) || !theClass.name.includes(NESTED_MARK)) return theClass.oldName;
  return `${theClass.name.slice(0, theClass.name.lastIndexOf(NESTED_MARK))}${NESTED_MARK}${theClass.oldName}`;
};

const listFormerNamesOfTheClass = (model, classDisplayName) => {
  const theClass = model.findClass(classDisplayName);
  return theClass ? [readFormerClassName(theClass)] : [];
};

const listFormerNamesOfTheMethod = (model, displayName) => {
  const methodAt = displayName.lastIndexOf(METHOD_MARK);
  const theClass = model.findClass(displayName.slice(0, methodAt));
  if (!theClass) return [];

  const methodName = displayName.slice(methodAt + 1);
  const method = readList(theClass.methods).find(other => other.name === methodName);
  const formerMethodName = method && isAText(method.oldName) ? method.oldName : methodName;
  return [`${readFormerClassName(theClass)}${METHOD_MARK}${formerMethodName}`];
};

const isAtOrBelow = (folderPath, upperPath) => folderPath === upperPath || folderPath.startsWith(`${upperPath}${FOLDER_MARK}`);

const findSharedFolder = (firstPath, secondPath) => {
  const firstPieces = firstPath.split(FOLDER_MARK);
  const secondPieces = secondPath.split(FOLDER_MARK);
  let sharedCount = 0;
  while (sharedCount < firstPieces.length && firstPieces[sharedCount] === secondPieces[sharedCount]) sharedCount += 1;
  return firstPieces.slice(0, sharedCount).join(FOLDER_MARK);
};

// The folder a class stood in before: the folder of the oldPath of its file child, else its folder in the model of the round before.
const findFormerFolder = (model, modelBefore, theClass) => {
  const child = model.findChildOfTheFile(theClass.file);
  if (child && isAText(child.oldPath)) return readFolderOfTheFile(child.oldPath);
  const classBefore = modelBefore ? modelBefore.findClass(theClass.name) : null;
  return classBefore ? readFolderOfTheFile(classBefore.file) : "";
};

// A class moved from 1 folder to another changes each folder from its new folder up to the folder that holds both, so a finding on any of them follows the former folder.
const listFormerFoldersOfTheFolder = (model, modelBefore, folderPath) => {
  const formerFolders = [];
  for (const theClass of model.classes) {
    const newFolder = readFolderOfTheFile(theClass.file);
    const formerFolder = findFormerFolder(model, modelBefore, theClass);
    if (!formerFolder || formerFolder === newFolder || !isAtOrBelow(newFolder, folderPath)) continue;
    if (isAtOrBelow(folderPath, findSharedFolder(newFolder, formerFolder))) formerFolders.push(formerFolder);
  }
  return formerFolders;
};

const listFormerNamesAgainstTheBase = (model, modelBefore, displayName) => {
  if (isAMethodName(displayName)) return listFormerNamesOfTheMethod(model, displayName);
  if (!displayName.includes(METHOD_MARK) && displayName.includes(FOLDER_MARK)) return listFormerFoldersOfTheFolder(model, modelBefore, displayName);
  return listFormerNamesOfTheClass(model, displayName);
};

const listOldNamesBetweenRounds = (newNameOfOldNameMap, displayName) => [...newNameOfOldNameMap].filter(([, newName]) => newName === displayName).map(([oldName]) => oldName);

const listFormerNamesOfTheAbstraction = (model, modelBefore, displayName, newNameOfOldNameMap) => [
  ...listFormerNamesAgainstTheBase(model, modelBefore, displayName),
  ...listOldNamesBetweenRounds(newNameOfOldNameMap, displayName),
];

const readEnclosingAt = displayName => {
  const enclosingAt = displayName.indexOf(ENCLOSING_MARK);
  const methodAt = displayName.indexOf(METHOD_MARK);
  return enclosingAt >= 0 && (methodAt < 0 || enclosingAt < methodAt) ? enclosingAt : -1;
};

// The display names a finding key held before by the design model, its own first: the oldName of its class or method, its name in the model of the round before where the designer renamed it between rounds, and for a folder the former folder of each class moved into it; a variable follows its enclosing abstraction.
export const listFormerNames = (model, modelBefore, displayName, newNameOfOldNameMap = new Map()) => {
  if (!model) return [displayName];

  const enclosingAt = readEnclosingAt(displayName);
  const formerNames = enclosingAt >= 0
    ? listFormerNamesOfTheAbstraction(model, modelBefore, displayName.slice(enclosingAt + ENCLOSING_MARK.length), newNameOfOldNameMap).map(enclosing => `${displayName.slice(0, enclosingAt)}${ENCLOSING_MARK}${enclosing}`)
    : listFormerNamesOfTheAbstraction(model, modelBefore, displayName, newNameOfOldNameMap);
  return [...new Set([displayName, ...formerNames])];
};

export const shareAFormerName = (firstNames, secondNames) => firstNames.some(name => secondNames.includes(name));
