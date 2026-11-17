import { KINDS, isAText, readList, readOldTypeName } from "../model/DesignModel.mjs";
import { listDeclaredMethods } from "./DeclaredMethods.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";
import { readTreeFileOfTheClass } from "./LiteralTables.mjs";

// The kinds of a file whose current text still declares the class the model changes.
const KINDS_OF_A_CHANGED_FILE = new Set([KINDS.MODIFIED, KINDS.MOVED]);

const escapeTheName = name => name.replace(/[$]/g, "\\$");

// A call of the method by its bare name or on this, or a reference to it after 2 colons; a call on another object names a method of another type.
const callsTheMethod = (bodyText, methodName) => new RegExp(`(?:(?:^|[^\\w$.])|\\bthis\\.)${escapeTheName(methodName)}\\s*\\(|::${escapeTheName(methodName)}\\b`).test(bodyText);

const readCurrentTypeName = theClass => (isAText(theClass.oldName) ? readOldTypeName(theClass) : theClass.name);

const listCallerNames = (declaredMethods, methodName) => [...new Set(declaredMethods.filter(declared => declared.name !== methodName && callsTheMethod(declared.bodyText, methodName)).map(declared => declared.name))];

const describeTheLoss = (typeName, methodName, callerNames) => `${typeName} loses ${methodName}, which has no body in the current tree and which ${callerNames.map(callerName => `${typeName}#${callerName}`).join(", ")} calls; a library or an implementing class wrote the body of ${methodName}; name the method of the model that now does its work, with its \`body\`, or keep ${methodName}, renamed by \`oldName\``;

// A name of removed whose declaration in the current file has no body, and that another method of the same type calls, leaves that caller without the body a library or an implementing class wrote, so the model must name the method that now does its work. It is a recheck case, because an implementing class can go with the method.
export const findRemovedBodilessMethodDefects = (model, currentTree) => {
  const defects = [];
  for (const theClass of model.classes) {
    const removedNames = readList(theClass.removed);
    if (!removedNames.length || !isAText(theClass.file) || !KINDS_OF_A_CHANGED_FILE.has(model.getKindOfClass(theClass))) continue;

    const file = readTreeFileOfTheClass(model, theClass);
    const text = currentTree.readFileText(file);
    const declaredMethods = isAText(text) ? listDeclaredMethods(text, file, readCurrentTypeName(theClass)) : null;
    if (!declaredMethods) continue;

    const typeName = model.getClassDisplayName(theClass);
    removedNames.forEach((removedName, at) => {
      if (!declaredMethods.some(declared => declared.name === removedName && declared.isBodiless)) return;

      const callerNames = listCallerNames(declaredMethods, removedName);
      if (callerNames.length) defects.push(createRecheckDefect(DEFECT_CODES.REMOVED_BODILESS_METHOD, `${model.getClassPath(theClass)}.removed[${at}]`, describeTheLoss(typeName, removedName, callerNames)));
    });
  }
  return defects;
};
