import { KINDS, isAText, isAnInterface, isATestFileOfTheModel, readHeadTypeName, readList, readTypeNames } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createDefect, createRecheckDefect } from "./DesignDefect.mjs";

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

const DOMAIN_OBJECT = "domain object";

const isACreatedClass = (model, theClass) => model.getKindOfClass(theClass) === KINDS.CREATED;

export const isALanguageCollection = type => LANGUAGE_COLLECTION.test(String(type || "").trim());

const isAConstant = field => CONSTANT_NAME.test(String(field.name || ""));

const readSimpleName = theClass => String(theClass.name || "").split(".").pop();

export const isAConstructor = (theClass, method) => method.name === readSimpleName(theClass) || CONSTRUCTOR_NAMES.has(method.name);

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

// The name of a method in the head of its body is no call, so a body written with its head is read without it.
const escapeForAPattern = text => text.replace(/[$.*+?^()[\]{}|\\]/g, "\\$&");

const removeTheHead = (method, body) => {
  const name = escapeForAPattern(String(method.name || ""));
  if (!name) return body;
  return body
    .replace(new RegExp(`^\\s*(?:[\\w<>\\[\\],.?@]+\\s+)*${name}\\s*\\([^)]*\\)[^{]*\\{`), "{")
    .replace(new RegExp(`^\\s*def\\s+${name}\\s*\\([^)]*\\)[^:]*:`), "");
};

const holdsARuleInTheBodyOf = (method, readBody = body => body) => isAText(method.body) && holdsARuleInTheBody(readBody(removeTheHead(method, method.body), method));

// A method with no body is read as a read, as the model shows no rule in it.
const holdsARuleOutsideConstruction = (constructionMethods, method) => !constructionMethods.has(method) && holdsARuleInTheBodyOf(method);

// A type that extends or implements another, such as an exception that carries the values it rejects, takes the role of that type, so it is more than a collection.
const takesTheRoleOfAnotherType = theClass => readList(theClass.extends).length > 0 || readList(theClass.implements).length > 0;

const isReadForTheCollectionForm = (model, theClass) => !INTERFACE_OR_ENUM_KIND_WORD.test(String(theClass.kindWord || ""))
  && theClass.zone !== CONFIG_ZONE
  && !isATestFileOfTheModel(model, theClass.file || "");

// The 1 field that is no constant, where it is a collection of the language and the class takes the role of no other type; null otherwise.
const findTheCollectionOfTheForm = theClass => {
  const instanceFields = readList(theClass.fields).filter(field => !isAConstant(field));
  if (takesTheRoleOfAnotherType(theClass) || instanceFields.length !== 1 || !isALanguageCollection(instanceFields[0].type)) return null;
  return instanceFields[0];
};

// The collection of the form, where no method of the class holds a rule outside construction; null otherwise.
const findTheOnlyCollection = theClass => {
  const collection = findTheCollectionOfTheForm(theClass);
  if (collection === null) return null;

  const constructionMethods = listConstructionMethods(theClass);
  return readList(theClass.methods).some(method => holdsARuleOutsideConstruction(constructionMethods, method)) ? null : collection;
};

// A Java marker, a question mark of Kotlin and a union with null or undefined of TypeScript and Python each say only that the value may be missing.
const NULLABLE_MARK = /@Nullable\s+|\?$|\s*\|\s*(?:null|undefined|None)$/g;

const NO_VALUE = /^(?:void|Unit|None|undefined|never|Nothing)?$/;

const YES_OR_NO = /^(?:boolean|Boolean|bool)$/;

// The element types of the collection: every type name of its type but the head of the language collection, so the key and the value of a map both count.
const listElementTypeNames = collection => new Set(readTypeNames(collection.type).slice(1));

// A lookup answers with no value, a yes or no, or a type of the elements, alone, wrapped, nullable or in a collection, so a find, a filter, a pick, a presence or distinctness check and a refusal where 1 is absent all answer a lookup.
const answersALookup = (method, elementTypeNames) => {
  const returnText = String(method.returns || "").replace(NULLABLE_MARK, "").trim();
  if (NO_VALUE.test(returnText) || YES_OR_NO.test(returnText)) return true;
  return readTypeNames(returnText).some(name => elementTypeNames.has(name));
};

