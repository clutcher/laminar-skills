import { KINDS, isAText, isAnInterface, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

// A collection type of the language, by the head of its type name: a list, a set, a map or an array.
const LANGUAGE_COLLECTION = /^(?:(?:java\.util\.)?(?:List|ArrayList|LinkedList|Set|HashSet|LinkedHashSet|TreeSet|SortedSet|Map|HashMap|LinkedHashMap|TreeMap|SortedMap|Collection|Deque|Queue|Array|ReadonlyArray|ReadonlyMap|ReadonlySet|Record)\b|.*\[\]$|(?:list|dict|set|tuple|Sequence|Mapping)\b)/;

// A body of 1 statement with no condition and no loop only builds or reads the collection; a branch or a second statement is a rule of its own.
const RULE_IN_A_BODY = /\b(?:if|for|while|switch|case)\b|\?|;[^;]*;/;

const ZONES_OF_A_LAYOUT_SPLIT = new Set(["api", "spi"]);

const DEPTH_TAKERS_OF_A_SECOND_ANSWER = new Set(["forecast", "user"]);

const isACreatedClass = (model, theClass) => model.getKindOfClass(theClass) === KINDS.CREATED;

const isALanguageCollection = type => LANGUAGE_COLLECTION.test(String(type || "").trim());

const holdsARule = method => isAText(method.body) && RULE_IN_A_BODY.test(method.body.trim());

// A type that extends or implements another, such as an exception that carries the values it rejects, takes the role of that type, so it is more than a holder.
const takesTheRoleOfAnotherType = theClass => readList(theClass.extends).length > 0 || readList(theClass.implements).length > 0;

const holdsOnlyACollection = theClass => {
  const fields = readList(theClass.fields);
  return !takesTheRoleOfAnotherType(theClass) && fields.length === 1 && isALanguageCollection(fields[0].type) && !readList(theClass.methods).some(holdsARule);
};

const findTheCollectionTypeDefect = (model, theClass) => createRecheckDefect(
  DEFECT_CODES.TYPE_HOLDS_ONLY_A_COLLECTION,
  model.getClassPath(theClass),
  `${theClass.name} is a created type whose only field is the collection ${theClass.fields[0].type} of the language, and no method of it holds a rule of its own`,
);

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
    if (!isAnInterface(theClass) && holdsOnlyACollection(theClass)) defects.push(findTheCollectionTypeDefect(model, theClass));
    if (!isAnInterface(theClass) || isInALayoutSplit(theClass) || isNamedByASecondAnswer(model, theClass)) continue;

    const implementations = listImplementations(model, theClass);
    if (implementations.length === 1) defects.push(findTheSingleImplementationDefect(model, theClass, implementations[0]));
  }
  return defects;
};
