import { DOES, isATestFileOfTheModel, readHeadTypeName, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

const DOMAIN_ZONE = "domain";

// An interface, an enum and a record hold no field that a method changes, so a class of any other kind word may hold a changing collection.
const KIND_WORD_WITHOUT_CHANGING_FIELDS = /\b(?:interface|enum|record)\b/;

// A constant of a class is written in upper case in Java, Kotlin, TypeScript and Python, so its name marks it where the model has no mark of its own.
const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/;

// The collections of Java, Kotlin, TypeScript and Python, read by the head of the type.
const COLLECTION_TYPE_NAMES = new Set([
  "Collection", "List", "ArrayList", "LinkedList", "Set", "HashSet", "LinkedHashSet", "TreeSet", "SortedSet", "NavigableSet", "EnumSet",
  "Map", "HashMap", "LinkedHashMap", "TreeMap", "SortedMap", "NavigableMap", "ConcurrentMap", "ConcurrentHashMap", "EnumMap",
  "Queue", "Deque", "ArrayDeque", "MutableList", "MutableSet", "MutableMap", "Array", "list", "dict", "set", "defaultdict", "deque",
]);

// The collections whose type itself says that their content changes, because each is a type of the language that a caller adds to.
const CHANGING_COLLECTION_TYPE_NAMES = new Set([
  "ArrayList", "LinkedList", "HashSet", "LinkedHashSet", "TreeSet", "HashMap", "LinkedHashMap", "TreeMap", "ConcurrentHashMap", "EnumMap",
  "ArrayDeque", "MutableList", "MutableSet", "MutableMap", "defaultdict",
]);

const ARRAY_TYPE = /\[\]\s*$/;

// The methods that add to, remove from or empty a collection in Java, Kotlin, TypeScript and Python.
const CHANGING_METHOD_NAMES = "add|addAll|addFirst|addLast|put|putAll|putIfAbsent|compute|computeIfAbsent|computeIfPresent|merge|push|unshift|append|extend|insert|offer|set|setdefault|update|remove|removeIf|clear|delete|pop|poll";

// An empty collection made with no argument: new HashMap<>() of Java, new Map() of TypeScript, mutableListOf() of Kotlin, dict() of Python, and the literals [] and {}.
const EMPTY_COLLECTION = String.raw`(?:new\s+[\w.]+\s*(?:<[^<>]*>)?\s*\(\s*\)|\[\s*\]|\{\s*\}|(?:mutable\w*Of|hashMapOf|hashSetOf|arrayListOf|linkedMapOf|dict|list|set|deque)\s*\(\s*\))`;

const CONSTRUCTOR_NAMES = new Set(["constructor", "__init__", "init"]);

const escapeForAPattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The field as a body names it: after this. or self., or alone where no other object comes before it.
const readFieldPattern = field => String.raw`(?:(?:this|self)\.|(?<![\w$.]))${escapeForAPattern(String(field.name))}`;

const isACollection = field => {
  const typeText = String(field.type || "").trim();
  return ARRAY_TYPE.test(typeText.split(",")[0]) || COLLECTION_TYPE_NAMES.has(readHeadTypeName(typeText));
};

const readSimpleName = theClass => String(theClass.name || "").split(".").pop();

const isAConstructor = (theClass, method) => method.name === readSimpleName(theClass) || CONSTRUCTOR_NAMES.has(method.name);

const listMethodsWithABody = theClass => readList(theClass.methods).filter(method => typeof method.body === "string" && method.body.trim() !== "");

const isAComputingClassOfTheDomain = (model, theClass) => model.isChangedClass(theClass)
  && theClass.zone === DOMAIN_ZONE
  && !isATestFileOfTheModel(model, theClass.file || "")
  && !KIND_WORD_WITHOUT_CHANGING_FIELDS.test(String(theClass.kindWord || ""))
  && (theClass.does === undefined || theClass.does === DOES.COMPUTES);

const findChangingMethod = (theClass, field) => {
  const fieldPattern = readFieldPattern(field);
  const changingCall = new RegExp(String.raw`${fieldPattern}\s*\.\s*(?:${CHANGING_METHOD_NAMES})\s*\(`);
  const keyedWrite = new RegExp(String.raw`${fieldPattern}\s*\[[^\]]+\]\s*=(?!=)`);
  return listMethodsWithABody(theClass)
    .filter(method => !isAConstructor(theClass, method))
    .find(method => changingCall.test(method.body) || keyedWrite.test(method.body)) || null;
};

const findEmptyCreatingMethod = (theClass, field) => {
  const emptyCreation = new RegExp(String.raw`${readFieldPattern(field)}\s*=\s*${EMPTY_COLLECTION}`);
  return listMethodsWithABody(theClass).find(method => emptyCreation.test(method.body)) || null;
};

// How the model shows that the content of the collection changes: by its type, by a method other than a constructor that changes it, or by a body that makes it empty; null where the model shows none.
const describeTheChange = (theClass, field) => {
  if (CHANGING_COLLECTION_TYPE_NAMES.has(readHeadTypeName(field.type))) return `its type ${readHeadTypeName(field.type)} is a collection that changes`;

  const changingMethod = findChangingMethod(theClass, field);
  if (changingMethod) return `${changingMethod.name} changes its content`;

  const emptyCreatingMethod = findEmptyCreatingMethod(theClass, field);
  return emptyCreatingMethod ? `${emptyCreatingMethod.name} makes it empty, to be filled later` : null;
};

const findChangingCollectionDefect = (model, theClass) => {
  for (const field of readList(theClass.fields)) {
    if (CONSTANT_NAME.test(String(field.name || "")) || !isACollection(field)) continue;

    const change = describeTheChange(theClass, field);
    if (change) {
      return createRecheckDefect(
        DEFECT_CODES.COMPUTATION_HOLDS_A_CHANGING_COLLECTION,
        model.getClassPath(theClass),
        `${theClass.name} is a ${model.getKindOfClass(theClass)} computing class of the domain zone whose field ${field.name} holds a changing collection: ${change}`,
      );
    }
  }
  return null;
};

// A created, moved or modified class of the domain zone that computes and holds a collection whose content the model shows changing keeps state between calls, so the same inputs may give other outputs. It is a recheck case, because the model gives no final or immutable mark on a field, and a collection filled once may still be read as a value.
export const findChangingCollectionDefects = model => model.classes
  .filter(theClass => isAComputingClassOfTheDomain(model, theClass))
  .map(theClass => findChangingCollectionDefect(model, theClass))
  .filter(defect => defect !== null);
