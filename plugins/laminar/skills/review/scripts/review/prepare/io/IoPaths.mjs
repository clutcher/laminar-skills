import { isResolved, buildWorkflowGroups } from "./IoSummary.mjs";
import { compareByPathAndLine, formatCallPlaceKey, formatPlaceKey } from "../../../code/index.mjs";

const END_MARK = "E";

const createEndMethodKey = end => `${end.path}:${end.from}`;

export const createEndCallKey = (endPath, call) => `${endPath}:${formatCallPlaceKey(call.line, call.col)}`;

const compareByPlace = (left, right) => left.line - right.line || left.col - right.col;

const readLoops = abstraction => [...abstraction.ioReach.down, ...abstraction.ioReach.up];

const compareByDepthThenPlace = (left, right) => left.hops.length - right.hops.length || compareByPathAndLine(left.loop, right.loop);

const readLastHop = reached => reached.hops[reached.hops.length - 1];

const UP = "up";

const findChangedCall = (loopReach, changedMethod, hops) => loopReach.direction === UP ? hops.find(hop => hop.method === changedMethod) || null : null;

export const readExample = reachingCall => reachingCall.loops[0];

class EndBook {
  constructor() {
    this.methodsByKeyMap = new Map();
  }

  add(reached) {
    const key = createEndMethodKey(reached.end);
    if (!this.methodsByKeyMap.has(key)) this.methodsByKeyMap.set(key, { ...reached.end, key, callsByKeyMap: new Map() });
    const endMethod = this.methodsByKeyMap.get(key);
    for (const call of reached.endCalls) {
      const callKey = createEndCallKey(reached.end.path, call);
      if (!endMethod.callsByKeyMap.has(callKey)) endMethod.callsByKeyMap.set(callKey, { ...call, key: callKey });
    }
  }

  numberEndMethods() {
    return [...this.methodsByKeyMap.values()].map((method, index) => {
      const id = `${END_MARK}${index + 1}`;
      const calls = [...method.callsByKeyMap.values()].sort(compareByPlace).map((call, at) => ({ ...call, id: `${id}.${at + 1}` }));
      return { id, path: method.path, from: method.from, to: method.to, method: method.method, key: method.key, calls };
    });
  }
}

class ReachingCallBook {
  constructor() {
    this.reachingCallsByEndMap = new Map();
  }

  add(changedMethod, loopReach, reached) {
    const endKey = createEndMethodKey(reached.end);
    if (!this.reachingCallsByEndMap.has(endKey)) this.reachingCallsByEndMap.set(endKey, new Map());
    const reachingCalls = this.reachingCallsByEndMap.get(endKey);
    const hop = readLastHop(reached);
    const reachingCallKey = formatPlaceKey(hop);
    if (!reachingCalls.has(reachingCallKey)) reachingCalls.set(reachingCallKey, { hop, loopsByKeyMap: new Map() });
    const loopsByKeyMap = reachingCalls.get(reachingCallKey).loopsByKeyMap;
    const loopKey = formatPlaceKey(loopReach.loop);
    const knownLoop = loopsByKeyMap.get(loopKey);
    if (knownLoop && knownLoop.hops.length <= reached.hops.length) return;
    loopsByKeyMap.set(loopKey, { direction: loopReach.direction, changedMethod, changedCall: findChangedCall(loopReach, changedMethod, reached.hops), loop: loopReach.loop, hops: reached.hops });
  }

  listReachingCalls(end) {
    return [...(this.reachingCallsByEndMap.get(end.key) || new Map()).values()]
      .map(({ hop, loopsByKeyMap }) => ({ ...hop, loops: [...loopsByKeyMap.values()].sort(compareByDepthThenPlace) }))
      .sort(compareByPathAndLine);
  }
}

const hasWalkedOnlyThePatch = ioChainAbstractions => ioChainAbstractions.some(({ abstraction }) => abstraction.ioReach.walk === "patch");

const removeKey = ({ key, ...call }) => call;

export function buildIoPaths(ioChainAbstractions, { rules = null } = {}) {
  const book = new EndBook();
  const reachingCalls = new ReachingCallBook();
  for (const { abstraction } of ioChainAbstractions) {
    for (const loopReach of readLoops(abstraction)) {
      for (const reached of loopReach.ends) {
        book.add(reached);
        reachingCalls.add(abstraction.displayName, loopReach, reached);
      }
    }
  }
  const ends = book.numberEndMethods();
  const onlyThePatch = hasWalkedOnlyThePatch(ioChainAbstractions);
  const judgeCalls = ends.map(end => ({
    end: { id: end.id, path: end.path, from: end.from, to: end.to, method: end.method },
    calls: end.calls.map(removeKey),
    reachingCalls: reachingCalls.listReachingCalls(end),
    onlyThePatch,
  }));
  return {
    ends,
    needsAnIoRuleScreenCall: !rules && ends.some(end => end.calls.some(isResolved)),
    groups: buildWorkflowGroups(ends),
    judgeCalls,
  };
}
