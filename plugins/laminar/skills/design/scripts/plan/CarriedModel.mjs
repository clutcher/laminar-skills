import { KINDS, getFileOfTheChild, getFolderPath, isAText, readList } from "../model/DesignModel.mjs";

// A kind that names a file the plan before brought into the tree; once the plan commit holds the file, the file stays and the later plan changes it.
const KINDS_THAT_BRING_A_FILE = new Set([KINDS.CREATED, KINDS.MOVED]);

const createCounts = () => ({ filesNowModified: 0, filesDropped: 0, methodsMarkedUnchanged: 0, renamesApplied: 0, removalsApplied: 0, findingsOfTheRunDropped: 0 });

const carryTheChild = (folder, child, currentTree, counts) => {
  const file = getFileOfTheChild(folder, child);
  const isInTheTree = currentTree.holdsThePath(file);
  if (child.kind === KINDS.REMOVED) {
    if (!isInTheTree) counts.filesDropped += 1;
    return isInTheTree ? child : null;
  }
  if (!isInTheTree) return child;

  const carried = { ...child };
  if (KINDS_THAT_BRING_A_FILE.has(child.kind)) {
    carried.kind = KINDS.MODIFIED;
    delete carried.oldPath;
    counts.filesNowModified += 1;
  }
  const removedClasses = readList(child.removedClasses).filter(className => currentTree.holdsTheWord(file, className));
  if (removedClasses.length) carried.removedClasses = removedClasses;
  else delete carried.removedClasses;
  return carried;
};

const carryTheFolder = (folder, currentTree, counts) => {
  const folderPath = getFolderPath(folder);
  if (folder.kind === KINDS.REMOVED && !currentTree.holdsThePath(folderPath)) return null;

  const kind = KINDS_THAT_BRING_A_FILE.has(folder.kind) && currentTree.holdsThePath(folderPath) ? KINDS.MODIFIED : folder.kind;
  const children = readList(folder.children).map(child => carryTheChild(folder, child, currentTree, counts)).filter(Boolean);
  return { ...folder, kind, children };
};

// A method that the plan commit holds with the signature of the model is written, so the later plan keeps it as it is until the designer changes it again.
const carryTheMethod = (method, file, currentTree, counts) => {
  if (method.unchanged === true || !currentTree.holdsTheSignature(file, method)) return method;

  const carried = { ...method, unchanged: true };
  delete carried.body;
  delete carried.oldName;
  counts.methodsMarkedUnchanged += 1;
  return carried;
};

const carryTheClass = (theClass, currentTree, counts) => {
  const carried = { ...theClass };
  // A nested type never stands in its file by its dotted name, so the inner name decides whether the rename is written.
  if (isAText(theClass.oldName) && !currentTree.holdsTheWord(theClass.file, theClass.oldName.split(".").pop())) {
    delete carried.oldName;
    counts.renamesApplied += 1;
  }
  const removed = readList(theClass.removed).filter(name => currentTree.holdsTheWord(theClass.file, name));
  counts.removalsApplied += readList(theClass.removed).length - removed.length;
  if (removed.length) carried.removed = removed;
  else delete carried.removed;
  carried.fields = readList(theClass.fields).map(field => {
    if (!isAText(field.oldName) || currentTree.holdsTheWord(theClass.file, field.oldName)) return field;
    counts.renamesApplied += 1;
    const { oldName, ...written } = field;
    return written;
  });
  carried.methods = readList(theClass.methods).map(method => carryTheMethod(method, theClass.file, currentTree, counts));
  return carried;
};

// The model of the plan before, read against the plan commit: what that commit already holds stands as written, so a file it brought becomes modified, a rename or a removal it made leaves the model, and each method it wrote is marked unchanged; what it does not hold, such as the files of a stopped writer, keeps its change. The objects of decisions.findings of the earlier run folder leave, because the run folder of this plan numbers its items anew.
export const carryTheModel = (given, currentTree) => {
  const counts = createCounts();
  const folders = readList(given.folders).map(folder => carryTheFolder(folder, currentTree, counts)).filter(Boolean);
  const droppedFiles = new Set(readList(given.folders).flatMap(folder => readList(folder.children)
    .filter(child => child.kind === KINDS.REMOVED && !currentTree.holdsThePath(getFileOfTheChild(folder, child)))
    .map(child => getFileOfTheChild(folder, child))));
  const keptChildOfFileMap = new Map(folders.flatMap(folder => folder.children.map(child => [getFileOfTheChild(folder, child), child])));
  const classes = readList(given.classes)
    .filter(theClass => !droppedFiles.has(theClass.file))
    .map(theClass => {
      const child = keptChildOfFileMap.get(theClass.file);
      const isWritten = currentTree.holdsTheFile(theClass.file) && (!child || child.kind === KINDS.MODIFIED);
      return isWritten ? carryTheClass(theClass, currentTree, counts) : theClass;
    });
  const decisions = given.decisions || {};
  const findings = readList(decisions.findings).filter(finding => Number.isFinite(finding.run));
  counts.findingsOfTheRunDropped = readList(decisions.findings).length - findings.length;
  return { model: { ...given, folders, classes, decisions: { ...decisions, findings } }, counts };
};
