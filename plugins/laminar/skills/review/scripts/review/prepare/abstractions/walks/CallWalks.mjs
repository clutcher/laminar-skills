import { ChainWalker, isARepeatedCall, RELATION_KINDS, Scale, WALK_DIRECTIONS } from "../../../../code/index.mjs";

const ALONG_CALLS = Object.freeze([RELATION_KINDS.CALLS]);

const UNBOUNDED = Number.MAX_SAFE_INTEGER;

const EVERY_CALL = () => true;

export const ONLY_CALLS = step => !step.relation.reference.isAMethodReference();

export const ONLY_REPEATED_CALLS = step => ONLY_CALLS(step) && isARepeatedCall(step.call);

export class CallWalks {
  constructor(codeGraph, nameMatchedTargets) {
    this.codeGraph = codeGraph;
    this.nameMatchedTargets = nameMatchedTargets;
  }

  walkCallsDown(callGraph, starts, options = {}) {
    return this.walk(callGraph, starts, { ...options, direction: WALK_DIRECTIONS.DOWN });
  }

  walkCallsUp(callGraph, starts, options = {}) {
    return this.walk(callGraph, starts, { ...options, direction: WALK_DIRECTIONS.UP });
  }

  walk(callGraph, starts, { direction, follows = EVERY_CALL, maxDepth = UNBOUNDED, stopAt = [] }) {
    const from = starts.map(method => callGraph.findAbstraction(method)).filter(Boolean);
    if (!from.length) return [];
    const buildStep = relation => ({ relation, call: callGraph.findCall(relation.reference), caller: callGraph.findMethod(relation.from), callee: callGraph.findMethod(relation.to) });
    const walker = new ChainWalker({
      from,
      direction,
      along: ALONG_CALLS,
      scale: Scale.METHOD,
      stopAt,
      maxDepth,
      crossApplications: true,
      nameMatchedTargets: this.nameMatchedTargets,
      follows: (relation, relations) => follows({ ...buildStep(relation), depth: relations.length }),
    });
    return this.translate(walker.walkBreadthFirst(this.codeGraph), buildStep, callGraph);
  }

  *translate(events, stepOf, callGraph) {
    for (const event of events) {
      if (event.leaving) Object.assign(event, { method: callGraph.findMethod(event.leaving), depth: event.relations.length, steps: event.relations.map(stepOf) });
      else if (!event.ambiguous) Object.assign(event, stepOf(event.relation), { depth: event.relations.length, steps: event.relations.map(stepOf) });
      yield event;
    }
  }
}
