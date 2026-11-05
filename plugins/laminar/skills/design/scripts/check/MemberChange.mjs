import { KINDS, getFolderPath, isAText, isMarkedUnchanged } from "../model/DesignModel.mjs";

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

  const currentFile = readCurrentFileOf(model, theClass);
  for (const method of methods) {
    if (isMarkedUnchanged(method)) continue;
    if (isAText(method.oldName)) return `${theClass.name}#${method.name} holds an oldName`;
    if (!currentTree.holdsTheSignature(currentFile, method)) return `the current tree holds no ${theClass.name}#${method.name} with the parameters of the model`;
    if (!isAText(method.body)) continue;
    const writtenLine = findBodyLineTheChangeWrites(currentTree.readFileText(currentFile), method.body);
    if (writtenLine) return `the body of ${theClass.name}#${method.name} holds the line "${writtenLine}", which the current tree does not hold, so the design writes it`;
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
