import { KINDS, isAText, isATestFileOfTheModel, readFolderOfTheFile, readHeadTypeName, readList, readTypeNames } from "../model/DesignModel.mjs";
import { isAMapType } from "./CollectionNames.mjs";
import { DEFECT_CODES, createDefect, createRecheckDefect } from "./DesignDefect.mjs";
import { isALanguageCollection } from "./SimplestForm.mjs";

export const REPRESENTS = Object.freeze({ DOMAIN_OBJECT: "domain object", CARRIER: "carrier", WORK: "work", SUPPORT: "support", CONTRACT: "contract", TRANSLATOR: "translator" });

const REPRESENTS_VALUES = Object.values(REPRESENTS);

// The config zone wires the application, so its classes take no kind.
const CONFIG_ZONE = "config";

// A failure type is named for its failure in every stack the skill reads, so its name or the name of the type it extends ends in Exception or Error.
const FAILURE_TYPE_NAME = /(?:Exception|Error)$/;

// A constant of a class is written in upper case in Java, Kotlin, TypeScript and Python, so its name marks it where the model has no mark of its own.
const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/;

// An enum of the language or a sealed root declares a closed set by its kind word in Java, Kotlin and TypeScript.
const CLOSED_SET_KIND_WORD = /\b(?:enum|sealed)\b/;

// Python declares a closed set as a class that extends 1 of the enum types of its standard library.
const LANGUAGE_ENUM_TYPE = /^(?:enum\.)?(?:Enum|IntEnum|StrEnum|Flag|IntFlag)$/;

const PUBLIC_VISIBILITY = "public";

// Each kind against the zones where it never stands, or the zones where it always stands, as the backend layout of the book places them.
const ZONE_RULES = Object.freeze([
  { kinds: [REPRESENTS.DOMAIN_OBJECT, REPRESENTS.WORK], zones: ["in", "out"], standsInside: false },
  { kinds: [REPRESENTS.CARRIER], zones: ["domain", CONFIG_ZONE], standsInside: false },
  { kinds: [REPRESENTS.CONTRACT], zones: ["api", "spi", "out"], standsInside: true },
  { kinds: [REPRESENTS.TRANSLATOR], zones: ["in", "out"], standsInside: true },
]);

const isAConstant = field => CONSTANT_NAME.test(String(field.name || ""));

const readLastNamePiece = name => String(name || "").split(".").pop();

const listParentNames = theClass => [...readList(theClass.extends), ...readList(theClass.implements)].map(readHeadTypeName);

const listFailureTypeNamesOfTheExits = model => new Set(readList(model.decisions.exits).flatMap(exit => readTypeNames(exit.failure?.failed)));

const isAFailureType = (theClass, failureTypeNames) => failureTypeNames.has(theClass.name)
  || failureTypeNames.has(readLastNamePiece(theClass.name))
  || [theClass.name, ...readList(theClass.extends)].some(name => FAILURE_TYPE_NAME.test(String(name || "")));

const needsAKind = (model, theClass, failureTypeNames) => model.getKindOfClass(theClass) === KINDS.CREATED
  && !isATestFileOfTheModel(model, theClass.file || "")
  && theClass.zone !== CONFIG_ZONE
  && !isAFailureType(theClass, failureTypeNames);

const isNestedIn = (theClass, outerClass) => theClass.file === outerClass.file && String(theClass.name || "").startsWith(`${outerClass.name}.`);

const standsInTheFolderOrBelow = (theClass, otherClass) => {
  const folder = readFolderOfTheFile(otherClass.file);
  const ownFolder = readFolderOfTheFile(theClass.file);
  return ownFolder === folder || ownFolder.startsWith(`${folder}/`);
};

const isACaseOf = (model, theClass, rootClass) => listParentNames(theClass).some(name => model.findClassOfTheType(name, theClass) === rootClass);

// A root whose constants are all instances of its own cases, such as a sealed interface of 2 cases in a language that has no sealed word.
const holdsOnlyConstantsOfItsCases = (model, theClass) => {
  const fields = readList(theClass.fields);
  if (!fields.length || !fields.every(isAConstant)) return false;

  return fields.every(field => {
    const caseClass = model.findClassOfTheType(readHeadTypeName(field.type), theClass);
    return caseClass !== null && isACaseOf(model, caseClass, theClass);
  });
};

const isAClosedSetRoot = (model, theClass) => CLOSED_SET_KIND_WORD.test(String(theClass.kindWord || ""))
  || listParentNames(theClass).some(name => LANGUAGE_ENUM_TYPE.test(name))
  || holdsOnlyConstantsOfItsCases(model, theClass);

