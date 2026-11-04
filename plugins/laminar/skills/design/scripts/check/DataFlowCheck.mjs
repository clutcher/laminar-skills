import { isAText, isAnInterface, isMarkedUnchanged, readHeadTypeName, readList } from "../model/DesignModel.mjs";
import { readParsedLanguage } from "../model/SourceLanguages.mjs";
import { readBodyStatements } from "./BodyCalls.mjs";
import { DEFECT_CODES, createDefect, createRecheckDefect } from "./DesignDefect.mjs";

// The values of Java, JavaScript and TypeScript that a body passes with no source to check.
const VALUE_WORDS = new Set([
  "this", // all 3: the object itself
  "super", // all 3: the object as its parent type
  "true", // all 3: a boolean literal
  "false", // all 3: a boolean literal
  "null", // all 3: the missing value
  "undefined", // JavaScript and TypeScript: the missing value
]);

const LEADING_OPERATORS = /^(?:new\s+|[!\-+*&(\s]|await\s+)+/;

const LITERAL_START = /^["'`\d]/;

const ROOT_NAME = /^([A-Za-z_$][\w$]*)\s*(\()?/;

// The accessor names of Java, get and is before the field name, which read the field; a JavaScript or TypeScript getter is read by the field name itself.
const ACCESSOR_PREFIX = /^(?:get|is)([A-Z]\w*)$/;

const FUNCTION_ARROW = /->|=>/;

const SPREAD = /^(?:\.\.\.|\*)/;

const lowerFirst = name => name.charAt(0).toLowerCase() + name.slice(1);

const isATypeName = name => /^[A-Z]/.test(name);

export const readLanguageOfTheClass = theClass => (isAText(theClass.file) ? readParsedLanguage(theClass.file) : null);

class BodyFlow {
  constructor(model, theClass, method) {
    this.model = model;
    this.theClass = theClass;
    this.method = method;
    this.displayName = model.getMethodDisplayName(theClass, method);
    this.path = `${model.getMethodPath(theClass, method)}.body`;
    this.typeOfSourceMap = new Map([
      ...readList(theClass.fields).map(field => [field.name, field.type || ""]),
      ...readList(method.parameters).map(parameter => [parameter.name, parameter.type || ""]),
    ]);
    this.calledClasses = new Set();
    this.defects = [];
  }

  holdsTheSource(name) {
    return this.typeOfSourceMap.has(name) || VALUE_WORDS.has(name) || isATypeName(name);
  }

  findClassOfTheType(typeName) {
    return typeName ? this.model.findClassOfTheType(typeName, this.theClass) : null;
  }

  findClassOfTheReceiver(receiver) {
    if (this.typeOfSourceMap.has(receiver)) return this.findClassOfTheType(readHeadTypeName(this.typeOfSourceMap.get(receiver)));
    return isATypeName(receiver) ? this.findClassOfTheType(receiver) : null;
  }

  reportMissingSource(name, callText) {
    this.defects.push(createRecheckDefect(DEFECT_CODES.DATA_SOURCE_MISSING, this.path, `${this.displayName} passes ${name} to ${callText}, and ${name} is no parameter of ${this.method.name}, no field of ${this.theClass.name} and no result of an earlier call of the body`));
  }

  checkArgument(argumentText, callText) {
    if (FUNCTION_ARROW.test(argumentText) || SPREAD.test(argumentText)) return;

    const stripped = argumentText.replace(LEADING_OPERATORS, "");
    if (!stripped || LITERAL_START.test(stripped)) return;

    const root = ROOT_NAME.exec(stripped);
    if (!root || root[2] || this.holdsTheSource(root[1])) return;
    this.reportMissingSource(root[1], callText);
  }

  checkArgumentCount(call, calledName, calledMethods) {
    if (call.argumentTexts.some(argumentText => SPREAD.test(argumentText))) return;

    const parameterCounts = [...new Set(calledMethods.map(calledMethod => readList(calledMethod.parameters).length))];
    if (parameterCounts.includes(call.argumentTexts.length)) return;
    this.defects.push(createRecheckDefect(DEFECT_CODES.ARGUMENT_COUNT_DIFFERS, this.path, `${this.displayName} passes ${call.argumentTexts.length} values to ${calledName}, which takes ${parameterCounts.join(" or ")}`));
  }

  isFieldReadOf(theClass, memberName) {
    const fieldNames = new Set(readList(theClass.fields).map(field => field.name));
    const accessor = ACCESSOR_PREFIX.exec(memberName);
    return fieldNames.has(memberName) || Boolean(accessor && fieldNames.has(lowerFirst(accessor[1])));
  }

  listMethodsOf(theClass, memberName) {
    return readList(theClass.methods).filter(other => other.name === memberName);
  }

  checkMemberCall(call) {
    const callText = `${call.receiver}.${call.memberName}`;
    if (!this.holdsTheSource(call.receiver)) {
      this.reportMissingSource(call.receiver, callText);
      return;
    }
    if (call.chainLength > 2) return;

    const calledClass = this.findClassOfTheReceiver(call.receiver);
    if (!calledClass) return;

    const calledMethods = this.listMethodsOf(calledClass, call.memberName);
    if (calledMethods.length) {
      if (calledClass !== this.theClass) this.calledClasses.add(calledClass);
      this.checkArgumentCount(call, `${this.model.getClassDisplayName(calledClass)}#${call.memberName}`, calledMethods);
      return;
    }
    if (this.isFieldReadOf(calledClass, call.memberName)) return;
    this.defects.push(createRecheckDefect(DEFECT_CODES.BODY_CALL_UNRESOLVED, this.path, `${this.displayName} calls ${callText}, and ${calledClass.name} holds no method and no field ${call.memberName}`));
  }

  checkCall(call) {
    if (call.shape === "constructor") {
      const constructedClass = this.findClassOfTheType(call.className);
      if (constructedClass && constructedClass !== this.theClass) this.calledClasses.add(constructedClass);
    } else if (call.shape === "own") {
      const ownMethods = this.listMethodsOf(this.theClass, call.memberName);
      if (ownMethods.length) this.checkArgumentCount(call, this.model.getMethodDisplayName(this.theClass, ownMethods[0]), ownMethods);
    } else {
      this.checkMemberCall(call);
    }
    const callText = call.shape === "member" ? `${call.receiver}.${call.memberName}` : call.className || call.memberName;
    for (const argumentText of call.argumentTexts) this.checkArgument(argumentText, callText);
  }

  readTypeOfTheDeclaration(statement) {
    const firstCall = statement.calls[0];
    if (!firstCall) return "";
    if (firstCall.shape === "constructor") return firstCall.className;
    if (firstCall.shape !== "member") return "";

    const calledClass = this.findClassOfTheReceiver(firstCall.receiver);
    if (!calledClass) return "";
    const calledMethods = this.listMethodsOf(calledClass, firstCall.memberName);
    const calledMethod = calledMethods.find(other => readList(other.parameters).length === firstCall.argumentTexts.length) || calledMethods[0];
    return calledMethod ? calledMethod.returns || "" : "";
  }

  checkBody() {
    for (const statement of readBodyStatements(this.method.body)) {
      for (const variable of [...statement.loopVariables, ...statement.lambdaParameters]) this.typeOfSourceMap.set(variable.name, "");
      for (const call of statement.calls) this.checkCall(call);
      for (const declaration of statement.declarations) this.typeOfSourceMap.set(declaration.name, declaration.typeText || this.readTypeOfTheDeclaration(statement));
    }
    const classesInCalls = new Set(readList(this.method.calls).map(called => this.model.findClass(called)).filter(Boolean));
    for (const calledClass of this.calledClasses) {
      if (classesInCalls.has(calledClass)) continue;
      this.defects.push(createDefect(DEFECT_CODES.BODY_CALL_NOT_IN_CALLS, `${this.model.getMethodPath(this.theClass, this.method)}.calls`, `the body of ${this.displayName} calls ${this.model.getClassDisplayName(calledClass)}, and its calls list does not name it`));
    }
    return this.defects;
  }
}

const listNextNames = (model, displayName, exitsOfFromMap) => {
  const method = model.findMethod(displayName);
  const reached = method ? model.listNamesReachedFrom(model.findClass(displayName), method) : [];
  return [...reached, ...(exitsOfFromMap.get(displayName) || [])];
};

const buildExitsOfFromMap = model => {
  const exitsOfFromMap = new Map();
  for (const exit of readList(model.decisions.exits)) {
    if (!isAText(exit.exit) || !isAText(exit.from)) continue;
    const fromName = model.normalizeName(exit.from);
    exitsOfFromMap.set(fromName, [...(exitsOfFromMap.get(fromName) || []), model.normalizeName(exit.exit)]);
  }
  return exitsOfFromMap;
};

const listStepsToTheExits = (model, entryName, exitNames, exitsOfFromMap) => {
  const nextNamesMap = new Map();
  const namesToVisit = [entryName];
  while (namesToVisit.length) {
    const name = namesToVisit.pop();
    if (nextNamesMap.has(name)) continue;

    const nextNames = name !== entryName && exitNames.has(name) ? [] : listNextNames(model, name, exitsOfFromMap);
    nextNamesMap.set(name, nextNames);
    namesToVisit.push(...nextNames);
  }

  const reachingNames = new Set([...nextNamesMap.keys()].filter(name => exitNames.has(name)));
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, nextNames] of nextNamesMap) {
      if (reachingNames.has(name) || !nextNames.some(nextName => reachingNames.has(nextName))) continue;
      reachingNames.add(name);
      grew = true;
    }
  }
  return [...reachingNames].filter(name => name === entryName || !exitNames.has(name));
};