// The private methods that a method names in its body, its uses or its calls, outside construction: their rule counts for that method only.
const listPrivateStepsOfTheMethod = (theClass, method, constructionMethods) => {
  const text = `${method.body || ""} ${readList(method.uses).join(" ")} ${readList(method.calls).join(" ")}`;
  return readList(theClass.methods).filter(other => other !== method && other.visibility === "private" && !constructionMethods.has(other) && namesTheMethod(text, other));
};

const holdsARuleInTheMethodOrItsSteps = (theClass, method, constructionMethods, readBody) => [method, ...listPrivateStepsOfTheMethod(theClass, method, constructionMethods)]
  .some(step => holdsARuleInTheBodyOf(step, readBody));

// The calls that change a collection in Java, Kotlin, TypeScript and Python; a change alone is no rule, so the reading of a guarded change reads each as a read.
const CHANGING_CALL_NAMES = "add|addAll|put|putAll|putIfAbsent|remove|removeIf|removeAll|retainAll|set|clear|push|pop|append|extend|insert|update|delete|discard|offer|poll|merge|compute|computeIfAbsent|computeIfPresent|replace|replaceAll|splice|unshift|shift";

const createCollectionNamePattern = collection => `\\b(?:this\\.|self\\.)?${escapeForAPattern(collection.name)}`;

const createChangingCallPattern = collection => new RegExp(`${createCollectionNamePattern(collection)}\\.(?:${CHANGING_CALL_NAMES})\\s*\\(`, "g");

// An add or a remove by += or -= of Kotlin and Python, and a write of an index of Kotlin, TypeScript and Python, change the collection with no call; = after the index is no comparison.
const createChangingOperatorPattern = collection => new RegExp(`${createCollectionNamePattern(collection)}\\s*(?:[+-]=|\\[[^\\]\\n]*\\]\\s*=(?!=))`);

// A delete of an index of Python changes the collection with no call.
const createIndexDeletePattern = collection => new RegExp(`\\bdel\\s+${createCollectionNamePattern(collection)}\\s*\\[([^\\]\\n]*)\\]`, "g");

const changesTheBody = (body, collection) => new RegExp(createChangingCallPattern(collection).source).test(body)
  || createChangingOperatorPattern(collection).test(body)
  || new RegExp(createIndexDeletePattern(collection).source).test(body);

const changesTheCollection = (theClass, method, constructionMethods, collection) => [method, ...listPrivateStepsOfTheMethod(theClass, method, constructionMethods)]
  .some(step => isAText(step.body) && changesTheBody(step.body, collection));

// A chain of reads of 1 value, such as shelf.name() or shelf.name, holds no rule of its own.
const ACCESS_CHAIN = /^[\w$]+(?:\(\))?(?:\s*\.\s*[\w$]+(?:\(\))?)*$/;

const EQUALS_CALL = /^(.+?)\.(?:equals|equalsIgnoreCase)\((.+)\)$/s;

const OBJECTS_EQUALS_CALL = /^Objects\.equals\((.+?),(.+)\)$/s;

const EQUALITY_OPERATOR = /^(.+?)(?:===|==)(.+)$/s;

// A lambda of Java, Kotlin or TypeScript with 1 parameter: its name and its body.
const ONE_PARAMETER_LAMBDA = /^\(?\s*([\w$]+)\s*(?::\s*[\w$<>[\]]+)?\s*\)?\s*(?:->|=>)\s*(.+)$/s;

// The calls of Java, Kotlin and TypeScript that ask whether some element passes a test, each read where its test matches an element against the argument.
const ELEMENT_TEST_CALL_NAMES = "anyMatch|noneMatch|some|find|findIndex";

// The comparison after a find of TypeScript that turns its answer into a yes or no.
const FIND_ANSWER_COMPARISON = /^\s*(?:(?:!==?|===?)\s*(?:undefined|null|-1)|>=\s*0)/;

// The end of a filter that turns its matches into a yes or no: a find of any or the first with its presence answer, or a count compared with 0.
const FILTER_PRESENCE_END = /^\s*\.\s*(?:(?:findAny|findFirst)\(\)\s*\.\s*(?:isPresent|isEmpty)\(\)|count\(\)\s*(?:(?:[!=]=|>)\s*0|>=\s*1)L?(?![\w.]))/;

