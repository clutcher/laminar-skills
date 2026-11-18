import { KINDS, isAText, isAnInterface, isATestFileOfTheModel, readFolderOfTheFile, readHeadTypeName, readList, readTypeNames } from "../model/DesignModel.mjs";
import { isAMapType } from "./CollectionNames.mjs";
import { DEFECT_CODES, createDefect, createRecheckDefect } from "./DesignDefect.mjs";
import { isAConstructor, isALanguageCollection } from "./SimplestForm.mjs";

export const REPRESENTS = Object.freeze({ DOMAIN_OBJECT: "domain object", CARRIER: "carrier", WORK: "work", SUPPORT: "support", CONTRACT: "contract", TRANSLATOR: "translator" });

const REPRESENTS_VALUES = Object.values(REPRESENTS);

// The marks under which a type that only 1 call returns is read as the result of that call; a carrier is that kind already, and a contract and a translator are edge code that no call answers with.
const MARKS_OF_A_RESULT_READ = new Set([REPRESENTS.DOMAIN_OBJECT, REPRESENTS.WORK, REPRESENTS.SUPPORT]);

// The config zone wires the application, so its classes take no kind.
const CONFIG_ZONE = "config";

const DOMAIN_ZONE = "domain";

// The zones of the boundary of the application: a type that a method of a class there takes or returns crosses that edge.
const BOUNDARY_ZONES = new Set(["api", "spi"]);

// The zones that store a type or hand it to another application, so a type that a method there takes or returns is kept beyond the call that made it.
const STORING_ZONES = new Set(["spi", "out"]);

// The zone of the edge that maps the result of a call for its caller, so a method there that takes the result reads it for the first time, not again.
const IN_ZONE = "in";

const SPI_ZONE = "spi";

// A wrapper of the language holds the result and is no type of the model: an optional value, or a promise or future of 1 or many values, in Java, Kotlin, TypeScript and Python.
const LANGUAGE_WRAPPER = /^(?:Optional|Promise|CompletableFuture|CompletionStage|Future|Mono|Flux|Uni|Multi|Awaitable|Coroutine)$/;

const WAYS_OUT_OF_THE_RESULT_OF_ONE_CALL = "add to the model what stores or reads the type again, or mark the type carrier and name it after the call";

const CLOSED_ONLY_BY_A_RULE = "only a reason that names a method of the type, as Type#method, whose body holds a rule outside construction closes this case";

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

export const isAConstant = field => CONSTANT_NAME.test(String(field.name || ""));

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

const holdsOnlyConstants = theClass => {
  const fields = readList(theClass.fields);
  return fields.length > 0 && fields.every(isAConstant);
};

const describeTheConstants = theClass => `its fields are only constants: ${readList(theClass.fields).map(field => field.name).join(", ")}`;