const listMemberNamesOf = theClass => [
  ...readList(theClass.fields).map(field => field.name),
  ...readList(theClass.methods).map(method => method.name),
  ...readList(theClass.methods).map(method => ACCESSOR_PREFIX.exec(method.name)).filter(Boolean).map(accessor => lowerFirst(accessor[1])),
];

// A value is provided by its root name, so a source whose class holds a member of the value's name provides it, as request provides request.customerId().
const listProvidedNames = (model, theClass, method) => {
  const sources = [...readList(theClass.fields), ...readList(method.parameters)];
  const providedNames = sources.map(source => source.name);
  for (const source of sources) {
    const sourceClass = model.findClassOfTheType(readHeadTypeName(source.type), theClass);
    if (sourceClass) providedNames.push(...listMemberNamesOf(sourceClass));
  }
  return new Set(providedNames);
};

const findSignatureDefects = (model, theClass, method, stepName) => {
  const calledMethod = model.findMethod(readList(method.calls)[0]);
  if (!calledMethod) return [];

  const providedNames = listProvidedNames(model, theClass, method);
  return readList(calledMethod.parameters)
    .filter(parameter => !providedNames.has(parameter.name))
    .map(parameter => createRecheckDefect(DEFECT_CODES.DATA_SOURCE_MISSING, model.getMethodPath(theClass, method), `${stepName} has no body and calls ${readList(method.calls)[0]}, which takes ${parameter.name}, and ${parameter.name} is no parameter of ${method.name}, no field of ${theClass.name} and no member of the class of either`));
};

