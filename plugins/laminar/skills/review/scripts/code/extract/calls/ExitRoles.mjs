import { Evidence, EVIDENCE_KINDS } from "../../graph/Evidence.mjs";
import { RELATION_KINDS } from "../../graph/relations/Relation.mjs";
import { Role, ROLE_KINDS } from "../../graph/abstractions/Role.mjs";
import { formatCallPlaceKey } from "../../graph/relations/Reference.mjs";
import { Scale } from "../../graph/abstractions/Scale.mjs";
import { findLanguage } from "../../inputs/source/Languages.mjs";
import { METHOD_FINDER_REGISTRY } from "../abstractions/method/index.mjs";
import { findFirstFoundAnswer } from "../finders/StrategyAnswers.mjs";

const DEFAULT_MODULE_SEPARATOR = ".";

const readModuleSeparator = finder => findLanguage(finder.language).moduleSeparator || DEFAULT_MODULE_SEPARATOR;

const attachTheFinderNameToAFoundAnswer = (module, finder) => (module ? { module, foundBy: finder.name } : null);

const findExitModuleDeclaredBy = (finder, name) => attachTheFinderNameToAFoundAnswer(finder.outboundIo.findExitModuleHolding(name, readModuleSeparator(finder)), finder);

const findIoGlobalCalleeDeclaredBy = (finder, callee) => attachTheFinderNameToAFoundAnswer(finder.outboundIo.holdsTheGlobalCallee(callee) ? callee : null, finder);

export const findExitModule = (name, context) => findFirstFoundAnswer(METHOD_FINDER_REGISTRY.findRoleFinders(context), finder => findExitModuleDeclaredBy(finder, name));

export const findIoGlobalCallee = (callee, context) => findFirstFoundAnswer(METHOD_FINDER_REGISTRY.findRoleFinders(context), finder => findIoGlobalCalleeDeclaredBy(finder, callee));

const isAnOutsideImport = reference => reference.kind === RELATION_KINDS.IMPORTS;

const isBareAndUnresolved = (graph, call) => !call.callReceiver && graph.findRelationsWithReference(call).length === 0;

const createExitRole = (of, found, facts) => new Role({
  kind: ROLE_KINDS.EXIT_BOUNDARY,
  of,
  detail: [...new Set(found.map(exitModule => exitModule.module))].join(", "),
  evidence: new Evidence({ kind: EVIDENCE_KINDS.DECLARED, foundBy: found[0].foundBy, detail: found[0].module }),
  facts,
});

function markTheMethod(graph, method, context) {
  const exitCalls = [];
  const globalCalls = [];
  for (const call of graph.findReferencesFrom(method).filter(reference => reference.isADirectCall())) {
    const key = formatCallPlaceKey(call.place.startLine, call.column);
    const global = isBareAndUnresolved(graph, call) ? findIoGlobalCallee(call.name, context) : null;
    const exit = (call.outsideNames || []).map(name => findExitModule(name, context)).find(Boolean) || global;
    if (exit && call.end) exitCalls.push({ ...exit, key });
    if (global) globalCalls.push({ ...global, key });
  }
  const found = [...exitCalls, ...globalCalls];
  if (found.length) method.addRole(createExitRole(method, found, { exitCalls: exitCalls.map(exitCall => exitCall.key), globalCalls: globalCalls.map(globalCall => globalCall.key) }));
}

function markTheFile(graph, fileClass, context) {
  const found = graph.findUnresolvedFrom(fileClass).map(unresolvedReference => unresolvedReference.reference).filter(isAnOutsideImport)
    .map(reference => findExitModule(reference.name, context)).filter(Boolean);
  if (found.length) fileClass.addRole(createExitRole(fileClass, found, { modules: [...new Set(found.map(exitModule => exitModule.module))] }));
}

export function markTheExitBoundaries(graph, contextOf) {
  for (const family of graph.callGraphAbstractions.families) {
    for (const method of family.methods) markTheMethod(graph, method, contextOf(method.place.file));
    for (const file of family.files) if (file.abstraction && file.abstraction.scale === Scale.CLASS) markTheFile(graph, file.abstraction, contextOf(file.path));
  }
  return graph;
}
