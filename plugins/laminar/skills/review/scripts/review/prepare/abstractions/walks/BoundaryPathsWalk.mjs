import { readBoundaryRank, CHANGE_KINDS, changesTheCode, holdsAnAddedLine, isAFileWithBehavior, isEntryBoundaryRank, isTestPath, readLanguageFamily, formatDisplayNameOfMethod, Scale, VISIBILITIES } from "../../../../code/index.mjs";
import { readCallText } from "./ExitBoundaryReachWalk.mjs";
import { ONLY_CALLS, ONLY_REPEATED_CALLS } from "./CallWalks.mjs";
import { FileLines, listLinesFromTo } from "../lookups/FileLines.mjs";
import { MethodParameters } from "../lookups/MethodParameters.mjs";
import { MethodText } from "../lookups/MethodText.mjs";

export const BOUNDARY_PATH_KINDS = Object.freeze({ INNER: "inner", ENTRY: "entry" });

export const MAX_ENTRY_METHODS = 3;
export const MAX_CALLS_BELOW_AN_ENTRY_METHOD = 4;
export const MAX_ENTRY_METHOD_LINES = 16;
export const MAX_OWN_LINES = 60;
export const MAX_PASSED_TO = 3;
export const MAX_PASSED_TO_LINES = 12;
export const MAX_SINKS = 3;
export const MAX_SINK_DEPTH = 4;
const MAX_METHODS_WALKED = 200;
const MAX_START_METHODS = 8;

const WALKED_SCALES = new Set([Scale.METHOD.name, Scale.CLASS.name]);

const isJudgedAtItsOwnScale = abstraction => abstraction.scale === Scale.METHOD.name || abstraction.changeKind !== CHANGE_KINDS.INTERNALS_CHANGED;

const isAChangedProductionAbstraction = abstraction => WALKED_SCALES.has(abstraction.scale) && !abstraction.isTest && Boolean(abstraction.lines)
  && changesTheCode(abstraction.changeKind) && isAFileWithBehavior(abstraction.path) && isJudgedAtItsOwnScale(abstraction);

const isAnIoEndCall = call => Boolean(call.end && call.exit);

const isCalledFromProductionCode = step => !isTestPath(step.caller.path);

const isCallingIntoProductionCode = step => !isTestPath(step.callee.path);

const isARepeatedCallFromProductionCode = step => ONLY_REPEATED_CALLS(step) && isCalledFromProductionCode(step);

const isACallIntoProductionCode = step => ONLY_CALLS(step) && isCallingIntoProductionCode(step);

const MAX_RECEIVERS_SHOWN = 2;

const ENTRY_METHOD_LINES = Object.freeze({ TO_THE_CALL: "lines to the call", SIGNATURE_AND_CALL: "signature and call lines" });

export class BoundaryPathsWalk {
  constructor(repositoryText, callGraphOf, addedLinesOf, callWalks) {
    this.repositoryText = repositoryText;
    this.findCallGraph = callGraphOf;
    this.callWalks = callWalks;
    this.readAddedLines = addedLinesOf;
    this.isEntryBoundaryFileByPathMap = new Map();
    this.fileLines = new FileLines(repositoryText);
    this.methodText = new MethodText(this.fileLines);
    this.methodParameters = new MethodParameters(this.methodText);
  }

  isAnEntryBoundaryFile(filePath) {
    if (!this.isEntryBoundaryFileByPathMap.has(filePath)) this.isEntryBoundaryFileByPathMap.set(filePath, isEntryBoundaryRank(readBoundaryRank(this.callWalks.codeGraph.findRolesOfTheFile(filePath), this.callWalks.codeGraph.findFolderRoles(filePath), VISIBILITIES.EXPOSED)));
    return this.isEntryBoundaryFileByPathMap.get(filePath);
  }

  findProductionCallers(callGraph, id) {
    return callGraph.readRepeatedCallers(id)
      .map(({ method, call }) => ({ caller: callGraph.methods[method], call: callGraph.methods[method].calls[call] }))
      .filter(({ caller }) => !isTestPath(caller.path));
  }

  isAnEntryMethod(callGraph, method) {
    if (!this.isAnEntryBoundaryFile(method.path)) return false;
    return !this.findProductionCallers(callGraph, method.id).some(({ caller }) => caller.path === method.path && caller.id !== method.id);
  }

  findTheMethodOfTheAbstraction(callGraph, abstraction) {
    return callGraph.findMethodDeclaredAt(abstraction.path, abstraction.lines.from);
  }