// A method reference bound to a value, such as shelf::equals, matches each element against that value.
const BOUND_EQUALS_REFERENCE = /^([\w$.()]+)::(?:equals|equalsIgnoreCase)$/;

// A lambda of Kotlin in braces that names its parameter; with no name, its parameter is it.
const NAMED_KOTLIN_LAMBDA = /^\s*([\w$]+)\s*->\s*([\s\S]+)$/;

const KOTLIN_LAMBDA_PARAMETER = "it";

// The operators of Java, Kotlin, TypeScript and Python that join 2 tests, so that both or either must hold.
const JOINING_OPERATOR_AT_THE_START = /^(?:&&|\|\||\sand\s|\sor\s)/;

const listParameterNamesOfTheHead = method => {
  const head = String(method.body || "").match(new RegExp(`^\\s*(?:[\\w<>\\[\\],.?@]+\\s+)*${escapeForAPattern(String(method.name || ""))}\\s*\\(([^)]*)\\)`));
  return head ? head[1].split(",").map(readTheNameOfAParameter).filter(Boolean) : [];
};

// A parameter written as name: Type, as in Kotlin, TypeScript and Python, or as Type name, as in Java.
const readTheNameOfAParameter = parameter => {
  const typedByAColon = parameter.split(":");
  const words = typedByAColon.length > 1 ? typedByAColon[0].trim().split(/\s+/) : parameter.trim().split(/\s+/);
  return words.pop() || "";
};

const listParameterNames = method => [...readList(method.parameters).map(parameter => String(parameter.name || "")), ...listParameterNamesOfTheHead(method)].filter(Boolean);

const removeOuterParentheses = text => {
  let rest = text.trim();
  while (rest.startsWith("(") && rest.endsWith(")") && findTheClosingParenthesis(rest, 0) === rest.length - 1) rest = rest.slice(1, -1).trim();
  return rest;
};

// The index of the mark that closes the one at the given index, a parenthesis or a brace, or -1 where the text does not close it.
const findTheClosingMark = (text, openingIndex, opening, closing) => {
  let depth = 0;
  for (let index = openingIndex; index < text.length; index++) {
    if (text[index] === opening) depth++;
    if (text[index] === closing) depth--;
    if (depth === 0) return index;
  }
  return -1;
};

const findTheClosingParenthesis = (text, openingIndex) => findTheClosingMark(text, openingIndex, "(", ")");

// The tests that an and or an or joins outside any parentheses, brackets or braces; 1 test where neither joins them.
const splitTheJoinedTests = condition => {
  const tests = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < condition.length; index++) {
    if ("([{".includes(condition[index])) depth++;
    if (")]}".includes(condition[index])) depth--;
    const joiningOperator = depth === 0 ? condition.slice(index).match(JOINING_OPERATOR_AT_THE_START) : null;
    if (joiningOperator === null) continue;

    tests.push(condition.slice(start, index));
    start = index + joiningOperator[0].length;
    index = start - 1;
  }
  tests.push(condition.slice(start));
  return tests;
};

const readTheTwoSidesOfAnEquality = condition => {
  const match = condition.match(OBJECTS_EQUALS_CALL) || condition.match(EQUALS_CALL) || condition.match(EQUALITY_OPERATOR);
  return match ? [match[1].trim(), match[2].trim()] : null;
};

const startsWithAName = (side, names) => names.some(name => new RegExp(`^${escapeForAPattern(name)}\\b`).test(side));

// The argument side of 1 equality that matches the element against an argument of the method, by the element or by a field of it; null for any other test.
const readTheArgumentOfAnEquality = (condition, elementName, parameterNames) => {
  const sides = readTheTwoSidesOfAnEquality(removeOuterParentheses(condition));
  if (sides === null || !sides.every(side => ACCESS_CHAIN.test(side))) return null;

  const argumentSide = sides.find(side => startsWithAName(side, parameterNames) && !startsWithAName(side, [elementName]));
  const elementSide = sides.find(side => side !== argumentSide && startsWithAName(side, [elementName]));
  return argumentSide && elementSide ? argumentSide : null;
};