const findStepDefects = (model, theClass, method, stepName, entryName) => {
  if (readList(method.calls).length === 1) return findSignatureDefects(model, theClass, method, stepName);
  return [createRecheckDefect(DEFECT_CODES.PATH_STEP_WITHOUT_BODY, model.getMethodPath(theClass, method), `${stepName} is a step on the path from the entry ${entryName} to its exits and has no body, so the data flow of this step is not checked`)];
};

const findPathStepDefects = (model, uncheckedNames) => {
  const exitNames = model.getExitNames();
  const exitsOfFromMap = buildExitsOfFromMap(model);
  const seenNames = new Set();
  const defects = [];
  for (const entry of readList(model.decisions.entries)) {
    if (!isAText(entry.entry) || !model.findMethod(entry.entry)) continue;

    const entryName = model.normalizeName(entry.entry);
    for (const stepName of listStepsToTheExits(model, entryName, exitNames, exitsOfFromMap)) {
      const theClass = model.findClass(stepName);
      const method = model.findMethod(stepName);
      if (!method || isAText(method.body) || isMarkedUnchanged(method) || isAnInterface(theClass) || !model.isChangedClass(theClass) || seenNames.has(stepName)) continue;
      seenNames.add(stepName);
      if (readLanguageOfTheClass(theClass)) defects.push(...findStepDefects(model, theClass, method, stepName, entryName));
      else uncheckedNames.push(stepName);
    }
  }
  return defects;
};

const describeDataFlowCheck = (checkedCount, uncheckedNames) => {
  const unchecked = uncheckedNames.length ? `; not checked, in a language it does not parse: ${uncheckedNames.join(", ")}` : "";
  return `data-flow check: reads bodies in Java, JavaScript and TypeScript; ${checkedCount} bodies checked${unchecked}`;
};

export const findDataFlowDefects = model => {
  const defects = [];
  const uncheckedNames = [];
  let checkedCount = 0;
  for (const { theClass, method, displayName } of model.listMethodsWithClass()) {
    if (!isAText(method.body)) continue;
    if (!readLanguageOfTheClass(theClass)) {
      uncheckedNames.push(displayName);
      continue;
    }
    checkedCount += 1;
    defects.push(...new BodyFlow(model, theClass, method).checkBody());
  }
  const pathStepDefects = findPathStepDefects(model, uncheckedNames);
  return { headLine: describeDataFlowCheck(checkedCount, uncheckedNames), defects: [...pathStepDefects, ...defects] };
};
