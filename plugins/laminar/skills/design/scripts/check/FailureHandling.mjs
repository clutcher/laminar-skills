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

// The first word of a method that reads or parses outside data, in camelCase and in snake_case; a method that writes, sends or charges gets no empty or missing reply, so it is not checked for an absent result. Each verb starts a reading method in Java, TypeScript, Python and Kotlin alike:
// find: a lookup by key or by query in repositories and clients of every stack.
// get: the most common reading verb of clients, maps and stores in every stack.
// read: a read of a file, a stream or a store.
// load: a read of a stored record or file, in data layers and caches.
// fetch: a read of a remote resource, in HTTP clients and data layers.
// list: a read of a collection, in repositories and cloud SDKs.
// query: a read through a query language or a filter.
// search: a read through an index or a full-text query.
// select: a read in SQL mappers and query builders.
// look, lookup: a read of 1 entry by key, in directories, registries and caches.
// open: a read that starts at a file, a stream or a stored object that can be missing.
// parse: a read of outside data from text or bytes, which can be empty.
// count: a read of the number of stored items.
// has, exists, contains, is: a read that answers yes or no about stored data.
// retrieve: a read of a stored or remote item, in SDKs and data layers.
// download: a read of a remote file or object.
// receive: a read of a message from a queue or a channel, which can be empty.
// poll: a read of the next item of a queue, which can be empty.
const READING_VERBS = new Set(["find", "get", "read", "load", "fetch", "list", "query", "search", "select", "look", "lookup", "open", "parse", "count", "has", "exists", "contains", "is", "retrieve", "download", "receive", "poll"]);

// A return type that carries no reply in the languages the scripts read.
const NO_REPLY_TYPE = /^(?:void|None|Unit)$|<\s*[Vv]oid\s*>$/;

// A boolean or a number has no absent reply to state; the type text of the model cannot tell a boxed type from a primitive one, so both count here.
const YES_NO_OR_NUMBER_TYPES = new Set(["boolean", "Boolean", "bool", "int", "Integer", "Int", "long", "Long", "short", "Short", "byte", "Byte", "float", "Float", "double", "Double", "number", "Number"]);

const hasNoAbsentReply = returnType => NO_REPLY_TYPE.test(returnType) || YES_NO_OR_NUMBER_TYPES.has(returnType);

const readFirstWord = methodName => methodName.split(/(?=[A-Z])|_/)[0].toLowerCase();

const readsAReply = method => isAText(method.name) && isAText(method.returns) && !hasNoAbsentReply(method.returns.trim()) && READING_VERBS.has(readFirstWord(method.name));

// An execution that reads a reply can get an empty or missing one, so its failure line states the normal result for it, or the word none where absent has no normal result.
const findAbsentResultDefect = (model, exit, at) => {
  if (isAText(exit.failure.absent) || !isAText(exit.exit)) return null;

  const exitMethod = model.findMethod(exit.exit);
  if (!exitMethod || !readsAReply(exitMethod)) return null;
  return createDefect(DEFECT_CODES.EXIT_ABSENT_UNSTATED, `decisions.exits[${at}].failure.absent`, `the exit ${exit.exit} reads a reply that can be empty or missing, and its failure states no absent; write the normal result for an empty or missing reply, or the word none where that reply has no normal result`);
};

export const findFailureHandlingDefects = model => {
  const exits = readList(model.decisions.exits);
  const handlerDefects = exits.map((exit, at) => (exit.failure ? findHandlerTypeDefect(model, exit, at) : null)).filter(Boolean);
  const absentDefects = exits.map((exit, at) => (exit.failure ? findAbsentResultDefect(model, exit, at) : null)).filter(Boolean);
  return [...handlerDefects, ...findFrameworkResponseDefects(model, exits), ...findFrameworkHandlerDefects(model), ...absentDefects];
};
