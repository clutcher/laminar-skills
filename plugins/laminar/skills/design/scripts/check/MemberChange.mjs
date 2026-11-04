import { KINDS, isAText, isMarkedUnchanged } from "../model/DesignModel.mjs";

const KINDS_OUTSIDE_THE_CHANGE = new Set([KINDS.MODIFIED, KINDS.UNCHANGED]);

const readCurrentFileOf = (model, theClass) => {
  const child = model.findChildOfTheFile(theClass.file);
  return child && isAText(child.oldPath) ? child.oldPath : theClass.file;
};

export const describeTheChangeOfTheMember = (model, theClass, methods, currentTree) => {
  const kind = model.getKindOfClass(theClass);
  if (!KINDS_OUTSIDE_THE_CHANGE.has(kind)) return `its class ${theClass.name} stands in a ${kind} file`;
  if (isAText(theClass.oldName)) return `its class ${theClass.name} holds an oldName`;

  for (const method of methods) {
    if (isMarkedUnchanged(method)) continue;
    if (isAText(method.body)) return `${theClass.name}#${method.name} holds a body`;
    if (isAText(method.oldName)) return `${theClass.name}#${method.name} holds an oldName`;
    if (!currentTree.holdsTheSignature(readCurrentFileOf(model, theClass), method)) return `the current tree holds no ${theClass.name}#${method.name} with the parameters of the model`;
  }
  return null;
};
