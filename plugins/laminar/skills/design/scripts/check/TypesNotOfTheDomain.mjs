import { DOES, KINDS, isATestFileOfTheModel, readHeadTypeName, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

const DOMAIN_ZONE = "domain";

const INTERFACE_KIND_WORD = /\binterface\b/;

const ENUM_KIND_WORD = /\benum\b/;

const RECORD_KIND_WORD = /\brecord\b/;

// A failure type is named for its failure in every stack the skill reads, so its name or the name of the type it extends ends in Exception or Error.
const FAILURE_TYPE_NAME = /(?:Exception|Error)$/;

// A constant of a class is written in upper case in Java, Kotlin, TypeScript and Python, so its name marks it where the model has no mark of its own.
const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/;

// A function type of the language: a function interface of Java, Callable of Python, or an arrow type of TypeScript and Kotlin.
const FUNCTION_TYPE = /^(?:(?:java\.util\.function\.)?(?:Supplier|Consumer|BiConsumer|Function|BiFunction|Predicate|BiPredicate|UnaryOperator|BinaryOperator|Runnable|Callable)\b|(?:typing\.)?Callable\[|.*(?:=>|->))/;

const isATypeThatMayPose = (model, theClass) => model.getKindOfClass(theClass) === KINDS.CREATED
  && theClass.zone === DOMAIN_ZONE
  && !isATestFileOfTheModel(model, theClass.file || "")
  && !INTERFACE_KIND_WORD.test(String(theClass.kindWord || ""))
  && !ENUM_KIND_WORD.test(String(theClass.kindWord || ""))
  && !isAFailureType(theClass)
  && (theClass.does === undefined || theClass.does === DOES.COMPUTES)
  && readList(theClass.fields).length > 0;

const isAFailureType = theClass => FAILURE_TYPE_NAME.test(String(theClass.name || "")) || readList(theClass.extends).some(name => FAILURE_TYPE_NAME.test(String(name)));

const isAConstant = field => CONSTANT_NAME.test(String(field.name || ""));

const isAFunctionOrAConstant = field => FUNCTION_TYPE.test(String(field.type || "").trim()) || isAConstant(field);

const readSimpleName = theClass => String(theClass.name || "").split(".").pop();

const isAConstructor = (theClass, method) => method.name === readSimpleName(theClass);

// A type whose methods use its constants makes its decision with them, such as a policy that owns the values of its rule, so a type of constants alone has no method but its constructor.
const holdsFunctionsOrConstantsAlone = theClass => {
  const fields = readList(theClass.fields);
  if (!fields.every(isAFunctionOrAConstant)) return false;

  return fields.some(field => !isAConstant(field)) || readList(theClass.methods).every(method => isAConstructor(theClass, method));
};

// A type that extends or implements a class of the model is a case of that class, such as a case of a closed set, so it takes the role of that class.
const takesTheRoleOfAClassOfTheModel = (model, theClass) => [...readList(theClass.extends), ...readList(theClass.implements)].some(name => model.findClassOfTheType(name, theClass) !== null);

const findConstantOfItsOwnType = (model, theClass) => readList(theClass.fields)
  .find(field => isAConstant(field) && model.findClassOfTheType(readHeadTypeName(field.type), theClass) === theClass) || null;

const createFunctionsOrConstantsDefect = (model, theClass) => createRecheckDefect(
  DEFECT_CODES.TYPE_NOT_OF_THE_DOMAIN,
  model.getClassPath(theClass),
  `${theClass.name} is a created type of the domain zone whose fields are all functions or constants: ${readList(theClass.fields).map(field => field.name).join(", ")}`,
);

const createOwnConstantDefect = (model, theClass, constant) => createRecheckDefect(
  DEFECT_CODES.TYPE_NOT_OF_THE_DOMAIN,
  model.getClassPath(theClass),
  `${theClass.name} is a created record of the domain zone that holds ${constant.name}, a constant of its own type`,
);

const findDefectOfTheType = (model, theClass) => {
  if (!takesTheRoleOfAClassOfTheModel(model, theClass) && holdsFunctionsOrConstantsAlone(theClass)) return createFunctionsOrConstantsDefect(model, theClass);
  if (!RECORD_KIND_WORD.test(String(theClass.kindWord || ""))) return null;

  const constant = findConstantOfItsOwnType(model, theClass);
  return constant ? createOwnConstantDefect(model, theClass, constant) : null;
};

// 2 forms of a created type of the domain zone that may gather values for 1 piece of work and not be a thing of the domain: a type whose fields are all functions or constants, with no method but its constructor where all are constants, and a record whose instances are constants of its own type. Each is a recheck case, because only the name of the type and the meaning of its parts tell whether the business names it.
export const findTypeNotOfTheDomainDefects = model => model.classes
  .filter(theClass => isATypeThatMayPose(model, theClass))
  .map(theClass => findDefectOfTheType(model, theClass))
  .filter(defect => defect !== null);