  findStartMethods(callGraph, abstraction) {
    if (abstraction.scale === Scale.METHOD.name) {
      const method = this.findTheMethodOfTheAbstraction(callGraph, abstraction);
      return method ? [method] : [];
    }
    const inside = (callGraph.methodsByPathMap.get(abstraction.path) || []).filter(method => method.line >= abstraction.lines.from && method.to <= abstraction.lines.to);
    const added = this.readAddedLines(abstraction.path);
    const touched = inside.filter(method => holdsAnAddedLine(added, method.line, method.to));
    return (touched.length ? touched : inside).slice(0, MAX_START_METHODS);
  }

  findStartMethodsReceivingAValue(callGraph, abstraction) {
    return this.findStartMethods(callGraph, abstraction).filter(method => this.methodParameters.canReceiveAValue(method));
  }

  findEntryMethodsAboveTheStarts(callGraph, starts) {
    const entryMethodsByCallerIdMap = new Map();
    for (const step of this.callWalks.walkCallsUp(callGraph, starts, { follows: isARepeatedCallFromProductionCode })) {
      if (step.leaving) {
        if (step.reached > MAX_METHODS_WALKED || entryMethodsByCallerIdMap.size >= MAX_ENTRY_METHODS) break;
        continue;
      }
      if (!step.first) continue;
      const below = [...step.steps].reverse().map(step => ({ method: step.caller, line: step.call.line }));
      if (this.isAnEntryMethod(callGraph, step.caller)) {
        if (entryMethodsByCallerIdMap.size < MAX_ENTRY_METHODS) entryMethodsByCallerIdMap.set(step.caller.id, { entry: step.caller, calls: below });
        step.expand = false;
        continue;
      }
      step.expand = below.length < MAX_CALLS_BELOW_AN_ENTRY_METHOD;
    }
    return [...entryMethodsByCallerIdMap.values()];
  }

  buildShownEntryMethod({ entry: entryMethod, calls }) {
    const [intoTheEntryMethod, ...below] = calls;
    const callLines = this.methodText.listCallLines(entryMethod, intoTheEntryMethod.line);
    const toTheCall = intoTheEntryMethod.line - entryMethod.line + 1 <= MAX_ENTRY_METHOD_LINES;
    const numbers = toTheCall
      ? [...new Set([...listLinesFromTo(entryMethod.line, intoTheEntryMethod.line), ...callLines])]
      : [...new Set([...this.methodText.listSignatureLines(entryMethod), ...callLines])];
    return {
      displayName: formatDisplayNameOfMethod(entryMethod),
      path: entryMethod.path,
      from: entryMethod.line,
      to: entryMethod.to,
      shown: toTheCall ? ENTRY_METHOD_LINES.TO_THE_CALL : ENTRY_METHOD_LINES.SIGNATURE_AND_CALL,
      lines: this.fileLines.readNumberedLines(entryMethod.path, numbers),
      calls: below.map(call => ({ displayName: formatDisplayNameOfMethod(call.method), path: call.method.path, ...this.fileLines.readNumberedLines(call.method.path, [call.line])[0] })),
    };
  }

  *walkLeavingStepsWithinTheWalkBudget(callGraph, starts) {
    for (const step of this.callWalks.walkCallsDown(callGraph, starts, { follows: isACallIntoProductionCode, maxDepth: MAX_SINK_DEPTH - 1 })) {
      if (!step.leaving) continue;
      if (step.reached > MAX_METHODS_WALKED) return;
      yield step;
    }
  }

  addTheDistinctEndCallsOf(method, sinksByPlaceMap) {
    for (const call of method.calls.filter(isAnIoEndCall)) {
      const place = `${method.path}:${call.line}`;
      if (sinksByPlaceMap.size >= MAX_SINKS || sinksByPlaceMap.has(place)) continue;
      sinksByPlaceMap.set(place, this.buildSink(method, call));
    }
  }

  findSinksBelowTheStarts(callGraph, starts) {
    const sinksByPlaceMap = new Map();
    for (const step of this.walkLeavingStepsWithinTheWalkBudget(callGraph, starts)) {
      if (sinksByPlaceMap.size >= MAX_SINKS) break;
      this.addTheDistinctEndCallsOf(step.method, sinksByPlaceMap);
    }
    return [...sinksByPlaceMap.values()];
  }

  buildSink(method, call) {
    return { displayName: formatDisplayNameOfMethod(method), path: method.path, call: readCallText(call), on: (call.on || []).slice(0, MAX_RECEIVERS_SHOWN), ...this.fileLines.readNumberedLines(method.path, [call.line])[0] };
  }

  isAProductionMethodReceivingAValueFrom(entryMethod, called) {
    return called.id !== entryMethod.id && !isTestPath(called.path) && this.methodParameters.canReceiveAValue(called);
  }

