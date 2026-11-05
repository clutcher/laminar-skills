import fs from "node:fs";
import path from "node:path";
import { KINDS, findDesignModelFormProblems } from "./DesignModelForm.mjs";
import { isAReadExtension } from "./SourceLanguages.mjs";

export { ANSWER_GIVERS, DOES, KINDS } from "./DesignModelForm.mjs";

const CHANGED_KINDS = new Set([KINDS.CREATED, KINDS.MOVED, KINDS.MODIFIED]);

const METHOD_MARK = "#";

const FOLDER_MARK = "/";

const INTERFACE_KIND_WORD = "interface";

// The word that stands where the host framework, and no method of the model, calls an owner, handles a failure or writes a response.
export const FRAMEWORK = "framework";

export class DesignModelStop extends Error {}

export const readList = given => (Array.isArray(given) ? given : []);

export const isAText = given => typeof given === "string" && given.trim().length > 0;

// A dotted name with no folder and no file extension is a nested class, Outer.Inner, so only a piece with a folder or the extension of a read language qualifies a class by its file.
const isAFileQualifier = piece => piece.includes(FOLDER_MARK) || isAReadExtension(piece);

const readNamePieces = displayName => {
  const pieces = displayName.split(METHOD_MARK);
  if (pieces.length > 1 && isAFileQualifier(pieces[0])) return { file: pieces[0], className: pieces[1], methodName: pieces[2] || "" };
  return { file: "", className: pieces[0], methodName: pieces[1] || "" };
};

export const isAMethodName = displayName => isAText(displayName) && readNamePieces(displayName).methodName !== "";

export const readTypeNames = typeText => (isAText(typeText) ? typeText.match(/[A-Za-z_$][\w$]*/g) || [] : []);

export const readHeadTypeName = typeText => readTypeNames(typeText)[0] || "";

export const isAnInterface = theClass => theClass.kindWord === INTERFACE_KIND_WORD;

export const isMarkedUnchanged = method => method.unchanged === true;

// An oldName of a nested class may name the inner type alone, so it takes the outer names of the class's own name.
export const readOldTypeName = theClass => {
  if (!isAText(theClass.oldName) || theClass.oldName.includes(".") || !theClass.name.includes(".")) return theClass.oldName;
  return `${theClass.name.slice(0, theClass.name.lastIndexOf("."))}.${theClass.oldName}`;
};

// An existing defect left as it is carries the reason under notFixed, and has no fix and no migration group.
export const isLeftUnfixed = existingDefect => isAText(existingDefect.notFixed);

export const getFolderPath = folder => (folder.path || "").replace(/\/+$/, "");

export const getFileOfTheChild = (folder, child) => `${getFolderPath(folder)}/${child.name || ""}`;

export const readFolderOfTheFile = file => (isAText(file) ? path.posix.dirname(file) : "");

const buildChildOfFileMap = folders => {
  const childOfFileMap = new Map();
  for (const folder of folders) {
    for (const child of readList(folder.children)) childOfFileMap.set(getFileOfTheChild(folder, child), child);
  }
  return childOfFileMap;
};

const buildClassesOfNameMap = classes => {
  const classesOfNameMap = new Map();
  for (const theClass of classes) {
    const sameName = classesOfNameMap.get(theClass.name) || [];
    sameName.push(theClass);
    classesOfNameMap.set(theClass.name, sameName);
  }
  return classesOfNameMap;
};

export class DesignModel {
  constructor(given) {
    this.version = given.version;
    this.folders = readList(given.folders);
    this.classes = readList(given.classes);
    this.decisions = given.decisions || {};
    this.childOfFileMap = buildChildOfFileMap(this.folders);
    this.classesOfNameMap = buildClassesOfNameMap(this.classes);
  }

  getClassPath(theClass) {
    return `classes[${this.classes.indexOf(theClass)}]`;
  }

  getMethodPath(theClass, method) {
    return `${this.getClassPath(theClass)}.methods[${readList(theClass.methods).indexOf(method)}]`;
  }

  isASharedClassName(className) {
    return (this.classesOfNameMap.get(className) || []).length > 1;
  }

  getClassDisplayName(theClass) {
    return this.isASharedClassName(theClass.name) ? `${theClass.file}${METHOD_MARK}${theClass.name}` : theClass.name;
  }

  getMethodDisplayName(theClass, method) {
    return `${this.getClassDisplayName(theClass)}${METHOD_MARK}${method.name}`;
  }

  findClass(displayName) {
    if (!isAText(displayName)) return null;

    const { file, className } = readNamePieces(displayName);
    const sameNameClasses = this.classesOfNameMap.get(className) || [];
    if (file) return sameNameClasses.find(theClass => theClass.file === file) || null;
    return sameNameClasses.length === 1 ? sameNameClasses[0] : null;
  }

