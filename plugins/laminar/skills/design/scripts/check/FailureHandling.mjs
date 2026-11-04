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

const findHandlerTypeDefect = (model, exit, at) => {
  const { failed, handledAt } = exit.failure;
  if (!isAText(failed) || !isAText(handledAt) || handledAt === FRAMEWORK) return null;

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

export const findFailureHandlingDefects = model => {
  const exits = readList(model.decisions.exits);
  const handlerDefects = exits.map((exit, at) => (exit.failure ? findHandlerTypeDefect(model, exit, at) : null)).filter(Boolean);
  return [...handlerDefects, ...findFrameworkResponseDefects(model, exits), ...findFrameworkHandlerDefects(model)];
};