// The argument side of a match of the element against the argument, also of several fields joined by and or by or, where each joined test is such a match; null for any other test.
const readTheArgumentOfAMatch = (condition, elementName, parameterNames) => {
  const argumentSides = splitTheJoinedTests(removeOuterParentheses(condition)).map(test => readTheArgumentOfAnEquality(test, elementName, parameterNames));
  return argumentSides.every(side => side !== null) ? argumentSides[0] : null;
};

const readTheArgumentOfALambdaMatch = (lambda, parameterNames) => {
  const parts = lambda.trim().match(ONE_PARAMETER_LAMBDA);
  return parts ? readTheArgumentOfAMatch(parts[2], parts[1], parameterNames) : null;
};

// The argument of an element test given as a lambda or as a method reference bound to the argument.
const readTheArgumentOfAnElementTest = (elementTest, parameterNames) => {
  const reference = elementTest.trim().match(BOUND_EQUALS_REFERENCE);
  if (reference === null) return readTheArgumentOfALambdaMatch(elementTest, parameterNames);
  return startsWithAName(reference[1], parameterNames) ? reference[1] : null;
};

// The presence test reads the argument as 1 value, so the empty parentheses of its reads are left out.
const createPresenceTest = (collection, argument) => `${collection.name}.contains(${argument.replace(/\(\)/g, "")})`;

// Each call of anyMatch, noneMatch, some or find, or a filter that ends in a presence answer, whose test matches the element, or a field that a map by a method reference takes from it, against the argument, written as the presence test it is.
const readElementTestCallsAsPresenceTests = (body, collection, parameterNames) => {
  const start = new RegExp(`\\b(?:this\\.|self\\.)?${escapeForAPattern(collection.name)}(?:\\.stream\\(\\))?(?:\\.map\\(\\s*[\\w$.]+::[\\w$]+\\s*\\))?\\.(${ELEMENT_TEST_CALL_NAMES}|filter)\\s*\\(`, "g");
  let text = body;
  for (let match = start.exec(text); match !== null; match = start.exec(text)) {
    const openingIndex = match.index + match[0].length - 1;
    const closingIndex = findTheClosingParenthesis(text, openingIndex);
    const argument = closingIndex < 0 ? null : readTheArgumentOfAnElementTest(text.slice(openingIndex + 1, closingIndex), parameterNames);
    const rest = text.slice(closingIndex + 1);
    const end = match[1] === "filter" ? rest.match(FILTER_PRESENCE_END) : rest.match(FIND_ANSWER_COMPARISON);
    if (argument === null || (match[1] === "filter" && end === null)) continue;

    const endLength = end ? end[0].length : 0;
    text = text.slice(0, match.index) + createPresenceTest(collection, argument) + rest.slice(endLength);
    start.lastIndex = match.index;
  }
  return text;
};

// The comparison with null after a firstOrNull or a find of Kotlin that turns its answer into a yes or no.
const KOTLIN_FIND_ANSWER_COMPARISON = /^\s*[!=]=\s*null\b/;

// Each call of any or none of Kotlin with a lambda in braces, or of firstOrNull or find compared with null, whose test matches the element against the argument, written as the presence test it is.
const readKotlinElementTestsAsPresenceTests = (body, collection, parameterNames) => {
  const start = new RegExp(`\\b(?:this\\.)?${escapeForAPattern(collection.name)}\\.(any|none|firstOrNull|find)\\s*\\{`, "g");
  let text = body;
  for (let match = start.exec(text); match !== null; match = start.exec(text)) {
    const openingIndex = match.index + match[0].length - 1;
    const closingIndex = findTheClosingMark(text, openingIndex, "{", "}");
    const argument = closingIndex < 0 ? null : readTheArgumentOfAKotlinLambdaMatch(text.slice(openingIndex + 1, closingIndex), parameterNames);
    const rest = text.slice(closingIndex + 1);
    const end = ["any", "none"].includes(match[1]) ? [""] : rest.match(KOTLIN_FIND_ANSWER_COMPARISON);
    if (argument === null || end === null) continue;

    text = text.slice(0, match.index) + createPresenceTest(collection, argument) + rest.slice(end[0].length);
    start.lastIndex = match.index;
  }
  return text;
};