  findClassOfTheType(typeName, referringClass) {
    const sameNameClasses = this.classesOfNameMap.get(typeName) || [];
    if (sameNameClasses.length < 2) return sameNameClasses[0] || null;

    const inTheFile = sameNameClasses.find(theClass => theClass.file === referringClass.file);
    if (inTheFile) return inTheFile;
    const inTheFolder = sameNameClasses.filter(theClass => readFolderOfTheFile(theClass.file) === readFolderOfTheFile(referringClass.file));
    return inTheFolder.length === 1 ? inTheFolder[0] : null;
  }

  listMethodsOfTheName(displayName) {
    const theClass = this.findClass(displayName);
    if (!theClass) return [];

    const { methodName } = readNamePieces(displayName);
    return readList(theClass.methods).filter(method => method.name === methodName);
  }

  findMethod(displayName) {
    if (!isAMethodName(displayName)) return null;
    return this.listMethodsOfTheName(displayName)[0] || null;
  }

  holdsTheName(displayName) {
    if (!isAMethodName(displayName)) return this.findClass(displayName) !== null;
    return this.findMethod(displayName) !== null;
  }

  isAnAmbiguousName(displayName) {
    if (!isAText(displayName)) return false;

    const { file, className } = readNamePieces(displayName);
    return !file && this.isASharedClassName(className);
  }

  findChildOfTheFile(file) {
    return this.childOfFileMap.get(file) || null;
  }

  getKindOfClass(theClass) {
    const child = this.findChildOfTheFile(theClass.file);
    return child ? child.kind : KINDS.MODIFIED;
  }

  isChangedClass(theClass) {
    return CHANGED_KINDS.has(this.getKindOfClass(theClass));
  }

  listScopeFolderPaths() {
    const folderPaths = [...this.folders.map(getFolderPath), ...this.classes.map(theClass => readFolderOfTheFile(theClass.file))];
    return [...new Set(folderPaths.filter(isAText))];
  }

  getExitNames() {
    return new Set(readList(this.decisions.exits).map(exit => exit.exit).filter(isAText).map(exitName => this.normalizeName(exitName)));
  }

  normalizeName(displayName) {
    const theClass = this.findClass(displayName);
    if (!theClass) return displayName;

    const { methodName } = readNamePieces(displayName);
    return methodName ? `${this.getClassDisplayName(theClass)}${METHOD_MARK}${methodName}` : this.getClassDisplayName(theClass);
  }

  listMethodsWithClass() {
    const methodsWithClass = [];
    for (const theClass of this.classes) {
      for (const method of readList(theClass.methods)) methodsWithClass.push({ theClass, method, displayName: this.getMethodDisplayName(theClass, method) });
    }
    return methodsWithClass;
  }

  listImplementationNames(theClass, method) {
    if (!isAnInterface(theClass)) return [];

    const implementationNames = [];
    for (const implementingClass of this.classes) {
      const parentNames = [...readList(implementingClass.implements), ...readList(implementingClass.extends)];
      if (!parentNames.some(parentName => this.findClassOfTheType(readHeadTypeName(parentName), implementingClass) === theClass)) continue;
      for (const implementingMethod of readList(implementingClass.methods)) {
        if (implementingMethod.name === method.name) implementationNames.push(this.getMethodDisplayName(implementingClass, implementingMethod));
      }
    }
    return implementationNames;
  }

  listNamesReachedFrom(theClass, method) {
    const privateNames = readList(method.uses)
      .filter(use => readList(theClass.methods).some(other => other.name === use && other !== method))
      .map(use => `${this.getClassDisplayName(theClass)}${METHOD_MARK}${use}`);
    return [...readList(method.calls).filter(isAText).map(called => this.normalizeName(called)), ...privateNames, ...this.listImplementationNames(theClass, method)];
  }
}

export const createDesignModel = (given, source = "the design model") => {
  const problems = findDesignModelFormProblems(given);
  if (problems.length) throw new DesignModelStop(`design model: ${source} is malformed:\n${problems.map(problem => `  ${problem}`).join("\n")}`);
  return new DesignModel(given);
};

export const readDesignModel = modelPath => {
  let text;
  try {
    text = fs.readFileSync(path.resolve(modelPath), "utf8");
  } catch (error) {
    throw new DesignModelStop(`design model: cannot read ${modelPath}: ${error.message}`);
  }

  let given;
  try {
    given = JSON.parse(text);
  } catch (error) {
    throw new DesignModelStop(`design model: ${modelPath} is no JSON: ${error.message}`);
  }
  return createDesignModel(given, modelPath);
};
