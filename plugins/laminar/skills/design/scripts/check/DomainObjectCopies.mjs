import { DOES, isATestFileOfTheModel, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

const DOMAIN_ZONE = "domain";

const INTERFACE_KIND_WORD = /\binterface\b/;

const ENUM_KIND_WORD = /\benum\b/;

// A failure type is named for its failure in every stack the skill reads, so its name or the name of the type it extends ends in Exception or Error.
const FAILURE_TYPE_NAME = /(?:Exception|Error)$/;

// A constant of a class is written in upper case in Java, Kotlin, TypeScript and Python, so its name marks it where the model has no mark of its own.
const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/;

// The folders of the backend layout that hold an entry, an outside call or a setting, whose types translate to or from a domain object and so may repeat its fields.
const TRANSLATING_FOLDER_NAMES = new Set(["in", "out", "web", "config"]);

// The folders that wrap 1 module: app, in and out stand inside the module folder of the backend layout, and src inside the module folder of a build.
const MODULE_INNER_FOLDER_NAMES = new Set(["app", "in", "out", "src"]);

const MINIMUM_FIELD_COUNT = 3;

const REPEATED_SHARE = 0.8;

const readFolderNames = theClass => String(theClass.file || "").split("/").slice(0, -1);

// The module of a class is the folder above its first app, in, out or src folder, or its first folder where its path holds none.
const readModuleOfTheClass = theClass => {
  const folderNames = readFolderNames(theClass);
  const innerAt = folderNames.findIndex(folderName => MODULE_INNER_FOLDER_NAMES.has(folderName));
  return innerAt >= 0 ? folderNames.slice(0, innerAt).join("/") : folderNames[0] || "";
};

const isAFailureType = theClass => FAILURE_TYPE_NAME.test(String(theClass.name || "")) || readList(theClass.extends).some(name => FAILURE_TYPE_NAME.test(String(name)));

// Where no zone order applies the model gives no zone, so a class without a zone stands in the domain unless a folder of its path is an in, out, web or config folder.
const standsInTheDomain = theClass => {
  if (theClass.zone !== undefined) return theClass.zone === DOMAIN_ZONE;
  return !readFolderNames(theClass).some(folderName => TRANSLATING_FOLDER_NAMES.has(folderName));
};

const isADomainObject = (model, theClass) => standsInTheDomain(theClass)
  && !isATestFileOfTheModel(model, theClass.file || "")
  && !model.isRemovedClass(theClass)
  && !INTERFACE_KIND_WORD.test(String(theClass.kindWord || ""))
  && !ENUM_KIND_WORD.test(String(theClass.kindWord || ""))
  && !isAFailureType(theClass)
  && (theClass.does === undefined || theClass.does === DOES.COMPUTES);

const listInstanceFieldNames = theClass => readList(theClass.fields).map(field => String(field.name || "")).filter(name => name !== "" && !CONSTANT_NAME.test(name));

const readSupertypeNames = theClass => [...readList(theClass.extends), ...readList(theClass.implements)].map(String);

const isNestedIn = (theClass, other) => String(theClass.name || "").startsWith(`${other.name}.`);

const readOuterName = theClass => String(theClass.name || "").split(".").slice(0, -1).join(".");

// 2 cases of 1 closed set, 2 types nested in 1 type, a type nested in the other and a type that extends or implements the other share their fields by their design, not by a copy.
const areRelatedByTheirDesign = (theClass, other) => {
  const otherSupertypeNames = readSupertypeNames(other);
  if (readSupertypeNames(theClass).some(name => otherSupertypeNames.includes(name))) return true;
  if (readSupertypeNames(theClass).includes(other.name) || otherSupertypeNames.includes(theClass.name)) return true;
  if (isNestedIn(theClass, other) || isNestedIn(other, theClass)) return true;

  const outerName = readOuterName(theClass);
  return outerName !== "" && outerName === readOuterName(other);
};

const countRepeatedFieldNames = (ownNames, otherNames) => otherNames.filter(name => ownNames.includes(name)).length;

const repeatsTheFieldsOf = (ownNames, otherNames) => {
  if (ownNames.length < MINIMUM_FIELD_COUNT || otherNames.length < MINIMUM_FIELD_COUNT) return false;

  const repeatedCount = countRepeatedFieldNames(ownNames, otherNames);
  return repeatedCount / ownNames.length >= REPEATED_SHARE && repeatedCount / otherNames.length >= REPEATED_SHARE;
};

const mayCopyADomainObject = (model, theClass) => model.isChangedClass(theClass) && isADomainObject(model, theClass);

const findCopiedDomainObject = (model, theClass) => {
  const ownNames = listInstanceFieldNames(theClass);
  const theModule = readModuleOfTheClass(theClass);
  for (const other of model.classes) {
    if (other === theClass || !isADomainObject(model, other)) continue;
    if (readModuleOfTheClass(other) !== theModule || areRelatedByTheirDesign(theClass, other)) continue;
    // A pair of 2 changed types is reported once, on the type that the model lists later.
    if (mayCopyADomainObject(model, other) && model.classes.indexOf(other) > model.classes.indexOf(theClass)) continue;
    if (repeatsTheFieldsOf(ownNames, listInstanceFieldNames(other))) return other;
  }
  return null;
};

const createCopyDefect = (model, theClass, copiedObject) => {
  const otherNames = listInstanceFieldNames(copiedObject);
  const repeatedNames = listInstanceFieldNames(theClass).filter(name => otherNames.includes(name));
  return createRecheckDefect(
    DEFECT_CODES.COPIES_A_DOMAIN_OBJECT,
    model.getClassPath(theClass),
    `${theClass.name} repeats ${repeatedNames.length} of the ${otherNames.length} fields of ${copiedObject.name}, a domain object of the same module: ${repeatedNames.join(", ")}`,
  );
};

// A changed domain object whose instance fields and those of another domain object of the same module each repeat 4 in 5 or more of the other, both with 3 or more, may copy that type. It is a recheck case, because only the business tells whether the 2 are 1 thing of the domain or 2 things that hold the same values today.
export const findDomainObjectCopyDefects = model => {
  const defects = [];
  for (const theClass of model.classes) {
    if (!mayCopyADomainObject(model, theClass)) continue;

    const copiedObject = findCopiedDomainObject(model, theClass);
    if (copiedObject) defects.push(createCopyDefect(model, theClass, copiedObject));
  }
  return defects;
};
