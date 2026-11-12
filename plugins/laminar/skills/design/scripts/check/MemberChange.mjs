import { KINDS, getFolderPath, isAText, isMarkedUnchanged, readList } from "../model/DesignModel.mjs";
import { readMemberLanguage } from "./ClassDeclaration.mjs";
import { readDeclaredFieldNames } from "./DeclaredFields.mjs";

const KINDS_OUTSIDE_THE_CHANGE = new Set([KINDS.MODIFIED, KINDS.UNCHANGED]);

const readCurrentFileOf = (model, theClass) => {
  const child = model.findChildOfTheFile(theClass.file);
  return child && isAText(child.oldPath) ? child.oldPath : theClass.file;
};

const collapseTheSpaces = text => text.replace(/\s+/g, " ").trim();

// The first line of the body that the current tree does not hold, so the design writes it; null where every line of the body is older than the change.
const findBodyLineTheChangeWrites = (currentText, body) => {
  if (currentText === null) return body.split("\n").find(line => line.trim()) || body;

  const currentCode = collapseTheSpaces(currentText);
  return body.split("\n").map(collapseTheSpaces).find(line => line && !currentCode.includes(line)) || null;
};

export const describeTheChangeOfTheMember = (model, theClass, methods, currentTree) => {
  const kind = model.getKindOfClass(theClass);
  if (!KINDS_OUTSIDE_THE_CHANGE.has(kind)) return `its class ${theClass.name} stands in a ${kind} file`;
  if (isAText(theClass.oldName)) return `its class ${theClass.name} holds an oldName`;
  const renamedField = readList(theClass.fields).find(field => isAText(field.oldName));
  if (renamedField) return `${theClass.name}#${renamedField.name} holds an oldName`;

  const currentFile = readCurrentFileOf(model, theClass);
  for (const method of methods) {
    if (isMarkedUnchanged(method)) continue;
    if (isAText(method.oldName)) return `${theClass.name}#${method.name} holds an oldName`;
    if (!currentTree.holdsTheSignature(currentFile, method)) return `the current tree holds no ${theClass.name}#${method.name} with the parameters and the return type of the model`;
    if (!isAText(method.body)) continue;
    const writtenLine = findBodyLineTheChangeWrites(currentTree.readFileText(currentFile), method.body);
    if (writtenLine) return `the body of ${theClass.name}#${method.name} holds the line "${writtenLine}", which the current tree does not hold, so the design writes it`;
  }
  return null;
};

const holdsTheTypeBesideTheName = (currentText, field) => {
  const fieldName = new RegExp(`(^|[^\\w$])${field.name.replace(/[$]/g, "\\$")}([^\\w$]|$)`);
  return currentText.split("\n").some(line => line.includes(field.type) && fieldName.test(line));
};

// A field is outside the change where the current tree declares it in its class with the type of the model, and the design renames neither the class nor the field; a file in a language the field reader does not read never passes.
export const describeTheChangeOfTheFields = (model, theClass, fieldNames, currentTree) => {
  const kind = model.getKindOfClass(theClass);
  if (!KINDS_OUTSIDE_THE_CHANGE.has(kind)) return `its class ${theClass.name} stands in a ${kind} file`;
  if (isAText(theClass.oldName)) return `its class ${theClass.name} holds an oldName`;
  const currentFile = readCurrentFileOf(model, theClass);
  if (!readMemberLanguage(currentFile)) return `the script cannot read the fields of ${currentFile}`;

  const currentText = currentTree.readFileText(currentFile);
  const declaredNames = currentText === null ? null : readDeclaredFieldNames(currentText, currentFile, theClass.name);
  for (const fieldName of fieldNames) {
    const field = readList(theClass.fields).find(other => other.name === fieldName);
    if (!field) return `the model lists no field ${fieldName} of ${theClass.name}`;
    if (isAText(field.oldName)) return `${theClass.name}#${fieldName} holds an oldName`;
    if (!declaredNames?.has(fieldName)) return `the current tree declares no field ${fieldName} in ${theClass.name}, so the design creates it`;
    if (isAText(field.type) && !holdsTheTypeBesideTheName(currentText, field)) return `the current tree holds no line with the type ${field.type} and the field ${fieldName} of ${theClass.name}, so the design retypes it`;
  }
  return null;
};

// A folder finding is outside the change where the folder already stands in the current tree and the design neither creates nor moves it.
export const describeTheChangeOfTheFolder = (model, folderPath, currentTree) => {
  const normalizedPath = folderPath.replace(/\/+$/, "");
  const folder = model.folders.find(other => getFolderPath(other) === normalizedPath);
  if (folder && !KINDS_OUTSIDE_THE_CHANGE.has(folder.kind)) return `the folder ${normalizedPath} is ${folder.kind}`;
  return currentTree.holdsThePath(normalizedPath) ? null : `the current tree holds no folder ${normalizedPath}`;
};
