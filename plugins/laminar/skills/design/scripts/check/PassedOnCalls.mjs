import { KINDS, isAText, isATestFileOfTheModel, readHeadTypeName, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";
import { isAConstructor, isAFactoryOfItsClass, isALanguageCollection, isInALayoutSplit, listReasonWords } from "./SimplestForm.mjs";

const INTERFACE_OR_ENUM_KIND_WORD = /\b(?:interface|enum)\b/;

const PUBLIC_VISIBILITY = "public";

const METHOD_MARK = "#";

// A comment line of Java, Kotlin, TypeScript and Python says nothing the body does.
const COMMENT_LINE = /^\s*(?:\/\/|#).*$/gm;

// The head of a method written before its body in braces, as in Java, Kotlin and TypeScript, or before its colon, as in Python.
const BRACED_BODY_WITH_ITS_HEAD = /^[^{]*\([^)]*\)[^{]*\{([\s\S]*)\}\s*$/;

const PYTHON_HEAD = /^\s*def\s+[\w$]+\s*\([^)]*\)[^:]*:/;

// The start of 1 call of 1 method of a field, returned or not, up to its opening parenthesis: the field.
const START_OF_A_CALL_OF_A_FIELD = /^(?:return\s+)?(?:this\.|self\.)?([\w$]+)\.[\w$]+\s*\(/;

// Nothing but the end of the statement follows the call.
const END_OF_THE_STATEMENT = /^\s*;?\s*$/;

// A line that only gives a parameter to a field, as this.store = store; or self.store = store, decides nothing.
const ASSIGNMENT_OF_A_PARAMETER = /^(?:this\.|self\.)?[\w$]+\s*=\s*[\w$]+\s*;?$/;

// A contract with 2 or more implementations in the model is a choice with 2 answers, and each implementation is 1 of its cases.
const IMPLEMENTATIONS_OF_A_CHOICE = 2;

// A call in the arguments is work of its own, so a body that holds one passes more than the call on.
const CALL_IN_THE_ARGUMENTS = /[\w$]\s*\(/;

const isPublic = method => !isAText(method.visibility) || method.visibility === PUBLIC_VISIBILITY;

const readTheBodyWithoutItsHead = body => {
  const text = body.replace(COMMENT_LINE, "").trim();
  const braced = text.match(BRACED_BODY_WITH_ITS_HEAD);
  return (braced ? braced[1] : text.replace(PYTHON_HEAD, "")).trim();
};

const readTheTypeOfTheCall = call => {
  const pieces = call.split(METHOD_MARK);
  return pieces.length > 1 ? pieces[pieces.length - 2] : "";
};

const readLastTypeName = typeName => typeName.split(".").pop();

// The index of the parenthesis that closes the one at the given index, or -1 where the text does not close it.
const findTheClosingParenthesis = (text, openingIndex) => {
  let depth = 0;
  for (let index = openingIndex; index < text.length; index++) {
    if (text[index] === "(") depth++;
    if (text[index] === ")") depth--;
    if (depth === 0) return index;
  }
  return -1;
};

// The field of a body that is 1 call of 1 method of that field, with no call in its arguments and nothing after it; null otherwise.
const readTheFieldOfTheOnlyCall = body => {
  const start = body.match(START_OF_A_CALL_OF_A_FIELD);
  if (start === null) return null;

  const closingIndex = findTheClosingParenthesis(body, start[0].length - 1);
  if (closingIndex < 0 || !END_OF_THE_STATEMENT.test(body.slice(closingIndex + 1))) return null;
  return CALL_IN_THE_ARGUMENTS.test(body.slice(start[0].length, closingIndex)) ? null : start[1];
};

// The field whose 1 method the body calls, or, with no body, the field whose type the 1 entry of calls names; null where the method does more.
const findTheFieldThatTakesTheCall = (theClass, method) => {
  const fields = readList(theClass.fields);
  if (isAText(method.body)) {
    const fieldName = readTheFieldOfTheOnlyCall(readTheBodyWithoutItsHead(method.body));
    return fields.find(field => fieldName !== null && field.name === fieldName && isAText(field.type)) || null;
  }
  const calls = readList(method.calls).filter(isAText);
  if (calls.length !== 1) return null;
  const calledType = readLastTypeName(readTheTypeOfTheCall(calls[0]));
  if (!calledType) return null;
  return fields.find(field => isAText(field.type) && readLastTypeName(readHeadTypeName(field.type)) === calledType) || null;
};

const listThePublicMethodsOfItsWork = theClass => readList(theClass.methods)
  .filter(method => isPublic(method) && !isAConstructor(theClass, method) && !isAFactoryOfItsClass(theClass, method));

// The 1 field to which every public method passes its call on; null where 1 method does more or 2 fields take the calls.
const findTheFieldThatTakesEveryCall = theClass => {
  const methods = listThePublicMethodsOfItsWork(theClass);
  if (!methods.length) return null;

  const fields = methods.map(method => findTheFieldThatTakesTheCall(theClass, method));
  return fields.every(field => field !== null && field === fields[0]) ? fields[0] : null;
};

const isABoundaryInterface = (model, theClass, typeName) => {
  const typeClass = model.findClassOfTheType(readHeadTypeName(typeName), theClass);
  return typeClass !== null && isInALayoutSplit(typeClass);
};

// A class that implements an api or spi interface is the edge of the application, and a field of such a type is the way in or out that it calls, so both are boundaries of the application and not a depth that hides nothing.
const standsAtTheBoundary = (model, theClass, field) => readList(theClass.implements).some(typeName => isABoundaryInterface(model, theClass, typeName))
  || isABoundaryInterface(model, theClass, field.type);

const listTheParentsInTheModel = (model, theClass) => [...readList(theClass.implements), ...readList(theClass.extends)]
  .map(typeName => model.findClassOfTheType(readHeadTypeName(typeName), theClass))
  .filter(parent => parent !== null);

// A class that implements or extends a type of the model that 2 or more classes of the model implement is 1 case of a choice, which its callers cannot replace by its field.
const isACaseOfAChoice = (model, theClass) => listTheParentsInTheModel(model, theClass)
  .some(parent => model.classes.filter(other => model.implementsOrExtends(other, parent)).length >= IMPLEMENTATIONS_OF_A_CHOICE);

const isReadForThePassedOnCalls = (model, theClass) => model.getKindOfClass(theClass) === KINDS.CREATED
  && !INTERFACE_OR_ENUM_KIND_WORD.test(String(theClass.kindWord || ""))
  && !isATestFileOfTheModel(model, theClass.file || "");

// The case carries its own answer test, which the design check runs on an answer under scriptCases.
const createThePassedOnCallDefect = (model, theClass, field) => ({
  ...createRecheckDefect(
    DEFECT_CODES.CLASS_ONLY_PASSES_THE_CALL_ON,
    model.getClassPath(theClass),
    `${theClass.name} only passes each public call on to its field ${field.name} of the type ${field.type}; a caller calls a part directly before a new class that only passes the call on (designing.md, section 7): let the callers use ${field.type}, built where the module is wired, or answer under scriptCases with the Type#method of ${theClass.name} whose body holds the decision that the class hides`,
  ),
  answerTest: namesTheMethodOfTheHiddenDecision,
});

// A created class each of whose public methods is 1 call of 1 method of the same field adds a depth that hides nothing, unless a private part or the field holds a decision; a collection field is the form of the check of the simplest form, and a class at the edge of the application is a boundary of the application.
export const findPassedOnCallDefects = model => {
  const defects = [];
  for (const theClass of model.classes.filter(other => isReadForThePassedOnCalls(model, other))) {
    const field = findTheFieldThatTakesEveryCall(theClass);
    if (field === null || isALanguageCollection(field.type) || standsAtTheBoundary(model, theClass, field) || isACaseOfAChoice(model, theClass)) continue;
    defects.push(createThePassedOnCallDefect(model, theClass, field));
  }
  return defects;
};

const namesTheMethod = (text, method) => isAText(method.name) && text.split(/[^\w$]+/).includes(method.name);

// A constructor decides something where its body does more than give its parameters to fields.
const doesMoreThanAssign = method => isAText(method.body) && readTheBodyWithoutItsHead(method.body).split("\n")
  .map(line => line.trim())
  .some(line => line !== "" && !ASSIGNMENT_OF_A_PARAMETER.test(line));

// A method other than a constructor counts only where a constructor names it in its body or its uses, or a method of the class names it in its uses, so a method that nothing reaches holds no decision of the class.
const isReachedByTheClass = (theClass, method) => readList(theClass.methods).some(other => other !== method
  && (namesTheMethod(readList(other.uses).join(" "), method) || (isAConstructor(theClass, other) && namesTheMethod(String(other.body || ""), method))));

// A method holds the hidden decision where it is a constructor that does more than assign, or a method that the class reaches, no factory of the class and none of the methods that pass the call on, whose body or calls show work.
const holdsAHiddenDecision = (theClass, method, passingMethods) => {
  if (isAConstructor(theClass, method)) return doesMoreThanAssign(method);
  return !isAFactoryOfItsClass(theClass, method)
    && !passingMethods.includes(method)
    && isReachedByTheClass(theClass, method)
    && (isAText(method.body) || readList(method.calls).some(isAText));
};

// An answer under scriptCases closes the case only where it names, as Type#method, a method of the class that holds the decision the class hides, such as a private part that the constructor hands to a library or a constructor that picks what it builds.
export const namesTheMethodOfTheHiddenDecision = (model, theClass, reason) => {
  const words = listReasonWords(reason);
  const passingMethods = listThePublicMethodsOfItsWork(theClass);
  return readList(theClass.methods).some(method => holdsAHiddenDecision(theClass, method, passingMethods) && words.includes(model.getMethodDisplayName(theClass, method)));
};