const readTheArgumentOfAKotlinLambdaMatch = (lambda, parameterNames) => {
  const named = lambda.match(NAMED_KOTLIN_LAMBDA);
  return named ? readTheArgumentOfAMatch(named[2], named[1], parameterNames) : readTheArgumentOfAMatch(lambda, KOTLIN_LAMBDA_PARAMETER, parameterNames);
};

// A loop of Java, Kotlin or TypeScript over the collection whose only statement leaves where the element matches the argument, written as the presence test it is.
const readMatchLoopsAsPresenceTests = (body, collection, parameterNames) => {
  const start = new RegExp(`\\bfor\\s*\\(\\s*(?:(?:final\\s+)?[\\w$<>[\\],.?]+\\s+|(?:const|let|var|val)\\s+)?([\\w$]+)\\s*(?::|\\bof\\b|\\bin\\b)\\s*(?:this\\.)?${escapeForAPattern(collection.name)}\\s*\\)\\s*`, "g");
  let text = body;
  for (let match = start.exec(text); match !== null; match = start.exec(text)) {
    const loopBody = readTheStatementAfter(text, match.index + match[0].length);
    const leaving = removeTheBraces(loopBody).match(/^if\s*\(([\s\S]+)\)\s*(\{?\s*(?:throw|return)\b[^;{}]*;\s*\}?)$/);
    const argument = leaving ? readTheArgumentOfAMatch(leaving[1], match[1], parameterNames) : null;
    if (argument === null) continue;

    text = text.slice(0, match.index) + `if (${createPresenceTest(collection, argument)}) ${leaving[2]}` + text.slice(match.index + match[0].length + loopBody.length);
    start.lastIndex = match.index;
  }
  return text;
};

// The block in braces, or the 1 statement up to its semicolon, that starts at the given index.
const readTheStatementAfter = (text, index) => {
  if (text[index] !== "{") {
    const end = text.indexOf(";", index);
    return end < 0 ? text.slice(index) : text.slice(index, end + 1);
  }
  let depth = 0;
  for (let position = index; position < text.length; position++) {
    if (text[position] === "{") depth++;
    if (text[position] === "}") depth--;
    if (depth === 0) return text.slice(index, position + 1);
  }
  return text.slice(index);
};

const removeTheBraces = statement => {
  const trimmed = statement.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}") ? trimmed.slice(1, -1).trim() : trimmed;
};

// The match tests of Python: x in self.items, any(...) over the items and a loop that leaves on a match, each written as the presence test it is, with its if in parentheses.
const readPythonMatchTestsAsPresenceTests = (body, collection, parameterNames) => {
  const name = escapeForAPattern(collection.name);
  const withAny = body.replace(new RegExp(`\\bany\\(\\s*(.+?)\\s+for\\s+([\\w]+)\\s+in\\s+(?:self\\.)?${name}\\s*\\)`, "g"), (whole, condition, elementName) => {
    const argument = readTheArgumentOfAMatch(condition, elementName, parameterNames);
    return argument === null ? whole : createPresenceTest(collection, argument);
  });
  const withLoops = withAny.replace(new RegExp(`\\bfor\\s+([\\w]+)\\s+in\\s+(?:self\\.)?${name}\\s*:\\s*\\n?\\s*if\\s+(.+?):\\s*\\n?\\s*((?:raise|return)\\b[^\\n]*)`, "g"), (whole, elementName, condition, leaving) => {
    const argument = readTheArgumentOfAMatch(condition, elementName, parameterNames);
    return argument === null ? whole : `if ${createPresenceTest(collection, argument)}: ${leaving}`;
  });
  const withIn = withLoops.replace(new RegExp(`\\b([\\w.]+)\\s+(not\\s+|!)?in\\s+(?:self\\.|this\\.)?${name}\\b`, "g"), (whole, value, negation) => (startsWithAName(value, parameterNames) ? `${negation ? "!" : ""}${createPresenceTest(collection, value)}` : whole));
  return withIn.replace(new RegExp(`\\bif\\s+(!?${name}\\.contains\\([^()]*\\))\\s*:`, "g"), "if ($1)");
};

