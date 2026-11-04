import { isAMethodName, isAText, readHeadTypeName, readList } from "../model/DesignModel.mjs";
import { readBodyStatements } from "./BodyCalls.mjs";
import { readLanguageOfTheClass } from "./DataFlowCheck.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

const METHOD_MARK = "#";

// The classes that do I/O: the class of each listed exit that another method runs, and each class an integration test substitutes; an exit that its own method runs, such as the parse of a request at the entry, leaves its class no exit class.
const listExitClasses = model => {
  const exitClassNames = [
    ...readList(model.decisions.exits).filter(exit => exit.exit !== exit.from).map(exit => exit.exit),
    ...readList(model.decisions.tests?.integration).flatMap(integration => readList(integration.substitutes)),
  ];
  return new Set(exitClassNames.filter(isAText).map(name => model.findClass(name)).filter(Boolean));
};

const findClassOfTheSource = (model, theClass, method, sourceName) => {
  const source = [...readList(theClass.fields), ...readList(method.parameters)].find(other => other.name === sourceName);
  return source ? model.findClassOfTheType(readHeadTypeName(source.type), theClass) : null;
};

// The methods a body calls on a field or a parameter, read in the languages the data-flow check parses.
const listBodyCallNames = (model, theClass, method) => {
  if (!isAText(method.body) || !readLanguageOfTheClass(theClass)) return [];

  const names = [];
  for (const statement of readBodyStatements(method.body)) {
    for (const call of statement.calls.filter(other => other.shape === "member")) {
      const calledClass = findClassOfTheSource(model, theClass, method, call.receiver);
      if (calledClass) names.push(`${model.getClassDisplayName(calledClass)}${METHOD_MARK}${call.memberName}`);
    }
  }
  return names;
};

const listNamesOnThePath = (model, entryName) => {
  const seenNames = new Set([entryName]);
  const namesToVisit = [entryName];
  while (namesToVisit.length) {
    const name = namesToVisit.pop();
    const theClass = model.findClass(name);
    const method = model.findMethod(name);
    if (!theClass || !method) continue;

    for (const reachedName of [...model.listNamesReachedFrom(theClass, method), ...listBodyCallNames(model, theClass, method)]) {
      if (seenNames.has(reachedName)) continue;
      seenNames.add(reachedName);
      namesToVisit.push(reachedName);
    }
  }
  return [...seenNames];
};

const holdsAFieldOfAnExitClass = (model, theClass, exitClasses) => readList(theClass.fields).some(field => exitClasses.has(model.findClassOfTheType(readHeadTypeName(field.type), theClass)));

const describeExitListCheck = (unparsedNames, unseenNames) => {
  const unparsed = unparsedNames.length ? `; not checked, a body in a language it does not parse: ${unparsedNames.join(", ")}` : "";
  const unseen = unseenNames.length ? `; not checked, no body and no calls beside a field of an exit class: ${unseenNames.join(", ")}` : "";
  return `exit list check: reads the calls on the path of each changed entry, and the bodies in Java, JavaScript and TypeScript${unparsed}${unseen}`;
};

// An entry the change touches lists every exit on its path, existing exits included, so each I/O execution has its failure line.
export const findExitListResult = model => {
  const exitNames = model.getExitNames();
  const exitClasses = listExitClasses(model);
  const defects = [];
  const unparsedNames = new Set();
  const unseenNames = new Set();
  readList(model.decisions.entries).forEach((entry, at) => {
    if (entry.changed === false || !isAText(entry.entry) || !model.findMethod(entry.entry)) return;

    for (const name of listNamesOnThePath(model, model.normalizeName(entry.entry))) {
      const theClass = model.findClass(name);
      if (exitClasses.has(theClass) && isAMethodName(name) && !exitNames.has(name)) defects.push(createRecheckDefect(DEFECT_CODES.EXIT_UNLISTED, `decisions.entries[${at}]`, `the entry ${entry.entry} reaches ${name}, a method of the exit class ${model.getClassDisplayName(theClass)}, and decisions.exits does not list it`));

      const method = model.findMethod(name);
      if (!method) continue;
      if (isAText(method.body) && !readLanguageOfTheClass(theClass)) unparsedNames.add(name);
      if (!isAText(method.body) && !readList(method.calls).length && !exitClasses.has(theClass) && holdsAFieldOfAnExitClass(model, theClass, exitClasses)) unseenNames.add(name);
    }
  });
  return { headLine: describeExitListCheck([...unparsedNames], [...unseenNames]), defects };
};