export const isAClosedSetOrACase = (model, theClass) => isAClosedSetRoot(model, theClass)
  || listParentNames(theClass).some(name => {
    const parentClass = model.findClassOfTheType(name, theClass);
    return parentClass !== null && isAClosedSetRoot(model, parentClass);
  });

// The element of a list or the value of a map is the last type name of the collection type, as in List<Loan>, Map<String, Loan> and Loan[].
const findElementClassOfTheCollection = (model, theClass, field) => {
  if (!isALanguageCollection(field.type)) return null;

  const elementClass = model.findClassOfTheType(readTypeNames(field.type).pop(), theClass);
  return elementClass === theClass ? null : elementClass;
};

const describeFieldsWithoutData = (model, theClass) => {
  const fields = readList(theClass.fields);
  const instanceFields = fields.filter(field => !isAConstant(field));
  if (fields.length && !instanceFields.length) return `its fields are only constants: ${fields.map(field => field.name).join(", ")}`;
  if (instanceFields.length !== 1) return "";

  const elementClass = findElementClassOfTheCollection(model, theClass, instanceFields[0]);
  return elementClass ? `its only instance field, ${instanceFields[0].name}, is a collection of ${elementClass.name}, another class of the model` : "";
};

// The names a type holds, with the key of a map left out, because a map holds its values and only finds them by the key.
const listContainedTypeNames = typeText => {
  const typeNames = readTypeNames(typeText);
  if (isAMapType(typeText) && typeNames.length > 2) typeNames.splice(1, 1);
  return typeNames;
};

const isAPublicMethod = method => !isAText(method.visibility) || method.visibility === PUBLIC_VISIBILITY;

const listTypeTextsOfTheWhole = theClass => [
  ...readList(theClass.fields).map(field => field.type),
  ...readList(theClass.methods).filter(isAPublicMethod).flatMap(method => [method.returns, ...readList(method.parameters).map(parameter => parameter.type)]),
];

const holdsTheType = (model, wholeClass, partClass) => isNestedIn(partClass, wholeClass)
  || listTypeTextsOfTheWhole(wholeClass).flatMap(listContainedTypeNames).some(typeName => model.findClassOfTheType(typeName, wholeClass) === partClass);

class KindCheck {
  constructor(model, zoneOrder) {
    this.model = model;
    this.zoneOrder = zoneOrder;
    this.defects = [];
  }

  addDefect(theClass, key, sentence) {
    this.defects.push(createDefect(DEFECT_CODES.KIND_DOES_NOT_FIT, `${this.model.getClassPath(theClass)}${key ? `.${key}` : ""}`, sentence));
  }

  addRecheckDefect(theClass, key, sentence, extra = {}) {
    this.defects.push({ ...createRecheckDefect(DEFECT_CODES.KIND_DOES_NOT_FIT, `${this.model.getClassPath(theClass)}${key ? `.${key}` : ""}`, sentence), ...extra });
  }

  addMissingKey(theClass, key, sentence) {
    this.defects.push(createDefect(DEFECT_CODES.KEY_MISSING, `${this.model.getClassPath(theClass)}.${key}`, sentence));
  }
}

const checkTheKeysOfTheKind = (check, theClass) => {
  if (!isAText(theClass.represents)) {
    check.addMissingKey(theClass, "represents", "the key represents is required here and is missing");
    return false;
  }
  if (!REPRESENTS_VALUES.includes(theClass.represents)) {
    check.addMissingKey(theClass, "represents", `the key represents holds ${theClass.represents}, where 1 of ${REPRESENTS_VALUES.join(", ")} is expected`);
    return false;
  }
  if (theClass.represents === REPRESENTS.SUPPORT && !readList(theClass.for).some(isAText)) check.addMissingKey(theClass, "for", "the key for is required on a support and is missing");
  if (theClass.represents !== REPRESENTS.DOMAIN_OBJECT) return true;

  const hasMadeWhen = isAText(theClass.madeWhen);
  const hasPartOf = isAText(theClass.partOf);
  if (!hasMadeWhen && !hasPartOf) check.addMissingKey(theClass, "madeWhen", "a domain object takes exactly 1 of the keys madeWhen and partOf, and this one holds neither");
  if (hasMadeWhen && hasPartOf) check.addMissingKey(theClass, "madeWhen", "a domain object takes exactly 1 of the keys madeWhen and partOf, and this one holds both");
  return true;
};