// A test whether an element matches the argument, by the element or by a field of it, is a presence or distinctness test, so it guards nothing; a count, a sum or another value over the elements still does.
const readMatchTestsAsPresenceTests = (body, collection, parameterNames) => {
  const withElementTests = readKotlinElementTestsAsPresenceTests(readElementTestCallsAsPresenceTests(body, collection, parameterNames), collection, parameterNames);
  return readPythonMatchTestsAsPresenceTests(readMatchLoopsAsPresenceTests(withElementTests, collection, parameterNames), collection, parameterNames);
};

// A change whose answer says whether the element was there, as !items.add(x), items.add(x) == false and items.putIfAbsent(k, v) compared with null, is a presence test.
const readChangeAnswersAsPresenceTests = (body, collection) => {
  const name = `(?:this\\.|self\\.)?${escapeForAPattern(collection.name)}`;
  return body
    .replace(new RegExp(`!\\s*${name}\\.add\\(([^()]*)\\)`, "g"), `${collection.name}.contains($1)`)
    .replace(new RegExp(`\\b${name}\\.add\\(([^()]*)\\)\\s*==\\s*false\\b`, "g"), `${collection.name}.contains($1)`)
    .replace(new RegExp(`\\b${name}\\.putIfAbsent\\(([^(),]*),(?:[^()]|\\([^()]*\\))*\\)\\s*[!=]=\\s*null\\b`, "g"), `${collection.name}.containsKey($1)`);
};

// A method reference, such as Integer::sum, names a method that runs on the elements, so it reads as a call; a creation by ::new and an equals bound to a value only build or match an element.
const METHOD_REFERENCE = /([\w$.()]+)::([\w$]+)/g;

const EQUALS_NAME = /^(?:equals|equalsIgnoreCase)$/;

const BOUND_RECEIVER = /^[a-z_$]/;

const isAReferenceThatComputes = (receiver, methodName) => methodName !== "new" && !(EQUALS_NAME.test(methodName) && BOUND_RECEIVER.test(receiver));

// Each method reference in the arguments of a change, such as the merge of a tally by Integer::sum, written as the call it is, as a lambda that calls it would be.
const readMethodReferencesOfChangesAsCalls = (body, collection) => {
  const start = createChangingCallPattern(collection);
  let text = body;
  for (let match = start.exec(text); match !== null; match = start.exec(text)) {
    const openingIndex = match.index + match[0].length - 1;
    const closingIndex = findTheClosingParenthesis(text, openingIndex);
    if (closingIndex < 0) continue;

    const changeArguments = text.slice(openingIndex + 1, closingIndex)
      .replace(METHOD_REFERENCE, (whole, receiver, methodName) => (isAReferenceThatComputes(receiver, methodName) ? `${receiver}.${methodName}()` : whole));
    text = text.slice(0, openingIndex + 1) + changeArguments + text.slice(closingIndex);
    start.lastIndex = openingIndex + 1;
  }
  return text;
};

// Each change of the collection written as a read: a changing call as a get, an add or a remove by an operator as a get of its value, a write of an index as a get of the index and the value, and a delete of an index as a get of the index.
const readChangesAsReads = (body, collection) => {
  const name = createCollectionNamePattern(collection);
  return readMethodReferencesOfChangesAsCalls(body, collection)
    .replace(createChangingCallPattern(collection), `${collection.name}.get(`)
    .replace(createIndexDeletePattern(collection), `${collection.name}.get($1)`)
    .replace(new RegExp(`${name}\\s*\\[([^\\]\\n]*)\\]\\s*=(?!=)\\s*([^;\\n]*)`, "g"), `${collection.name}.get($1, $2)`)
    .replace(new RegExp(`${name}\\s*[+-]=\\s*([^;\\n]*)`, "g"), `${collection.name}.get($1)`);
};

