import { KINDS, isAMethodName, isAText, isATestFileOfTheModel, isMarkedUnchanged, readHeadTypeName, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";
import { isKeyedByTheClosedSet, listTreeTables, readTreeFileOfTheClass } from "./LiteralTables.mjs";

const ENUM_KIND_WORD = "enum";

// The types that carry a key and no rule: the numbers, texts and booleans of each read language.
const KEY_TYPE_WORDS = new Set([
  "int", "long", "short", "byte", "double", "float", "boolean", "char", // Java: the primitive types
  "Integer", "Long", "Short", "Byte", "Double", "Float", "Boolean", "Character", "String", // Java: their boxed types and the text
  "Int", "Char", // Kotlin: the number and character types that Java names otherwise; Long, Double, Boolean and String are the same words
  "number", "string", "bigint", // JavaScript and TypeScript: the primitive types; boolean is the same word as in Java
  "str", "bool", // Python: the text and the boolean; int and float are the same words as in Java
]);

// The returns that give no value: void of Java, JavaScript and TypeScript, Unit of Kotlin, None of Python, and a promise of void.
const NO_VALUE_RETURNS = new Set(["void", "Unit", "None", "undefined", "Promise<void>"]);

// The declarations of a closed set in a file of the current tree: an enum of Java, Kotlin and TypeScript, a class of Python that extends an Enum, and a frozen object of JavaScript whose keys are upper-case constants.
const createClosedSetDeclarations = typeName => [
  new RegExp(`\\benum\\s+(?:class\\s+)?${typeName}\\b`),
  new RegExp(`\\bclass\\s+${typeName}\\s*\\([^)]*\\b\\w*Enum\\b`),
];

const createFrozenObjectDeclaration = typeName => new RegExp(`\\bconst\\s+${typeName}\\s*=\\s*Object\\.freeze\\(\\s*\\{([^}]*)\\}`);

const FROZEN_OBJECT_KEY = /([A-Za-z_$][\w$]*)\s*:/g;

const UPPER_CASE_CONSTANT = /^[A-Z][A-Z\d_]*$/;

const returnsAValue = method => isAText(method.returns) && !NO_VALUE_RETURNS.has(method.returns.replace(/\s+/g, ""));

const isAFrozenObjectOfConstants = (text, typeName) => {
  const declaration = createFrozenObjectDeclaration(typeName).exec(text);
  const keys = declaration ? [...declaration[1].matchAll(FROZEN_OBJECT_KEY)].map(key => key[1]) : [];
  return keys.length > 0 && keys.every(key => UPPER_CASE_CONSTANT.test(key));
};

const isAClosedSetOfTheTree = (currentTree, typeName) => currentTree.listFilesThatHoldEveryWord([typeName]).some(file => {
  const text = currentTree.readFileText(file) || "";
  return createClosedSetDeclarations(typeName).some(declaration => declaration.test(text)) || isAFrozenObjectOfConstants(text, typeName);
});

// A closed set is an enum of the model, or with --repo a closed set the current tree declares; without --repo a type that is no class of the model may carry values.
const isAClosedSet = (model, theClass, typeName, currentTree) => {
  const typeClass = model.findClassOfTheType(typeName, theClass);
  if (typeClass) return typeClass.kindWord === ENUM_KIND_WORD;
  return Boolean(currentTree) && /^[A-Z][\w$]*$/.test(typeName) && isAClosedSetOfTheTree(currentTree, typeName);
};

const isAKeyType = (model, theClass, typeText, currentTree) => {
  const typeName = readHeadTypeName(typeText);
  return KEY_TYPE_WORDS.has(typeName) || isAClosedSet(model, theClass, typeName, currentTree);
};

// No input can carry the values where the method takes 1 or more parameters, each a key, and every member it uses is a field whose type is a closed set; a method with no parameter reads the state of its object.
const takesOnlyKeys = (model, theClass, method, currentTree) => {
  const parameters = readList(method.parameters);
  const typeOfFieldMap = new Map(readList(theClass.fields).map(field => [field.name, field.type]));
  const usesOnlyKeyFields = readList(method.uses).every(use => typeOfFieldMap.has(use) && isAClosedSet(model, theClass, readHeadTypeName(typeOfFieldMap.get(use)), currentTree));
  return parameters.length > 0 && usesOnlyKeyFields && parameters.every(parameter => isAKeyType(model, theClass, parameter.type, currentTree));
};

// A method is new where its class stands in a created file, or with --repo where the current file of its class does not hold its signature; an existing method keeps its body in the tree.
const isANewMethod = (model, theClass, method, currentTree) => {
  if (model.getKindOfClass(theClass) === KINDS.CREATED) return true;
  return Boolean(currentTree) && !currentTree.holdsTheSignature(readTreeFileOfTheClass(model, theClass), method);
};

const isAnOwnerWithoutValues = (model, theClass, method, currentTree) => !isAText(method.body)
  && !readList(method.calls).length
  && !isMarkedUnchanged(method)
  && returnsAValue(method)
  && !isATestFileOfTheModel(model, theClass.file)
  && isANewMethod(model, theClass, method, currentTree)
  && takesOnlyKeys(model, theClass, method, currentTree);

const findTheTreeFileOfTheTable = (model, theClass, method, treeTables) => {
  const ownFile = readTreeFileOfTheClass(model, theClass);
  for (const parameter of readList(method.parameters)) {
    const closedSetName = readHeadTypeName(parameter.type);
    const treeTable = treeTables.find(({ file, tables }) => file !== ownFile && tables.some(table => isKeyedByTheClosedSet(table, closedSetName)));
    if (treeTable) return { file: treeTable.file, closedSetName };
  }
  return null;
};

const describeTheOwner = (displayName, decision, treeTable) => {
  const sentence = `${displayName} owns "${decision}" and takes only keys, and no body, call, parameter or field of the model gives its values; name the input that carries them, make the class that holds them the owner, or write them as its body`;
  return treeTable ? `${sentence}; ${treeTable.file} holds a table keyed by ${treeTable.closedSetName}, so a writer would copy it` : sentence;
};

// An owner that is a new method with no body and no calls, that returns a value, and whose inputs are all keys, gives a writer no source for its values, so the writer copies them from another class or makes them up. It is a recheck case, because a value may come from a source the model does not show, such as a framework setting or a sentence of the decision.
export const findOwnerValueDefects = (model, currentTree) => {
  const treeTables = currentTree ? listTreeTables(model, currentTree) : [];
  const defects = [];
  for (const owner of readList(model.decisions.owners)) {
    if (!isAMethodName(owner.owner)) continue;
    const theClass = model.findClass(owner.owner);
    const method = model.findMethod(owner.owner);
    if (!theClass || !method || !isAnOwnerWithoutValues(model, theClass, method, currentTree)) continue;

    const treeTable = findTheTreeFileOfTheTable(model, theClass, method, treeTables);
    defects.push(createRecheckDefect(DEFECT_CODES.OWNER_WITHOUT_ITS_VALUES, model.getMethodPath(theClass, method), describeTheOwner(model.getMethodDisplayName(theClass, method), owner.decision, treeTable)));
  }
  return defects;
};