const checkThePlaceOfTheSupport = (check, theClass) => {
  const forNames = readList(theClass.for).filter(isAText);
  if (!forNames.length) return;

  const forClasses = forNames.map(name => check.model.findClass(name)).filter(forClass => forClass !== null);
  if (!forClasses.some(forClass => isNestedIn(theClass, forClass) || standsInTheFolderOrBelow(theClass, forClass))) {
    check.addDefect(theClass, "for", `${theClass.name} is a support of ${forNames.join(", ")}, and it stands neither nested in such a class nor in the folder of such a class or a folder below it`);
  }
  for (const forClass of forClasses) {
    if (forClass.represents !== REPRESENTS.DOMAIN_OBJECT && forClass.represents !== REPRESENTS.CARRIER) continue;
    check.addDefect(theClass, "for", `${theClass.name} is a support of ${forClass.name}, which the model marks ${forClass.represents}`);
  }
};

const checkTheFieldsOfTheDomainObject = (check, theClass) => {
  if (isAClosedSetOrACase(check.model, theClass)) return;

  const description = describeFieldsWithoutData(check.model, theClass);
  if (!description) return;
  check.addRecheckDefect(theClass, "", `${theClass.name} is marked domain object, and ${description}; only a reason that names a method of the type, as Type#method, whose body holds a rule outside construction closes this case`, { closedOnlyByARule: true });
};

// A rule of where a kind always stands holds only where the zone order names the zone of the class and every zone of the rule, so a project zone order with other names asks nothing of it.
const breaksTheZoneRule = (zoneOrder, zoneRule, zone) => {
  if (!zoneRule.standsInside) return zoneRule.zones.includes(zone);
  return zoneOrder.namesTheZone(zone) && zoneRule.zones.every(ruleZone => zoneOrder.namesTheZone(ruleZone)) && !zoneRule.zones.includes(zone);
};

const checkTheKindAgainstTheZone = (check, theClass) => {
  const { zone } = theClass;
  if (!check.zoneOrder || !isAText(zone) || !check.zoneOrder.appliesToTheFolder(readFolderOfTheFile(theClass.file))) return;

  const brokenRule = ZONE_RULES.find(zoneRule => zoneRule.kinds.includes(theClass.represents) && breaksTheZoneRule(check.zoneOrder, zoneRule, zone));
  if (brokenRule) check.addRecheckDefect(theClass, "zone", `${theClass.name} is marked ${theClass.represents} and stands in the zone ${zone}`);
};

const checkTheWhole = (check, theClass) => {
  if (!isAText(theClass.partOf) || isAText(theClass.madeWhen)) return;

  const wholeClass = check.model.findClass(theClass.partOf);
  if (wholeClass === null) {
    check.addDefect(theClass, "partOf", `${theClass.name} is part of ${theClass.partOf}, which names no class of the model`);
    return;
  }
  if (wholeClass.represents !== REPRESENTS.DOMAIN_OBJECT) {
    check.addDefect(theClass, "partOf", `${theClass.name} is part of ${wholeClass.name}, which the model does not mark domain object`);
    return;
  }
  if (holdsTheType(check.model, wholeClass, theClass)) return;
  check.addDefect(theClass, "partOf", `${theClass.name} is part of ${wholeClass.name}, which holds it in no field, no element or value of a collection or map field, no parameter or return type of a public method, and not as a nested type`);
};

const checkTheKindOfTheClass = (check, theClass) => {
  if (!checkTheKeysOfTheKind(check, theClass)) return;

  if (theClass.represents === REPRESENTS.SUPPORT) checkThePlaceOfTheSupport(check, theClass);
  if (theClass.represents === REPRESENTS.DOMAIN_OBJECT) {
    checkTheFieldsOfTheDomainObject(check, theClass);
    checkTheWhole(check, theClass);
  }
  checkTheKindAgainstTheZone(check, theClass);
};

// The check of the kinds: each class of a created file outside a test file, the config zone and the failure types holds its kind under represents, and the model must agree with that kind. It reads only that the model agrees with itself, never whether the business names the thing.
export const findRepresentedKindDefects = (model, zoneOrder) => {
  const check = new KindCheck(model, zoneOrder);
  const failureTypeNames = listFailureTypeNamesOfTheExits(model);
  for (const theClass of model.classes.filter(other => needsAKind(model, other, failureTypeNames))) checkTheKindOfTheClass(check, theClass);
  return check.defects;
};
