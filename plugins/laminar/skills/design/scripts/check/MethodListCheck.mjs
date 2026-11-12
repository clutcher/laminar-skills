import { isATestFileOfTheModel, readList, readOldTypeName } from "../model/DesignModel.mjs";
import { readMemberLanguage } from "./ClassDeclaration.mjs";
import { readDeclaredPublicMethodNames } from "./DeclaredMethods.mjs";
import { DEFECT_CODES, createDefect } from "./DesignDefect.mjs";

// The names under which the model lists a method of the class: each method by its name or its old name, each removed name, and in a record each field, whose accessor carries its name.
const listListedMethodNames = theClass => [
  ...readList(theClass.methods).flatMap(method => [method.name, method.oldName]),
  ...readList(theClass.removed),
  ...(theClass.kindWord === "record" ? readList(theClass.fields).map(field => field.name) : []),
];

const createUnlistedMethodDefect = (model, theClass, methodName) => createDefect(
  DEFECT_CODES.METHOD_UNLISTED,
  `${model.getClassPath(theClass)}.methods`,
  `the current file ${theClass.file} declares the public method ${methodName} of ${theClass.name}, a modified class, and the model neither lists it under methods nor under removed, so a writer reads it as removed`,
);

const describeMethodCheck = (uncheckedFiles, unreadClasses) => {
  const uncheckedLanguage = uncheckedFiles.length ? `; not checked, in a language it does not read: ${uncheckedFiles.join(", ")}` : "";
  const uncheckedClass = unreadClasses.length ? `; not checked, no declaration of the class read in its current file: ${unreadClasses.join(", ")}` : "";
  return `method check: reads the public methods of modified classes in Java, JavaScript and TypeScript${uncheckedLanguage}${uncheckedClass}`;
};

// A modified class is judged whole by the review, and a writer reads a public method the model leaves out as removed, so the model lists every public method the current file declares for it. A class the check cannot read is named in the head line, never passed in silence.
export const findMethodListResult = (model, currentTree) => {
  const defects = [];
  const uncheckedFiles = new Set();
  const unreadClasses = [];
  for (const theClass of model.listClassesOfModifiedFiles().filter(theClass => !isATestFileOfTheModel(model, theClass.file))) {
    if (!readMemberLanguage(theClass.file)) {
      uncheckedFiles.add(theClass.file);
      continue;
    }

    const currentText = currentTree.readFileText(theClass.file);
    const declaredNames = currentText === null ? null : readDeclaredPublicMethodNames(currentText, theClass.file, readOldTypeName(theClass) || theClass.name);
    if (!declaredNames) {
      unreadClasses.push(model.getClassDisplayName(theClass));
      continue;
    }
    const listedNames = new Set(listListedMethodNames(theClass));
    defects.push(...[...declaredNames].filter(methodName => !listedNames.has(methodName)).map(methodName => createUnlistedMethodDefect(model, theClass, methodName)));
  }
  return { headLine: describeMethodCheck([...uncheckedFiles], unreadClasses), defects };
};
