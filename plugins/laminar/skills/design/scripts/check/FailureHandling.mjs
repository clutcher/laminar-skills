import { FRAMEWORK, isAText, readHeadTypeName, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createDefect } from "./DesignDefect.mjs";
import { findExitChain } from "./ExitReach.mjs";

const listTypeAndSupertypeNames = (model, typeName) => {
  const names = new Set([typeName]);
  const typesToVisit = [typeName];
  while (typesToVisit.length) {
    const theClass = model.findClass(typesToVisit.pop());
    for (const parentName of readList(theClass?.extends)) {
      if (names.has(parentName)) continue;
      names.add(parentName);
      typesToVisit.push(parentName);
    }
  }
  return names;
};

const takesOneOf = (handler, typeNames) => readList(handler.parameters).some(parameter => isAText(parameter.type)
  && (typeNames.has(parameter.type.trim()) || typeNames.has(readHeadTypeName(parameter.type))));

// A type name of a library starts with a capital letter in the languages the scripts read, and a name the model holds is a type of the model.
const STARTS_AS_A_TYPE = /^[A-Z]/;

const namesAType = (model, failed) => {
  const headTypeName = readHeadTypeName(failed);
  return STARTS_AS_A_TYPE.test(headTypeName) || model.findClass(headTypeName) !== null;
};

// A failed that names no type is the defect exit-failure-unnamed, so no handler is checked against it.
const findHandlerTypeDefect = (model, exit, at) => {
  const { failed, handledAt } = exit.failure;
  if (!isAText(failed) || !isAText(handledAt) || handledAt === FRAMEWORK || !namesAType(model, failed)) return null;

  const handler = model.findMethod(handledAt);
  if (!handler || takesOneOf(handler, listTypeAndSupertypeNames(model, failed.trim()))) return null;
  return createDefect(DEFECT_CODES.HANDLER_TAKES_OTHER_TYPE, `decisions.exits[${at}].failure.handledAt`, `the exit ${exit.exit} fails with ${failed}, and ${handledAt} takes no parameter of that type or of a supertype the model lists through extends`);
};

const reachesTheMethod = (model, entryName, fromName) => entryName === fromName || findExitChain(model, entryName, new Set([fromName])) !== null;

const listFrameworkFromNames = (model, exits) => exits
  .filter(exit => exit.failure && exit.failure.handledAt === FRAMEWORK && isAText(exit.from))
  .map(exit => model.normalizeName(exit.from));

const listsAFrameworkResponse = entry => readList(entry.responses).some(response => response.handledAt === FRAMEWORK);

const findFrameworkResponseDefects = (model, exits) => {
  const fromNames = listFrameworkFromNames(model, exits);
  if (!fromNames.length) return [];

  const defects = [];
  readList(model.decisions.entries).forEach((entry, at) => {
    if (!isAText(entry.entry) || listsAFrameworkResponse(entry)) return;

    const entryName = model.normalizeName(entry.entry);
    const reachedFromName = fromNames.find(fromName => reachesTheMethod(model, entryName, fromName));
    if (reachedFromName) defects.push(createDefect(DEFECT_CODES.FRAMEWORK_RESPONSE_UNLISTED, `decisions.entries[${at}].responses`, `the entry ${entry.entry} reaches ${reachedFromName}, whose exit leaves its failure to the ${FRAMEWORK}, and its responses list no response with handledAt ${FRAMEWORK}`));
  });
  return defects;
};

// An entry whose handler is the framework answers a failed check with the framework's default response, so its responses list that response.
const findFrameworkHandlerDefects = model => {
  const defects = [];
  readList(model.decisions.entries).forEach((entry, at) => {
    if (entry.handler !== FRAMEWORK || !readList(entry.validates).length || listsAFrameworkResponse(entry)) return;
    defects.push(createDefect(DEFECT_CODES.FRAMEWORK_HANDLER_RESPONSE_UNLISTED, `decisions.entries[${at}].responses`, `the entry ${entry.entry} leaves a failed check to the ${FRAMEWORK}, and its responses list no response with handledAt ${FRAMEWORK} for the failed check`));
  });
  return defects;
};

const isAnsweredByTheFramework = (model, exit) => {
  if (exit.failure.handledAt !== FRAMEWORK || !isAText(exit.from)) return false;
  const fromName = model.normalizeName(exit.from);
  return readList(model.decisions.entries).some(entry => isAText(entry.entry) && listsAFrameworkResponse(entry) && reachesTheMethod(model, model.normalizeName(entry.entry), fromName));
};

const describeTheUncheckedExits = exitNames => (exitNames.length
  ? `exit failures: each failed checked for a type; not checked, left to the ${FRAMEWORK} whose response the entry lists: ${exitNames.join(", ")}`
  : "exit failures: each failed checked for a type");

// An exit whose failed names no type leaves its failure kinds unnamed, so no handler can be checked against it; where the framework answers it and the entry lists that response, the type changes no response, so it is not checked.
export const findExitFailureResult = model => {
  const defects = [];
  const uncheckedNames = [];
  readList(model.decisions.exits).forEach((exit, at) => {
    if (!exit.failure || !isAText(exit.failure.failed) || namesAType(model, exit.failure.failed)) return;
    if (isAnsweredByTheFramework(model, exit)) {
      uncheckedNames.push(exit.exit);
      return;
    }
    defects.push(createDefect(DEFECT_CODES.EXIT_FAILURE_UNNAMED, `decisions.exits[${at}].failure.failed`, `the exit ${exit.exit} fails with ${exit.failure.failed}, which names no type, so its failure kinds are unnamed; name the type the call throws or returns on each failure kind`));
  });
  return { defects, headLine: describeTheUncheckedExits(uncheckedNames) };
};

export const findFailureHandlingDefects = model => {
  const exits = readList(model.decisions.exits);
  const handlerDefects = exits.map((exit, at) => (exit.failure ? findHandlerTypeDefect(model, exit, at) : null)).filter(Boolean);
  return [...handlerDefects, ...findFrameworkResponseDefects(model, exits), ...findFrameworkHandlerDefects(model)];
};
