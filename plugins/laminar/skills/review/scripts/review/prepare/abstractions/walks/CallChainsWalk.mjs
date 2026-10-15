import { holdsAnAddedLine, isTestPath, readLanguageFamily, formatDisplayNameOfMethod, Scale } from "../../../../code/index.mjs";
import { MethodCallers } from "../references/MethodCallers.mjs";
import { UnionFind } from "../../../../collections/UnionFind.mjs";

export const CHAIN_DEPTH = 3;

const findAbstractionId = (method, abstractions) => abstractions
  .filter(abstraction => abstraction.scale === Scale.METHOD.name && abstraction.path === method.path && abstraction.name === method.name && abstraction.lines)
  .sort((left, right) => Math.abs(left.lines.from - method.line) - Math.abs(right.lines.from - method.line))
  .map(abstraction => abstraction.id)[0] || "";

const groupByShared = (chains, keysOf) => {
  const union = new UnionFind();
  for (const chain of chains) {
    const [first, ...rest] = keysOf(chain);
    for (const key of rest) union.join(first, key);
  }
  const chainsByRootMap = new Map();
  for (const chain of chains) {
    const root = union.findRoot(keysOf(chain)[0]);
    if (!chainsByRootMap.has(root)) chainsByRootMap.set(root, []);
    chainsByRootMap.get(root).push(chain);
  }
  return [...chainsByRootMap.values()];
};

const readNumberedLines = (lines, from, to) => {
  const numbered = [];
  for (let line = from; line <= to; line++) numbered.push({ line, text: String(lines[line - 1] || "") });
  return numbered;
};

const holdsAFragmentToJudge = joinedChains => joinedChains.some(chain => chain.fragments.length);

class FamilyCallChainsWalk {
  constructor(repositoryText, testCode, callGraph, references, callWalks) {
    this.repositoryText = repositoryText;
    this.callGraph = callGraph;
    this.callWalks = callWalks;
    this.callers = new MethodCallers(repositoryText, testCode, callGraph, references);
  }

  readNameKey(id) {
    const method = this.callGraph.methods[id];
    return `${method.enclosingTypeName}#${method.name}`;
  }

  areOverloads(ids) {
    return ids.every(id => this.readNameKey(id) === this.readNameKey(ids[0]));
  }

  readFileLines(method) {
    return this.repositoryText.readFileLines(method.path) || [];
  }

  followsTheCall(call) {
    return call.targets.length > 0 && this.areOverloads(call.targets);
  }

  reachOf(root, descendsThrough = () => true) {
    const depthByMethodIdMap = new Map();
    const follows = step => this.followsTheCall(step.call);
    for (const step of this.callWalks.walkCallsDown(this.callGraph, [this.callGraph.methods[root]], { follows, maxDepth: CHAIN_DEPTH })) {
      if (!step.relation || !step.first) continue;
      depthByMethodIdMap.set(step.callee.id, step.depth);
      step.expand = descendsThrough(step.callee.id);
    }
    return depthByMethodIdMap;
  }

  findCallers(id) {
    return this.callers.findCallers(this.callGraph.methods[id]);
  }

  isInside(callerId, inside) {
    if (callerId === null) return false;
    const key = this.readNameKey(callerId);
    return inside.has(callerId) || [...inside].some(id => this.readNameKey(id) === key);
  }

  hasEveryCallerIn(id, inside) {
    const found = this.findCallers(id);
    return !found.stopped && found.callers.length > 0 && found.callers.every(caller => this.isInside(caller.id, inside));
  }

  collectInside(root) {
    const inside = new Set([root, ...this.reachOf(root).keys()]);
    for (let changed = true; changed;) {
      changed = false;
      for (const id of [...inside]) {
        if (id === root || this.hasEveryCallerIn(id, inside)) continue;
        inside.delete(id);
        changed = true;
      }
      const reachable = this.reachOf(root, reachedId => inside.has(reachedId));
      for (const id of [...inside]) if (id !== root && !reachable.has(id)) { inside.delete(id); changed = true; }
    }
    return inside;
  }

  buildChains(roots) {
    return [...roots].map(root => {
      const inside = this.collectInside(root);
      const reached = this.reachOf(root, id => inside.has(id));
      const fragments = [...reached.keys()].filter(id => inside.has(id));
      const stops = [...reached.keys()].filter(id => !inside.has(id));
      return { root, methods: [root, ...fragments], stops, fragments };
    });
  }

