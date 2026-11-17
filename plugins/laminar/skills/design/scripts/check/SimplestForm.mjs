import { KINDS, isAText, isAnInterface, isATestFileOfTheModel, readHeadTypeName, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

// A collection type of the language, by the head of its type name: a list, a set, a map or an array.
const LANGUAGE_COLLECTION = /^(?:(?:java\.util\.)?(?:List|ArrayList|LinkedList|Set|HashSet|LinkedHashSet|TreeSet|SortedSet|Map|HashMap|LinkedHashMap|TreeMap|SortedMap|Collection|Deque|Queue|Array|ReadonlyArray|ReadonlyMap|ReadonlySet|Record)\b|.*\[\]$|(?:list|dict|set|tuple|Sequence|Mapping)\b)/;

// The config zone wires the application, so a type there, such as a test double, is no part of the business that a service could hold.
const CONFIG_ZONE = "config";

const INTERFACE_OR_ENUM_KIND_WORD = /\b(?:interface|enum)\b/;

// A constant of a class is written in upper case in Java, Kotlin, TypeScript and Python, so its name marks it where the model has no mark of its own.
const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/;

const CONSTRUCTOR_NAMES = new Set(["constructor", "__init__", "init"]);

// A loop, a choice among cases and a do block repeat or choose in every language the skill reads, so each is a rule of its own.
const LOOP_OR_CHOICE = /\b(?:for|while|do|switch|case)\b/;

// A stream or array step that filters, maps, sorts, counts or folds the elements computes an answer over them in Java, Kotlin, TypeScript and Python.
const COMPUTING_STEP = /\.(?:filter|map|flatMap|mapToInt|mapToLong|mapToDouble|reduce|sum|collect|sorted|anyMatch|allMatch|noneMatch|count|min|max|average|distinct|limit|skip|groupingBy|partitioningBy|some|every|find|findIndex)\s*\(/;

// A comparison, an arithmetic or logical operator or a choice by ? computes or decides, so outside an absence test it is a rule.
const OPERATOR = /<=|>=|[<>+*/%]|&&|\|\||\s-\s|\?/;

const EQUALITY_MARK = /!==?|===?/g;

// The absence test of the element just read: a comparison with null, undefined or None, or a call that asks whether the collection holds it.
const ABSENCE_TEST = /^\s*!?\s*(?:[\w.]+\s*[=!]==?\s*(?:null|undefined|None)|[\w.]+\s+is\s+(?:not\s+)?None|[\w.]+\.(?:isEmpty|isPresent|containsKey|contains|has|includes)\s*\([^()]*\))\s*$/;

// The calls that only read a collection or make a read-only view or copy of it in Java, Kotlin, TypeScript and Python, and the keywords that a call pattern also meets.
const COLLECTION_READ_NAMES = new Set([
  "get", "getOrDefault", "containsKey", "containsValue", "contains", "has", "includes", "size", "length", "isEmpty", "stream", "iterator", "forEach",
  "values", "keySet", "entrySet", "keys", "entries", "items", "copyOf", "of", "ofNullable", "orElseThrow", "orElse", "orElseGet", "toList", "at",
  "unmodifiableList", "unmodifiableMap", "unmodifiableSet", "unmodifiableCollection", "requireNonNull", "asList", "slice", "len", "list", "dict", "tuple", "iter",
  "if", "return", "throw", "new", "this", "super",
]);

// A failure type is named for its failure in every stack the skill reads, so its name ends in Exception or Error.
const FAILURE_TYPE_NAME = /(?:Exception|Error)$/;

// A type of the language that a read body may create, such as a copy of the collection.
const LANGUAGE_COLLECTION_CREATION = /^(?:Array|Hash|Linked|Tree)/;

const TYPE_ARGUMENTS = /<[\w\s,.?[\]]*>/g;

// Type arguments nest at most this deep in the bodies of a model, and each pass removes 1 depth.
const TYPE_ARGUMENT_DEPTH = 4;

const QUOTED_TEXT = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`/g;

const ARROW = /->|=>/g;

const CALL = /(?:new\s+)?([\w$]+)\s*\(/g;

const IF_KEYWORD = /\bif\b/g;

const IF_START = /\bif\s*\(/g;

const ZONES_OF_A_LAYOUT_SPLIT = new Set(["api", "spi"]);

const DEPTH_TAKERS_OF_A_SECOND_ANSWER = new Set(["forecast", "user"]);

const isACreatedClass = (model, theClass) => model.getKindOfClass(theClass) === KINDS.CREATED;

const isALanguageCollection = type => LANGUAGE_COLLECTION.test(String(type || "").trim());

const isAConstant = field => CONSTANT_NAME.test(String(field.name || ""));

const readSimpleName = theClass => String(theClass.name || "").split(".").pop();

const isAConstructor = (theClass, method) => method.name === readSimpleName(theClass) || CONSTRUCTOR_NAMES.has(method.name);

const isAFactoryOfItsClass = (theClass, method) => readHeadTypeName(method.returns || "") === readSimpleName(theClass);

const namesTheMethod = (text, method) => isAText(method.name) && text.split(/[^\w$]+/).includes(method.name);

// The constructors, the factory methods that return the class, and the private methods that they name: each runs once at creation, so a check of the input there is no rule over the elements.
const listConstructionMethods = theClass => {
  const methods = readList(theClass.methods);
  const creatingMethods = methods.filter(method => isAConstructor(theClass, method) || isAFactoryOfItsClass(theClass, method));
  const creatingText = creatingMethods.map(method => `${method.body || ""} ${readList(method.uses).join(" ")}`).join(" ");
  const privateSteps = methods.filter(method => method.visibility === "private" && namesTheMethod(creatingText, method));
  return new Set([...creatingMethods, ...privateSteps]);
};

const removeTextsAndTypeArguments = body => {
  let text = body.replace(QUOTED_TEXT, '""').replace(ARROW, " ARROW ");
  for (let depth = 0; depth < TYPE_ARGUMENT_DEPTH; depth++) text = text.replace(TYPE_ARGUMENTS, "");
  return text;
};

const listIfConditions = text => {
  const conditions = [];
  for (const match of text.matchAll(IF_START)) {
    let depth = 1;
    let index = match.index + match[0].length;
    while (index < text.length && depth > 0) {
      if (text[index] === "(") depth++;
      if (text[index] === ")") depth--;
      index++;
    }
    conditions.push(text.slice(match.index + match[0].length, index - 1));
  }
  return conditions;
};

const isACallOutsideTheReads = call => !COLLECTION_READ_NAMES.has(call.name) && !FAILURE_TYPE_NAME.test(call.name) && !/^[A-Z]/.test(call.name);

const isACreationOfAnotherType = call => call.created && !FAILURE_TYPE_NAME.test(call.name) && !LANGUAGE_COLLECTION.test(call.name) && !LANGUAGE_COLLECTION_CREATION.test(call.name);

// A body reads its collection where it holds no loop, no computing step, no operator, no call but a read of the collection or the creation of a failure type, and no condition but an absence test; an if that is not written in parentheses, as in Python, counts as a rule.
const holdsARuleInTheBody = body => {
  const text = removeTextsAndTypeArguments(body);
  if (LOOP_OR_CHOICE.test(text) || COMPUTING_STEP.test(text)) return true;

  const conditions = listIfConditions(text);
  if (conditions.length !== (text.match(IF_KEYWORD) || []).length || conditions.some(condition => !ABSENCE_TEST.test(condition))) return true;

  const textWithoutConditions = conditions.reduce((rest, condition) => rest.replace(condition, ""), text);
  if (OPERATOR.test(textWithoutConditions.replace(EQUALITY_MARK, ""))) return true;

  const calls = [...text.matchAll(CALL)].map(match => ({ name: match[1], created: match[0].startsWith("new") }));
  return calls.some(call => isACallOutsideTheReads(call) || isACreationOfAnotherType(call));
};

// A method with no body is read as a read, as the model shows no rule in it.
const holdsARuleOutsideConstruction = (constructionMethods, method) => !constructionMethods.has(method) && isAText(method.body) && holdsARuleInTheBody(method.body);

// A type that extends or implements another, such as an exception that carries the values it rejects, takes the role of that type, so it is more than a collection.
const takesTheRoleOfAnotherType = theClass => readList(theClass.extends).length > 0 || readList(theClass.implements).length > 0;

const isReadForTheCollectionForm = (model, theClass) => !INTERFACE_OR_ENUM_KIND_WORD.test(String(theClass.kindWord || ""))
  && theClass.zone !== CONFIG_ZONE
  && !isATestFileOfTheModel(model, theClass.file || "");

// The 1 field that is no constant, where it is a collection of the language and no method of the class holds a rule outside construction; null otherwise.
const findTheOnlyCollection = theClass => {
  const instanceFields = readList(theClass.fields).filter(field => !isAConstant(field));
  if (takesTheRoleOfAnotherType(theClass) || instanceFields.length !== 1 || !isALanguageCollection(instanceFields[0].type)) return null;

  const constructionMethods = listConstructionMethods(theClass);
  return readList(theClass.methods).some(method => holdsARuleOutsideConstruction(constructionMethods, method)) ? null : instanceFields[0];
};

const findTheCollectionTypeDefect = (model, theClass, collection) => createRecheckDefect(
  DEFECT_CODES.TYPE_HOLDS_ONLY_A_COLLECTION,
  model.getClassPath(theClass),
  `${theClass.name} is a created type whose only field that is no constant is the collection ${collection.type} of the language, and its methods only fill it at creation or read it; hold the collection as a field of the service that uses it and make the lookup a method of that service; keep the type only where it decides something the service could not`,
);

// An answer under scriptCases closes the collection case only where it names a method of the type whose body holds a rule outside construction, because a new name or a reason that restates the field shows no decision that the service could not make.
export const namesAMethodWithARule = (model, theClass, reason) => {
  const words = String(reason || "").split(/[\s,;:()`'"]+/).map(word => word.replace(/\.+$/, ""));
  const constructionMethods = listConstructionMethods(theClass);
  return readList(theClass.methods).some(method => holdsARuleOutsideConstruction(constructionMethods, method) && words.includes(model.getMethodDisplayName(theClass, method)));
};

const isInALayoutSplit = theClass => ZONES_OF_A_LAYOUT_SPLIT.has(theClass.zone) || String(theClass.file || "").split("/").some(segment => ZONES_OF_A_LAYOUT_SPLIT.has(segment));

const listImplementations = (model, theInterface) => model.classes.filter(theClass => readList(theClass.implements).includes(theInterface.name));

// A depth that the user or a forecast took names the interface as its owner or in its shape, so the second answer is on record.
const isNamedByASecondAnswer = (model, theInterface) => readList(model.decisions.owners).some(owner => owner.depth
  && DEPTH_TAKERS_OF_A_SECOND_ANSWER.has(owner.depth.takenBy)
  && (owner.owner === theInterface.name || String(owner.depth.shape || "").includes(theInterface.name)));

const findTheSingleImplementationDefect = (model, theInterface, implementation) => createRecheckDefect(
  DEFECT_CODES.INTERFACE_WITH_ONE_IMPLEMENTATION,
  model.getClassPath(theInterface),
  `${theInterface.name} is a created interface that only ${implementation.name} implements in the model, outside api and spi, and no depth that the user or a forecast took names it`,
);

// The 2 forms that are larger than the change needs where nothing varies: a created type that only holds a collection of the language, and a created interface with 1 implementation that no layout split and no second answer asks for. Each is a recheck case, because a rule or a second answer can stand outside what the model shows.
export const findSimplestFormDefects = model => {
  const defects = [];
  for (const theClass of model.classes.filter(other => isACreatedClass(model, other))) {
    const collection = isReadForTheCollectionForm(model, theClass) ? findTheOnlyCollection(theClass) : null;
    if (collection) defects.push(findTheCollectionTypeDefect(model, theClass, collection));
    if (!isAnInterface(theClass) || isInALayoutSplit(theClass) || isNamedByASecondAnswer(model, theClass)) continue;

    const implementations = listImplementations(model, theClass);
    if (implementations.length === 1) defects.push(findTheSingleImplementationDefect(model, theClass, implementations[0]));
  }
  return defects;
};
