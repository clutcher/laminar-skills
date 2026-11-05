import { KINDS, isAText, readList } from "../model/DesignModel.mjs";
import { readDeclaredFieldNames, readFieldLanguage } from "./DeclaredFields.mjs";
import { DEFECT_CODES, createDefect } from "./DesignDefect.mjs";

const listClassesOfModifiedFiles = model => model.classes.filter(theClass => isAText(theClass.file) && model.findChildOfTheFile(theClass.file)?.kind === KINDS.MODIFIED);

const findUnlistedFieldDefects = (model, theClass, currentText) => {
  const declaredNames = readDeclaredFieldNames(currentText, theClass.file, theClass.name);
  if (!declaredNames) return [];

  const listedNames = new Set([...readList(theClass.fields).flatMap(field => [field.name, field.oldName]), ...readList(theClass.removed)]);
  return [...declaredNames]
    .filter(fieldName => !listedNames.has(fieldName))
    .map(fieldName => createDefect(DEFECT_CODES.FIELD_UNLISTED, `${model.getClassPath(theClass)}.fields`, `the current file ${theClass.file} declares the field ${fieldName} of ${theClass.name}, a modified class, and the model neither lists it under fields nor under removed`));
};

const describeFieldCheck = uncheckedFiles => {
  const unchecked = uncheckedFiles.length ? `; not checked, in a language it does not read: ${uncheckedFiles.join(", ")}` : "";
  return `field check: reads the fields of modified classes in Java, JavaScript and TypeScript${unchecked}`;
};

// A modified class is judged whole by the review, so the model lists every field the current file declares for it.
export const findFieldListResult = (model, currentTree) => {
  const defects = [];
  const uncheckedFiles = new Set();
  for (const theClass of listClassesOfModifiedFiles(model)) {
    if (!readFieldLanguage(theClass.file)) {
      uncheckedFiles.add(theClass.file);
      continue;
    }
    const currentText = currentTree.readFileText(theClass.file);
    if (currentText !== null) defects.push(...findUnlistedFieldDefects(model, theClass, currentText));
  }
  return { headLine: describeFieldCheck([...uncheckedFiles]), defects };
};
