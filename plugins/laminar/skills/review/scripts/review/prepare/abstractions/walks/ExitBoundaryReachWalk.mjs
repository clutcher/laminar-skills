import { buildShortenedPlace, CHANGE_MODES, holdsAnAddedLine, isARepeatedCall, readLanguageFamily, LOOP_FORMS, formatDisplayNameOfMethod, repeatsInALoop, ROLE_KINDS, Scale } from "../../../../code/index.mjs";
import { ONLY_CALLS, ONLY_REPEATED_CALLS } from "./CallWalks.mjs";

export const WALKS = Object.freeze({ REPOSITORY: "repository", PATCH: "patch" });

export const DIRECTIONS = Object.freeze({ DOWN: "down", UP: "up" });

export const readCallText = call => (call.receiver ? `${call.receiver}.${call.callee}` : call.callee);

const readLoopKey = place => `${place.path}:${place.line}`;

const STOPS_AT_AN_EXIT = Object.freeze([ROLE_KINDS.EXIT_BOUNDARY]);

const isTheAbstractionWalked = abstraction => abstraction.scale === Scale.METHOD.name && !abstraction.isTest && Boolean(abstraction.lines) && Boolean(readLanguageFamily(abstraction.path));

const startsAWalk = (added, call, loop) => added.has(call.line) || added.has(loop.head);

export class ExitBoundaryReachWalk {
  constructor(repositoryText, mode, addedLinesOf, callGraphOf, callWalks) {
    this.repositoryText = repositoryText;
    this.findCallGraph = callGraphOf;
    this.callWalks = callWalks;
    this.walk = mode === CHANGE_MODES.PATCH ? WALKS.PATCH : WALKS.REPOSITORY;
    this.methodsUnderAnUnwalkedLoopByFamilyMap = new Map();
    this.readAddedLines = addedLinesOf;
  }

  startsADownWalk(method, call) {
    return startsAWalk(this.readAddedLines(method.path), call, call.loop);
  }

  isRecursive(callGraph, method) {
    const start = callGraph.findAbstraction(method);
    for (const step of this.callWalks.walkCallsDown(callGraph, [method], { follows: ONLY_REPEATED_CALLS })) {
      if (step.relation && step.next === start) return true;
    }
    return false;
  }

  collectMethodsUnderAnUnwalkedLoop(family, callGraph) {
    if (!this.methodsUnderAnUnwalkedLoopByFamilyMap.has(family)) {
      const roots = new Set();
      for (const method of callGraph.methods) {
        for (const call of method.calls) {
          if (!repeatsInALoop(call) || this.startsADownWalk(method, call)) continue;
          for (const target of call.targets) roots.add(callGraph.methods[target]);
        }
      }
      const reached = new Uint8Array(callGraph.methods.length);
      for (const step of this.callWalks.walkCallsDown(callGraph, [...roots], { follows: ONLY_REPEATED_CALLS })) {
        if (!step.ambiguous) reached[(step.method || step.callee).id] = 1;
      }
      this.methodsUnderAnUnwalkedLoopByFamilyMap.set(family, reached);
    }
    return this.methodsUnderAnUnwalkedLoopByFamilyMap.get(family);
  }

  buildPlace(filePath, line) {
    const lines = this.repositoryText.readFileLines(filePath) || [];
    return buildShortenedPlace(filePath, line, lines[line - 1] || "");
  }

  buildLoopPlace(filePath, loop) {
    return { path: filePath, line: loop.head, form: loop.form, text: this.buildPlace(filePath, loop.head).text };
  }

  hopOf(method, call) {
    return { path: method.path, line: call.line, method: formatDisplayNameOfMethod(method), call: readCallText(call), text: this.buildPlace(method.path, call.line).text };
  }

  buildEnd(method, calls) {
    return {
      end: { path: method.path, from: method.line, to: method.to, method: formatDisplayNameOfMethod(method) },
      endCalls: calls.map(call => ({ line: call.line, col: call.col, call: readCallText(call), callee: call.callee, on: call.on || [], text: this.buildPlace(method.path, call.line).text })),
    };
  }

