import fs from "node:fs";
import path from "node:path";
import { KINDS, findDesignModelFormProblems } from "./DesignModelForm.mjs";
import { isAReadExtension, isATestFile } from "./SourceLanguages.mjs";

export { ANSWER_GIVERS, DOES, KINDS } from "./DesignModelForm.mjs";

const CHANGED_KINDS = new Set([KINDS.CREATED, KINDS.MOVED, KINDS.MODIFIED]);

const METHOD_MARK = "#";

const FOLDER_MARK = "/";

const NESTED_TYPE_MARK = ".";

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

// A package before a type, such as com.example in com.example.Money, names where the type lives and not the type, and a file names the type through its import.
const PACKAGE_PREFIX = /(^|[^\w$.])(?:[a-z_][\w$]*\.)+(?=[A-Z])/g;

// A nested type is written Outer.Inner in Java, Kotlin, C# and a TypeScript namespace, so a dotted name stays 1 type name.
const TYPE_NAME = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g;

export const readTypeNames = typeText => (isAText(typeText) ? typeText.replace(PACKAGE_PREFIX, "$1").match(TYPE_NAME) || [] : []);

export const readHeadTypeName = typeText => readTypeNames(typeText)[0] || "";

export const isAnInterface = theClass => theClass.kindWord === INTERFACE_KIND_WORD;

export const isMarkedUnchanged = method => method.unchanged === true;

// An oldName of a nested class may name the inner type alone, so it takes the outer names of the class's own name.
export const readOldTypeName = theClass => {
  if (!isAText(theClass.oldName) || theClass.oldName.includes(".") || !theClass.name.includes(".")) return theClass.oldName;
  return `${theClass.name.slice(0, theClass.name.lastIndexOf("."))}.${theClass.oldName}`;
};

// A class of a test file of the stacks the skill reads, or of a file that decisions.tests names.
export const isATestFileOfTheModel = (model, file) => isATestFile(file) || [...readList(model.decisions.tests?.integration), ...readList(model.decisions.tests?.unit)].some(tests => tests.file === file);

// The names a bare type name can stand for inside a nested class, innermost first: Unit inside Rental.Period is Rental.Period.Unit, then Rental.Unit.
const listNestedNamesOfTheBareName = (typeName, referringClassName) => {
  const outerPieces = referringClassName.split(NESTED_TYPE_MARK);
  const nestedNames = [];
  for (let length = outerPieces.length; length > 0; length -= 1) nestedNames.push([...outerPieces.slice(0, length), typeName].join(NESTED_TYPE_MARK));
  return nestedNames;
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

  // A dotted type name names its class exactly; a bare one names first a nested class of the referring class or of a class around it.
  findClassOfTheType(typeName, referringClass) {
    if (!isAText(typeName)) return null;
    if (typeName.includes(NESTED_TYPE_MARK) || !isAText(referringClass?.name)) return this.findClassOfTheExactType(typeName, referringClass);

    for (const nestedName of listNestedNamesOfTheBareName(typeName, referringClass.name)) {
      const nestedClass = this.findClassOfTheExactType(nestedName, referringClass);
      if (nestedClass) return nestedClass;
    }
    return this.findClassOfTheExactType(typeName, referringClass);
  }

  findClassOfTheExactType(typeName, referringClass) {
    const sameNameClasses = this.classesOfNameMap.get(typeName) || [];
    if (sameNameClasses.length < 2) return sameNameClasses[0] || null;

    const inTheFile = sameNameClasses.find(theClass => theClass.file === referringClass.file);
    if (inTheFile) return inTheFile;
    const inTheFolder = sameNameClasses.filter(theClass => readFolderOfTheFile(theClass.file) === readFolderOfTheFile(referringClass.file));
    return inTheFolder.length === 1 ? inTheFolder[0] : null;
  }

  // The class that holds a nested class in the same file, named by the first piece of its dotted name, or the class itself where the model holds no such class.
  findOutermostClass(theClass) {
    if (!isAText(theClass.name) || !theClass.name.includes(NESTED_TYPE_MARK)) return theClass;

    const outermostName = theClass.name.split(NESTED_TYPE_MARK)[0];
    return (this.classesOfNameMap.get(outermostName) || []).find(other => other.file === theClass.file) || theClass;
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

  implementsOrExtends(implementingClass, theClass) {
    const parentNames = [...readList(implementingClass.implements), ...readList(implementingClass.extends)];
    return parentNames.some(parentName => this.findClassOfTheType(readHeadTypeName(parentName), implementingClass) === theClass);
  }

  listImplementationNames(theClass, method) {
    if (!isAnInterface(theClass)) return [];

    const implementationNames = [];
    for (const implementingClass of this.classes) {
      if (!this.implementsOrExtends(implementingClass, theClass)) continue;
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