// A creation of an element of the collection, such as new Shelf(name), builds the value that the change adds, so it is no rule; its arguments read as plain values.
const readCreationsOfElementsAsValues = (body, collection) => [...listElementTypeNames(collection)].reduce((text, typeName) => text
  .replace(new RegExp(`\\bnew\\s+${escapeForAPattern(typeName)}\\s*\\(([^()]*)\\)`, "g"), "$1")
  .replace(new RegExp(`\\bnew\\s+${escapeForAPattern(typeName)}\\s*\\(`, "g"), "("), body);

// The body of a step that only returns a presence test, after the readings of a guard.
const createPresenceReturnPattern = collection => new RegExp(`^\\{?\\s*return\\s+!?\\s*(?:this\\.|self\\.)?${escapeForAPattern(collection.name)}\\.(?:contains|containsKey)\\([^()]*\\)\\s*;?\\s*\\}?$`);

// A private step of the method whose body only tests presence, such as isTaken(shelf) that returns shelves.contains(shelf); a step that counts or compares holds its own rule and is left as a call.
const listPresenceSteps = (theClass, method, constructionMethods, collection) => listPrivateStepsOfTheMethod(theClass, method, constructionMethods)
  .filter(step => isAText(step.body) && createPresenceReturnPattern(collection).test(readTheGuardOfAChange(removeTheHead(step, step.body), step, collection, []).trim()));

// Each call of a presence step, written as the presence test that its body is.
const readPresenceStepsAsPresenceTests = (body, collection, presenceSteps) => presenceSteps.reduce((text, step) => text
  .replace(new RegExp(`(?<![\\w$.])(?:this\\.|self\\.)?${escapeForAPattern(step.name)}\\s*\\(([^()]*)\\)`, "g"), `${collection.name}.contains($1)`), body);

