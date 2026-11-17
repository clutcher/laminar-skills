import { isAText, isATestFileOfTheModel, readHeadTypeName, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

// The config zone wires the application, so a type there is no part of the business.
const CONFIG_ZONE = "config";

const RECORD_KIND_WORD = /\brecord\b/;

// A constant of a class is written in upper case in Java, Kotlin, TypeScript and Python, so its name marks it where the model has no mark of its own.
const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/;

const CONSTRUCTOR_NAMES = new Set(["constructor", "__init__", "init"]);

const escapeForAPattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readSimpleName = theClass => String(theClass.name || "").split(".").pop();

const isAConstant = field => CONSTANT_NAME.test(String(field.name || ""));

const isAConstructor = (theClass, method) => method.name === readSimpleName(theClass) || CONSTRUCTOR_NAMES.has(method.name);

const isAChangedDataType = (model, theClass) => model.isChangedClass(theClass)
  && RECORD_KIND_WORD.test(String(theClass.kindWord || ""))
  && theClass.zone !== CONFIG_ZONE
  && !isATestFileOfTheModel(model, theClass.file || "");

// The constants of other classes whose type is the record, each as Class.FIELD.
const listConstantsOfOtherClasses = (model, theType) => model.classes
  .filter(other => other !== theType)
  .flatMap(other => readList(other.fields)
    .filter(field => isAConstant(field) && readHeadTypeName(field.type) === readSimpleName(theType))
    .map(field => `${other.name}.${field.name}`));

// A body outside a constructor that creates the record, by new or by a call of its name as in Kotlin and Python, makes an instance that is no constant.
const isCreatedInABody = (model, theType) => {
  const creation = new RegExp(String.raw`\bnew\s+${escapeForAPattern(readSimpleName(theType))}\s*\(|(?<![\w.])${escapeForAPattern(readSimpleName(theType))}\s*\(`);
  return model.classes.some(other => readList(other.methods).some(method => isAText(method.body) && !isAConstructor(other, method) && creation.test(method.body)));
};

const findConstantInstanceDefect = (model, theType) => {
  const constants = listConstantsOfOtherClasses(model, theType);
  if (constants.length === 0 || isCreatedInABody(model, theType)) return null;

  return createRecheckDefect(
    DEFECT_CODES.RECORD_ONLY_IN_CONSTANTS,
    model.getClassPath(theType),
    `${theType.name} is a ${model.getKindOfClass(theType)} record whose only instances are constants of other classes, ${constants.join(", ")}, and no body of the model creates it`,
  );
};

// A record whose every instance is a constant of another class keeps a fixed set of values apart from the rule that reads them, so a reader of the rule must find the values in other classes. It is a recheck case, because the model may not show a body that creates the record, and the record may still be a thing of the domain.
export const findConstantInstanceDefects = model => model.classes
  .filter(theClass => isAChangedDataType(model, theClass))
  .map(theClass => findConstantInstanceDefect(model, theClass))
  .filter(defect => defect !== null);