  reachOf(abstraction) {
    if (!isTheAbstractionWalked(abstraction)) return null;
    const added = this.readAddedLines(abstraction.path);
    if (!holdsAnAddedLine(added, abstraction.lines.from, abstraction.lines.to)) return null;
    const family = readLanguageFamily(abstraction.path);
    const callGraph = this.findCallGraph(family);
    const method = callGraph ? callGraph.findMethodDeclaredAt(abstraction.path, abstraction.lines.from) : null;
    if (!method) return null;
    const found = { walk: this.walk, down: [], up: [] };
    this.walkDown(callGraph, method, added, found);
    this.walkUp(family, callGraph, method, added, found);
    return found;
  }

  endsBelow(callGraph, method, calls) {
    const ends = [];
    const direct = calls.filter(call => call.end);
    if (direct.length) ends.push({ hops: [this.hopOf(method, direct[0])], ...this.buildEnd(method, direct) });
    const startingCalls = new Set(calls);
    const follows = step => (step.depth === 0 ? ONLY_CALLS(step) && startingCalls.has(step.call) : ONLY_REPEATED_CALLS(step));
    for (const step of this.callWalks.walkCallsDown(callGraph, [method], { follows, stopAt: STOPS_AT_AN_EXIT })) {
      if (!step.leaving || !step.depth) continue;
      const endCalls = step.method.calls.filter(below => below.end);
      if (endCalls.length) ends.push({ hops: step.steps.map(step => this.hopOf(step.caller, step.call)), ...this.buildEnd(step.method, endCalls) });
    }
    return ends;
  }

  walkStartingCallsByLoop(callGraph, method, added) {
    const recursive = this.isRecursive(callGraph, method);
    const callsByLoopMap = new Map();
    for (const call of method.calls) {
      if (!isARepeatedCall(call)) continue;
      const loop = call.loop || (recursive ? { head: method.line, form: LOOP_FORMS.RECURSION } : null);
      if (!loop || !startsAWalk(added, call, loop)) continue;
      if (!callsByLoopMap.has(loop.head)) callsByLoopMap.set(loop.head, { place: this.buildLoopPlace(method.path, loop), calls: [] });
      callsByLoopMap.get(loop.head).calls.push(call);
    }
    return [...callsByLoopMap.values()];
  }

  walkDown(callGraph, method, added, found) {
    found.down = this.walkStartingCallsByLoop(callGraph, method, added)
      .map(({ place, calls }) => ({ direction: DIRECTIONS.DOWN, loop: place, ends: this.endsBelow(callGraph, method, calls) }))
      .filter(loopReach => loopReach.ends.length);
  }

  walkUp(family, callGraph, method, added, found) {
    if (!this.collectMethodsUnderAnUnwalkedLoop(family, callGraph)[method.id]) return;
    const addedCalls = method.calls.filter(call => added.has(call.line) && isARepeatedCall(call));
    if (!addedCalls.length) return;
    const loops = this.findLoopsAboveTheMethod(callGraph, method);
    if (!loops.length) return;
    const ends = this.endsBelow(callGraph, method, addedCalls);
    if (!ends.length) return;
    found.up = loops.map(above => ({ direction: DIRECTIONS.UP, loop: above.loop, ends: ends.map(below => ({ ...below, hops: [...above.hops, ...below.hops] })) }));
  }

  findLoopsAboveTheMethod(callGraph, method) {
    const loopsByPlaceMap = new Map();
    for (const step of this.callWalks.walkCallsUp(callGraph, [method], { follows: ONLY_REPEATED_CALLS })) {
      if (!step.relation) continue;
      const { caller, call } = step;
      if (!repeatsInALoop(call) || this.startsADownWalk(caller, call)) continue;
      const loop = this.buildLoopPlace(caller.path, call.loop);
      if (!loopsByPlaceMap.has(readLoopKey(loop))) loopsByPlaceMap.set(readLoopKey(loop), { loop, hops: [...step.steps].reverse().map(step => this.hopOf(step.caller, step.call)) });
    }
    return [...loopsByPlaceMap.values()];
  }
}