  buildPassedTo(called, call) {
    return {
      displayName: formatDisplayNameOfMethod(called),
      path: called.path,
      from: called.line,
      to: called.to,
      calledAt: call.line,
      lines: this.fileLines.readNumberedLines(called.path, listLinesFromTo(called.line, Math.min(called.to, called.line + MAX_PASSED_TO_LINES - 1))),
    };
  }

  readMethodsPassedTo(callGraph, entryMethod) {
    const passedToByTargetMap = new Map();
    for (const call of entryMethod.calls) {
      for (const target of call.targets) {
        if (passedToByTargetMap.size >= MAX_PASSED_TO || passedToByTargetMap.has(target)) continue;
        const called = callGraph.methods[target];
        if (this.isAProductionMethodReceivingAValueFrom(entryMethod, called)) passedToByTargetMap.set(target, this.buildPassedTo(called, call));
      }
    }
    return [...passedToByTargetMap.values()];
  }

  buildTheOwnFields(abstraction) {
    const to = Math.min(abstraction.lines.to, abstraction.lines.from + MAX_OWN_LINES - 1);
    return {
      abstractionId: abstraction.id,
      displayName: abstraction.displayName,
      name: abstraction.name,
      enclosing: abstraction.enclosingTypeName || "",
      scale: abstraction.scale,
      changeKind: abstraction.changeKind,
      boundaryRank: abstraction.boundaryRank,
      path: abstraction.path,
      from: abstraction.lines.from,
      to: abstraction.lines.to,
      lines: this.fileLines.readNumberedLines(abstraction.path, listLinesFromTo(abstraction.lines.from, to)),
    };
  }

  findInnerPath(callGraph, abstraction) {
    if (this.isAnEntryBoundaryFile(abstraction.path)) return null;
    const starts = this.findStartMethodsReceivingAValue(callGraph, abstraction);
    if (!starts.length) return null;
    const entryMethods = this.findEntryMethodsAboveTheStarts(callGraph, starts);
    if (!entryMethods.length) return null;
    return { kind: BOUNDARY_PATH_KINDS.INNER, ...this.buildTheOwnFields(abstraction), entryMethods: entryMethods.map(found => this.buildShownEntryMethod(found)), sinks: this.findSinksBelowTheStarts(callGraph, starts) };
  }

  findEntryPath(callGraph, abstraction) {
    const method = abstraction.scale === Scale.METHOD.name ? this.findTheMethodOfTheAbstraction(callGraph, abstraction) : null;
    if (!method || !this.methodParameters.canReceiveAValue(method) || !this.isAnEntryMethod(callGraph, method)) return null;
    const passedTo = this.readMethodsPassedTo(callGraph, method);
    if (!passedTo.length) return null;
    return { kind: BOUNDARY_PATH_KINDS.ENTRY, ...this.buildTheOwnFields(abstraction), passedTo, sinks: this.findSinksBelowTheStarts(callGraph, [method]) };
  }

  findTheCallGraphOfTheAbstraction(abstraction) {
    const family = readLanguageFamily(abstraction.path);
    return family ? this.findCallGraph(family) : null;
  }

  findInnerPaths(abstractions) {
    const paths = [];
    const withAMethodPath = new Set();
    for (const abstraction of abstractions.filter(given => given.scale === Scale.METHOD.name)) {
      const callGraph = this.findTheCallGraphOfTheAbstraction(abstraction);
      const found = callGraph ? this.findInnerPath(callGraph, abstraction) : null;
      if (!found) continue;
      paths.push(found);
      withAMethodPath.add(`${abstraction.path}\u0000${abstraction.enclosingTypeName || ""}`);
    }
    for (const abstraction of abstractions.filter(given => given.scale === Scale.CLASS.name && !withAMethodPath.has(`${given.path}\u0000${given.name}`))) {
      const callGraph = this.findTheCallGraphOfTheAbstraction(abstraction);
      const found = callGraph ? this.findInnerPath(callGraph, abstraction) : null;
      if (found) paths.push(found);
    }
    return paths;
  }

  findEntryPaths(abstractions, innerPaths) {
    const reachedEntryMethods = new Set(innerPaths.flatMap(found => found.entryMethods.map(entryMethod => `${entryMethod.path}:${entryMethod.from}`)));
    return abstractions
      .map(abstraction => ({ abstraction, callGraph: this.findTheCallGraphOfTheAbstraction(abstraction) }))
      .filter(({ callGraph }) => callGraph)
      .map(({ abstraction, callGraph }) => this.findEntryPath(callGraph, abstraction))
      .filter(found => found && !reachedEntryMethods.has(`${found.path}:${found.from}`));
  }

  walkAbstractions(abstractions) {
    const changed = abstractions.filter(isAChangedProductionAbstraction);
    const innerPaths = this.findInnerPaths(changed);
    return [...innerPaths, ...this.findEntryPaths(changed, innerPaths)];
  }
}