// A call of Kotlin, Guava or Spring that fails where its test is false, such as require(test) or checkArgument(test), is an if that throws.
const PRECONDITION_CALL = /(?<![\w$.])(?:require|check|(?:Preconditions\.)?(?:checkArgument|checkState)|Assert\.isTrue)\s*\(/;

const splitTheArgumentsOfACall = text => {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    if ("([{".includes(text[index])) depth++;
    if (")]}".includes(text[index])) depth--;
    if (depth === 0 && text[index] === ",") {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
};

// The negation of a test where it holds 1 negation at its start, so that a presence test stays 1; the guard reads its operators and its calls, and either way they are the same.
const negateTheTest = test => (test.startsWith("!") ? test.slice(1).trim() : `!${test}`);

// Each precondition call written as the if that throws it is; its first argument is the test, and a message after it, in its arguments or in a block of Kotlin, is left out.
const readPreconditionCallsAsIfs = body => {
  const start = new RegExp(PRECONDITION_CALL.source, "g");
  let text = body;
  for (let match = start.exec(text); match !== null; match = start.exec(text)) {
    const openingIndex = match.index + match[0].length - 1;
    const closingIndex = findTheClosingParenthesis(text, openingIndex);
    if (closingIndex < 0) continue;

    const test = splitTheArgumentsOfACall(text.slice(openingIndex + 1, closingIndex))[0].trim();
    const message = text.slice(closingIndex + 1).match(/^\s*\{[^{}]*\}/);
    const end = closingIndex + 1 + (message ? message[0].length : 0);
    const statementEnd = text.slice(end).match(/^\s*;/);
    const replacement = `if (${negateTheTest(test)}) throw new IllegalStateException();`;
    text = text.slice(0, match.index) + replacement + text.slice(end + (statementEnd ? statementEnd[0].length : 0));
    start.lastIndex = match.index + replacement.length;
  }
  return text;
};

// A chain of getters that starts with a parameter, such as shelf.name(), shelf.getName() or shelf.name, reads 1 value of the argument, so the guard reads it as the parameter itself.
const readParameterChainsAsOneValue = (body, parameterNames) => {
  if (!parameterNames.length) return body;

  const names = parameterNames.map(escapeForAPattern).join("|");
  return body.replace(new RegExp(`(?<![\\w$.])(${names})(?:\\s*\\.\\s*[\\w$]+(?:\\(\\s*\\)|(?![\\w$]|\\s*\\()))+`, "g"), "$1");
};

const readTheGuardOfAChange = (body, step, collection, presenceSteps) => {
  const parameterNames = listParameterNames(step);
  const withValues = readCreationsOfElementsAsValues(readParameterChainsAsOneValue(body, parameterNames), collection);
  const withPresenceTests = readChangeAnswersAsPresenceTests(readPresenceStepsAsPresenceTests(withValues, collection, presenceSteps), collection);
  const guard = readMatchTestsAsPresenceTests(readChangesAsReads(withPresenceTests, collection), collection, parameterNames);
  return readPreconditionCallsAsIfs(guard);
};

// A change of the collection under a rule that reads the elements keeps a state of the whole, such as a limit on how many elements of 1 kind it holds, which no element holds; a plain change, or a change behind a presence or distinctness test only, is no rule.
const guardsAChangeOfTheCollection = (theClass, method, constructionMethods, collection) => {
  if (!changesTheCollection(theClass, method, constructionMethods, collection)) return false;

  const presenceSteps = listPresenceSteps(theClass, method, constructionMethods, collection);
  return holdsARuleInTheMethodOrItsSteps(theClass, method, constructionMethods, (body, step) => readTheGuardOfAChange(body, step, collection, presenceSteps));
};

// A public method keeps the type where it answers a value that no element holds and computes it, in its body or a private step it names, or where it changes the collection under a rule.
const keepsAStateOfTheWhole = (theClass, method, constructionMethods, elementTypeNames, collection) => {
  if (constructionMethods.has(method) || method.visibility === "private") return false;
  if (!answersALookup(method, elementTypeNames)) return holdsARuleInTheMethodOrItsSteps(theClass, method, constructionMethods, body => body);
  return guardsAChangeOfTheCollection(theClass, method, constructionMethods, collection);
};

// The collection of the form on a domain object, where no method keeps a state of the whole; null otherwise.
const findTheOnlyCollectionOfTheDomainObject = theClass => {
  const collection = findTheCollectionOfTheForm(theClass);
  if (collection === null) return null;

  const constructionMethods = listConstructionMethods(theClass);
  const elementTypeNames = listElementTypeNames(collection);
  return readList(theClass.methods).some(method => keepsAStateOfTheWhole(theClass, method, constructionMethods, elementTypeNames, collection)) ? null : collection;
};

const findTheDomainObjectCollectionDefect = (model, theClass, collection) => createDefect(
  DEFECT_CODES.TYPE_HOLDS_ONLY_A_COLLECTION,
  model.getClassPath(theClass),
  `${theClass.name} is a created type marked domain object whose only field that is no constant is the collection ${collection.type} of the language, and no method computes over its elements a value that no element holds or changes the collection under a rule that reads them, so it only finds, filters or picks among its elements; mark the class work, or give the whole a value that no element holds`,
);

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

// A type marked domain object that only finds, filters or picks among its elements is no domain object, whatever its body, so its case is a defect; on every other mark the case is a recheck, because a rule can stand outside what the model shows.
const findTheCollectionDefect = (model, theClass) => {
  if (theClass.represents === DOMAIN_OBJECT) {
    const collection = findTheOnlyCollectionOfTheDomainObject(theClass);
    return collection ? findTheDomainObjectCollectionDefect(model, theClass, collection) : null;
  }
  const collection = findTheOnlyCollection(theClass);
  return collection ? findTheCollectionTypeDefect(model, theClass, collection) : null;
};

// The 2 forms that are larger than the change needs where nothing varies: a created type that only holds a collection of the language, and a created interface with 1 implementation that no layout split and no second answer asks for. Each is a recheck case, because a rule or a second answer can stand outside what the model shows, except the collection on a type marked domain object.
export const findSimplestFormDefects = model => {
  const defects = [];
  for (const theClass of model.classes.filter(other => isACreatedClass(model, other))) {
    const collectionDefect = isReadForTheCollectionForm(model, theClass) ? findTheCollectionDefect(model, theClass) : null;
    if (collectionDefect) defects.push(collectionDefect);
    if (!isAnInterface(theClass) || isInALayoutSplit(theClass) || isNamedByASecondAnswer(model, theClass)) continue;

    const implementations = listImplementations(model, theClass);
    if (implementations.length === 1) defects.push(findTheSingleImplementationDefect(model, theClass, implementations[0]));
  }
  return defects;
};