  findCallerPlaces(id, inside) {
    return this.findCallers(id).callers.filter(caller => this.isInside(caller.id, inside))
      .map(caller => ({ displayName: formatDisplayNameOfMethod(this.callGraph.methods[caller.id]), path: caller.path, line: caller.line }));
  }

  countOutside(id, inside) {
    const found = this.findCallers(id);
    const outside = found.callers.filter(caller => !this.isInside(caller.id, inside));
    return { callersOutside: new Set(outside.map(caller => caller.id === null ? `${caller.path}:${caller.line}` : caller.id)).size, stopped: found.stopped };
  }

  findMethod(id, { roots, inside }) {
    const method = this.callGraph.methods[id];
    return {
      displayName: formatDisplayNameOfMethod(method),
      path: method.path,
      from: method.line,
      to: method.to,
      start: roots.has(id),
      calledAt: this.findCallerPlaces(id, inside),
      ...this.countOutside(id, inside),
      lines: readNumberedLines(this.readFileLines(method), method.line, method.to),
    };
  }

  stopOf(id, inside) {
    const method = this.callGraph.methods[id];
    return {
      displayName: formatDisplayNameOfMethod(method),
      path: method.path,
      from: method.line,
      to: method.to,
      calledAt: this.findCallerPlaces(id, inside),
      ...this.countOutside(id, inside),
      lines: readNumberedLines(this.readFileLines(method), method.line, method.line),
    };
  }

  buildGroup(chains, abstractionIdByMethodMap) {
    const roots = new Set(chains.map(chain => chain.root));
    const methodIds = [...new Set(chains.flatMap(chain => chain.methods))].sort((left, right) => left - right);
    const inside = new Set(methodIds);
    const stopIds = [...new Set(chains.flatMap(chain => chain.stops))].filter(id => !methodIds.includes(id)).sort((left, right) => left - right);
    const context = { roots, inside };
    return {
      abstractionIds: [...new Set([...roots].map(id => abstractionIdByMethodMap.get(id)).filter(Boolean))],
      methods: methodIds.map(id => this.findMethod(id, context)),
      stops: stopIds.map(id => this.stopOf(id, inside)),
    };
  }

  buildGroups(roots, abstractionIdByMethodMap) {
    return groupByShared(this.buildChains(roots), chain => chain.methods)
      .filter(holdsAFragmentToJudge)
      .map(joined => this.buildGroup(joined, abstractionIdByMethodMap));
  }
}

export class CallChainsWalk {
  constructor(repositoryText, testCode, change, callGraphOf, references, callWalks) {
    this.repositoryText = repositoryText;
    this.testCode = testCode;
    this.findCallGraph = callGraphOf;
    this.references = references;
    this.callWalks = callWalks;
    this.addedLinesByPathMap = change.readAddedLinesByPath();
  }

  collectRootsByFamily(abstractions) {
    const rootsByFamilyMap = new Map();
    for (const [filePath, addedLines] of this.addedLinesByPathMap) {
      const family = readLanguageFamily(filePath);
      const callGraph = family && !isTestPath(filePath) ? this.findCallGraph(family) : null;
      if (!callGraph) continue;
      for (const method of callGraph.methodsByPathMap.get(filePath) || []) {
        if (!holdsAnAddedLine(addedLines, method.line, method.to)) continue;
        if (!rootsByFamilyMap.has(family)) rootsByFamilyMap.set(family, { callGraph, abstractionIdByMethodMap: new Map() });
        rootsByFamilyMap.get(family).abstractionIdByMethodMap.set(method.id, findAbstractionId(method, abstractions));
      }
    }
    return rootsByFamilyMap;
  }

  buildGroups(abstractions) {
    const groups = [];
    for (const { callGraph, abstractionIdByMethodMap } of this.collectRootsByFamily(abstractions).values()) {
      groups.push(...new FamilyCallChainsWalk(this.repositoryText, this.testCode, callGraph, this.references, this.callWalks).buildGroups(new Set(abstractionIdByMethodMap.keys()), abstractionIdByMethodMap));
    }
    return groups;
  }
}