const describeTheOnlyCollection = (model, theClass) => {
  const instanceFields = readList(theClass.fields).filter(field => !isAConstant(field));
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

// The zone of a class is known where a zone order applies to its folder and names the zone domain; where it is not known, the constants form is read only on a class marked domain object, and where it is known, only in the domain zone.
const knowsTheDomainZone = (zoneOrder, theClass) => Boolean(zoneOrder)
  && isAText(theClass.zone)
  && zoneOrder.appliesToTheFolder(readFolderOfTheFile(theClass.file))
  && zoneOrder.namesTheZone(DOMAIN_ZONE);

const readsTheConstantsOfTheDomainObject = (zoneOrder, theClass) => !knowsTheDomainZone(zoneOrder, theClass) || theClass.zone === DOMAIN_ZONE;

const describeFieldsWithoutData = (check, theClass) => {
  if (!holdsOnlyConstants(theClass)) return describeTheOnlyCollection(check.model, theClass);
  return readsTheConstantsOfTheDomainObject(check.zoneOrder, theClass) ? describeTheConstants(theClass) : "";
};

const checkTheFieldsOfTheDomainObject = (check, theClass) => {
  if (isAClosedSetOrACase(check.model, theClass)) return;

  const description = describeFieldsWithoutData(check, theClass);
  if (!description) return;
  check.addRecheckDefect(theClass, "", `${theClass.name} is marked domain object, and ${description}; ${CLOSED_ONLY_BY_A_RULE}`, { closedOnlyByARule: true });
};

const holdsOnlyConstantsAndConstructors = theClass => holdsOnlyConstants(theClass) && readList(theClass.methods).every(method => isAConstructor(theClass, method));

// A class of the domain zone that holds only constants and only constructors is raised whatever its mark; a domain object takes the case from the check of its fields.
const checkTheConstantsInTheDomainZone = (check, theClass) => {
  if (theClass.represents === REPRESENTS.DOMAIN_OBJECT || theClass.zone !== DOMAIN_ZONE || !knowsTheDomainZone(check.zoneOrder, theClass)) return;
  if (!holdsOnlyConstantsAndConstructors(theClass) || isAClosedSetOrACase(check.model, theClass)) return;

  check.addRecheckDefect(theClass, "", `${theClass.name} stands in the domain zone, ${describeTheConstants(theClass)}, and its only methods are constructors; ${CLOSED_ONLY_BY_A_RULE}`, { closedOnlyByARule: true });
};

// A rule of where a kind always stands holds only where the zone order names the zone of the class and every zone of the rule, so a project zone order with other names asks nothing of it.
const breaksTheZoneRule = (zoneOrder, zoneRule, zone) => {
  if (!zoneRule.standsInside) return zoneRule.zones.includes(zone);
  return zoneOrder.namesTheZone(zone) && zoneRule.zones.every(ruleZone => zoneOrder.namesTheZone(ruleZone)) && !zoneRule.zones.includes(zone);
};

export const namesTheClass = (model, typeText, referringClass, theClass) => readTypeNames(typeText).some(typeName => model.findClassOfTheType(typeName, referringClass) === theClass);

const takesTheClass = (model, otherClass, method, theClass) => readList(method.parameters).some(parameter => namesTheClass(model, parameter.type, otherClass, theClass));

const takesOrReturnsTheClass = (model, otherClass, method, theClass) => namesTheClass(model, method.returns, otherClass, theClass) || takesTheClass(model, otherClass, method, theClass);

export const isTakenOrReturnedInTheZones = (model, theClass, zones) => model.classes.some(otherClass => zones.has(otherClass.zone)
  && readList(otherClass.methods).some(method => takesOrReturnsTheClass(model, otherClass, method, theClass)));

// A carrier in the domain zone that a method of api or spi takes or returns is a type of that boundary kept with the data types of the domain layer, a place the project may choose.
const standsInAPlaceOfTheProject = (check, theClass) => theClass.represents === REPRESENTS.CARRIER && theClass.zone === DOMAIN_ZONE
  && isTakenOrReturnedInTheZones(check.model, theClass, BOUNDARY_ZONES);

const checkTheKindAgainstTheZone = (check, theClass) => {
  const { zone } = theClass;
  if (!check.zoneOrder || !isAText(zone) || !check.zoneOrder.appliesToTheFolder(readFolderOfTheFile(theClass.file))) return;

  const brokenRule = ZONE_RULES.find(zoneRule => zoneRule.kinds.includes(theClass.represents) && breaksTheZoneRule(check.zoneOrder, zoneRule, zone));
  if (!brokenRule || standsInAPlaceOfTheProject(check, theClass)) return;
  const boundaryClause = theClass.represents === REPRESENTS.CARRIER && zone === DOMAIN_ZONE ? ", and no api or spi method takes or returns it" : "";
  check.addRecheckDefect(theClass, "zone", `${theClass.name} is marked ${theClass.represents} and stands in the zone ${zone}${boundaryClause}`);
};

// The result of a call is the head type of its return, or the element of a collection or a wrapper of the language, never a type argument of another generic type.
const readResultTypeName = typeText => {
  const typeNames = readTypeNames(typeText);
  if (isALanguageCollection(typeText) || LANGUAGE_WRAPPER.test(typeNames[0] || "")) return typeNames[typeNames.length - 1] || "";
  return typeNames[0] || "";
};

const isACallingClass = (model, otherClass) => otherClass.zone !== CONFIG_ZONE && !isATestFileOfTheModel(model, otherClass.file || "");

// A call is a method name with its parameter types, so an api method and the method that implements it count once; a method of the config zone or of a test file is wiring or a test and no call.
const listCallsThatReturnTheClass = (model, theClass) => {
  const calls = new Set();
  for (const otherClass of model.classes.filter(other => other !== theClass && isACallingClass(model, other))) {
    for (const method of readList(otherClass.methods)) {
      if (!isAPublicMethod(method) || isAConstructor(otherClass, method)) continue;
      if (model.findClassOfTheType(readResultTypeName(method.returns), otherClass) !== theClass) continue;
      calls.add(`${method.name}(${readList(method.parameters).map(parameter => parameter.type).join(", ")})`);
    }
  }
  return [...calls];
};

const isInAFieldOrNestedInAClass = (model, theClass) => model.classes.some(otherClass => otherClass !== theClass
  && (isNestedIn(theClass, otherClass) || readList(otherClass.fields).some(field => namesTheClass(model, field.type, otherClass, theClass))));

// A method of the in zone maps the result for its caller, and a method of the config zone or of a test file is wiring or a test, so only a method of another zone that takes it reads it again.
const isReadAgain = (model, theClass) => model.classes.some(otherClass => otherClass !== theClass && otherClass.zone !== IN_ZONE && isACallingClass(model, otherClass)
  && readList(otherClass.methods).some(method => takesTheClass(model, otherClass, method, theClass)));

const knowsTheStoringZone = (zoneOrder, theClass) => Boolean(zoneOrder)
  && zoneOrder.appliesToTheFolder(readFolderOfTheFile(theClass.file))
  && zoneOrder.namesTheZone(SPI_ZONE);

const holdsInstanceFields = theClass => readList(theClass.fields).some(field => !isAConstant(field));

// A type that only 1 call returns, and that nothing stores or reads again, is the result of that call; only the model can show what stores it, so the case is a defect.
const checkTheResultOfOneCall = (check, theClass) => {
  const { model } = check;
  if (!MARKS_OF_A_RESULT_READ.has(theClass.represents) || isAnInterface(theClass) || !holdsInstanceFields(theClass)) return;
  if (!knowsTheStoringZone(check.zoneOrder, theClass)) return;

  const calls = listCallsThatReturnTheClass(model, theClass);
  if (calls.length !== 1 || isInAFieldOrNestedInAClass(model, theClass) || isTakenOrReturnedInTheZones(model, theClass, STORING_ZONES) || isReadAgain(model, theClass)) return;
  check.addDefect(theClass, "represents", `${theClass.name} is marked ${theClass.represents}, and only 1 call, ${calls[0]}, returns it, while no class holds it and nothing stores it or reads it again, so it is a carrier named after that call; ${WAYS_OUT_OF_THE_RESULT_OF_ONE_CALL}`);
};

// A folder named for a type: its last name, in lower case with hyphens and underscores left out, equals the name of the type in lower case, alone or with the plural ending s or es, so nightly-job, nightly_job, nightlyjob and nightlyjobs all name NightlyJob.
const readComparableName = name => String(name || "").replace(/[-_]/g, "").toLowerCase();

const PLURAL_ENDINGS = ["", "s", "es"];

export const isTheFolderNamedFor = (folder, theClass) => {
  const folderName = readComparableName(folder.split("/").pop());
  return PLURAL_ENDINGS.some(ending => folderName === `${readComparableName(theClass.name)}${ending}`);
};

// A part of the whole is a class whose partOf names the whole or a class nested in it, so the outermost class of the named whole is compared.
const isAPartOfTheWhole = (model, otherClass, outermostWhole) => {
  const namedWhole = isAText(otherClass.partOf) ? model.findClass(otherClass.partOf) : null;
  return namedWhole !== null && model.findOutermostClass(namedWhole) === outermostWhole;
};

const listOtherClassesOfTheFolder = (model, folder, outermostPart, outermostWhole) => model.classes.filter(otherClass => otherClass !== outermostPart
  && otherClass !== outermostWhole
  && model.findOutermostClass(otherClass) === otherClass
  && readFolderOfTheFile(otherClass.file) === folder
  && !isAPartOfTheWhole(model, otherClass, outermostWhole));

// A part stands with its whole: nested in it, in a folder named for it, or in the folder of the whole where that folder holds only the whole and its parts; the outermost class of a nested whole stands in for it.
const checkThePlaceOfThePart = (check, theClass, wholeClass) => {
  const { model } = check;
  const outermostWhole = model.findOutermostClass(wholeClass);
  const outermostPart = model.findOutermostClass(theClass);
  if (outermostPart === outermostWhole) return;

  const folder = readFolderOfTheFile(outermostPart.file);
  if (isTheFolderNamedFor(folder, outermostWhole)) return;
  if (!isAText(outermostWhole.file)) return;
  const wholeFolder = readFolderOfTheFile(outermostWhole.file);
  if (folder !== wholeFolder) {
    check.addDefect(theClass, "partOf", `${theClass.name} is part of ${outermostWhole.name} and stands in ${folder}, apart from ${outermostWhole.name} in ${wholeFolder}; nest it in ${outermostWhole.name}, or put ${outermostWhole.name} and its parts into a subfolder named for ${outermostWhole.name}`);
    return;
  }
  const otherClass = listOtherClassesOfTheFolder(model, folder, outermostPart, outermostWhole)[0];
  if (!otherClass) return;
  check.addDefect(theClass, "partOf", `${theClass.name} is part of ${outermostWhole.name} and stands loose in a folder that holds ${otherClass.name}, which is neither ${outermostWhole.name} nor a part of it; nest it in ${outermostWhole.name}, or put ${outermostWhole.name} and its parts into a subfolder named for ${outermostWhole.name}`);
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
  if (!holdsTheType(check.model, wholeClass, theClass)) {
    check.addDefect(theClass, "partOf", `${theClass.name} is part of ${wholeClass.name}, which holds it in no field, no element or value of a collection or map field, no parameter or return type of a public method, and not as a nested type`);
    return;
  }
  checkThePlaceOfThePart(check, theClass, wholeClass);
};

const checkTheKindOfTheClass = (check, theClass) => {
  checkTheConstantsInTheDomainZone(check, theClass);
  if (!checkTheKeysOfTheKind(check, theClass)) return;

  if (theClass.represents === REPRESENTS.SUPPORT) checkThePlaceOfTheSupport(check, theClass);
  if (theClass.represents === REPRESENTS.DOMAIN_OBJECT) {
    checkTheFieldsOfTheDomainObject(check, theClass);
    checkTheWhole(check, theClass);
  }
  checkTheKindAgainstTheZone(check, theClass);
  checkTheResultOfOneCall(check, theClass);
};

// The check of the kinds: each class of a created file outside a test file, the config zone and the failure types holds its kind under represents, and the model must agree with that kind. It reads only that the model agrees with itself, never whether the business names the thing.
export const findRepresentedKindDefects = (model, zoneOrder) => {
  const check = new KindCheck(model, zoneOrder);
  const failureTypeNames = listFailureTypeNamesOfTheExits(model);
  for (const theClass of model.classes.filter(other => needsAKind(model, other, failureTypeNames))) checkTheKindOfTheClass(check, theClass);
  return check.defects;
};
