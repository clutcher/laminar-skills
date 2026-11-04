import { DOES, isAMethodName, isAText, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

export const findExitChain = (model, startName, exitNames) => {
  const chainsToVisit = [[startName]];
  const seen = new Set([startName]);
  while (chainsToVisit.length) {
    const chain = chainsToVisit.shift();
    const last = chain[chain.length - 1];
    if (chain.length > 1 && exitNames.has(last)) return chain;
    if (!isAMethodName(last)) continue;

    const method = model.findMethod(last);
    if (!method) continue;
    for (const reached of model.listNamesReachedFrom(model.findClass(last), method)) {
      if (seen.has(reached)) continue;
      seen.add(reached);
      chainsToVisit.push([...chain, reached]);
    }
  }
  return null;
};

const findComputationDefects = (model, exitNames) => {
  const defects = [];
  for (const { theClass, method, displayName } of model.listMethodsWithClass()) {
    if (theClass.does !== DOES.COMPUTES) continue;

    const chain = findExitChain(model, displayName, exitNames);
    if (chain) defects.push(createRecheckDefect(DEFECT_CODES.COMPUTATION_REACHES_EXIT, model.getMethodPath(theClass, method), `${model.getClassDisplayName(theClass)} computes, and ${displayName} reaches the exit ${chain[chain.length - 1]}: ${chain.join(" -> ")}`));
  }
  return defects;
};

const buildCallerClassesOfExitMap = (model, exitNames) => {
  const callerClassesOfExitMap = new Map([...exitNames].map(exitName => [exitName, new Set()]));
  for (const { theClass, method } of model.listMethodsWithClass()) {
    for (const called of readList(method.calls).filter(isAText).map(name => model.normalizeName(name))) {
      if (callerClassesOfExitMap.has(called)) callerClassesOfExitMap.get(called).add(theClass);
    }
  }
  for (const exit of readList(model.decisions.exits)) {
    const fromClass = isAText(exit.exit) && isAText(exit.from) ? model.findClass(exit.from) : null;
    if (fromClass) callerClassesOfExitMap.get(model.normalizeName(exit.exit)).add(fromClass);
  }
  return callerClassesOfExitMap;
};

const findTwoZoneDefects = (model, exitNames, zoneOrder) => {
  if (!zoneOrder.isFound()) return [];

  const defects = [];
  for (const [exitName, callerClasses] of buildCallerClassesOfExitMap(model, exitNames)) {
    const exitZone = model.findClass(exitName)?.zone;
    const zonedCallers = [...callerClasses].filter(theClass => isAText(theClass.zone));
    const zones = new Set(zonedCallers.map(theClass => theClass.zone));
    const isEveryZoneAllowed = isAText(exitZone) && [...zones].every(zone => zoneOrder.allowsTheCall(zone, exitZone));
    if (zones.size < 2 || isEveryZoneAllowed) continue;

    const callers = zonedCallers.map(theClass => `${model.getClassDisplayName(theClass)} (${theClass.zone})`).join(", ");
    const exitAt = readList(model.decisions.exits).findIndex(exit => isAText(exit.exit) && model.normalizeName(exit.exit) === exitName);
    defects.push(createRecheckDefect(DEFECT_CODES.EXIT_IN_TWO_ZONES, `decisions.exits[${exitAt}].exit`, `the exit ${exitName} is reached from ${zones.size} zones, and the zone order does not allow each of them to reach it: ${callers}`));
  }
  return defects;
};

const findUnreachedExitDefects = (model, exitNames) => {
  const defects = [];
  readList(model.decisions.exits).forEach((exit, at) => {
    if (!isAText(exit.exit) || !isAText(exit.from) || exit.exit === exit.from || !model.findMethod(exit.from)) return;

    const chain = findExitChain(model, model.normalizeName(exit.from), new Set([model.normalizeName(exit.exit)]));
    if (!chain) defects.push(createRecheckDefect(DEFECT_CODES.EXIT_NOT_REACHED_FROM, `decisions.exits[${at}].from`, `${exit.from} does not reach ${exit.exit} by its calls or its private parts`));
  });
  return defects;
};

export const findExitReachDefects = (model, zoneOrder) => {
  const exitNames = model.getExitNames();
  return [...findComputationDefects(model, exitNames), ...findTwoZoneDefects(model, exitNames, zoneOrder), ...findUnreachedExitDefects(model, exitNames)];
};
