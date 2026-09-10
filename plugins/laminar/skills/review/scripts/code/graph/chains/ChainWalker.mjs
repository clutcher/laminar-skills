import { Chain, CHAIN_END_REASONS, ChainEnd, readNextAlong, WALK_DIRECTIONS } from "./Chain.mjs";
import { EVIDENCE_KINDS } from "../Evidence.mjs";
import { RELATION_KINDS } from "../relations/Relation.mjs";
import { ROLE_KINDS } from "../abstractions/Role.mjs";

export const DEFAULT_MAX_DEPTH = 8;

export const DEFAULT_NAME_MATCHED_TARGETS = 1;

const END_REASON_BY_ROLE_MAP = Object.freeze({
  [ROLE_KINDS.ENTRY_BOUNDARY]: CHAIN_END_REASONS.ENTRY_BOUNDARY,
  [ROLE_KINDS.EXIT_BOUNDARY]: CHAIN_END_REASONS.EXIT_BOUNDARY,
  [ROLE_KINDS.TEST]: CHAIN_END_REASONS.TEST,
});

const isADispatchToImplementations = relations => relations.every(relation => relation.evidence.kind === EVIDENCE_KINDS.DECLARED);

const countEnclosingAbstractions = relations => new Set(relations.map(relation => relation.to.parent || relation.to)).size;

const takesTheArguments = argumentCount => relation => {
  const counted = relation.to.measures.parameterCount;
  return !counted || (argumentCount >= counted.least && (counted.most === null || argumentCount <= counted.most));
};

const findOverloadsTakingTheArguments = (reference, possibleTargets) => {
  if (reference.argumentCount === null || countEnclosingAbstractions(possibleTargets) !== 1) return possibleTargets;
  const taking = possibleTargets.filter(takesTheArguments(reference.argumentCount));
  return taking.length ? taking : possibleTargets;
};

export const isWithinTheNameMatchedLimit = (count, nameMatchedTargets) => count <= nameMatchedTargets;

export const findFollowedRelations = (graph, reference, nameMatchedTargets = DEFAULT_NAME_MATCHED_TARGETS) => {
  const possibleTargets = graph.findRelationsWithReference(reference);
  if (!isWithinTheNameMatchedLimit(countEnclosingAbstractions(possibleTargets), nameMatchedTargets) && !isADispatchToImplementations(possibleTargets)) return null;
  return findOverloadsTakingTheArguments(reference, possibleTargets);
};

const findFollowedOfTheGroup = (group, followed) => group.filter(relation => followed.includes(relation));

const FIRST = -1;

const readColumn = reference => (reference && reference.column !== null && reference.column !== undefined ? reference.column : FIRST);

const findPlaceOfTheRelation = relation => (relation.reference && relation.reference.place) || relation.place;

const readLine = relation => (findPlaceOfTheRelation(relation) ? findPlaceOfTheRelation(relation).startLine : FIRST);

const compareInReadingOrder = (left, right) => readLine(left) - readLine(right) || readColumn(left.reference) - readColumn(right.reference);

const ALWAYS = () => true;

const groupByReference = relations => {
  const relationsByReferenceMap = new Map();
  for (const relation of relations) {
    const key = relation.reference || relation;
    if (!relationsByReferenceMap.has(key)) relationsByReferenceMap.set(key, []);
    relationsByReferenceMap.get(key).push(relation);
  }
  return [...relationsByReferenceMap.values()];
};

export class ChainWalker {
  constructor({ from, direction = WALK_DIRECTIONS.DOWN, along = [RELATION_KINDS.CALLS], scale = [from].flat()[0].scale, stopAt = [], maxDepth = DEFAULT_MAX_DEPTH, crossApplications = false, nameMatchedTargets = DEFAULT_NAME_MATCHED_TARGETS, follows = ALWAYS }) {
    Object.assign(this, { from, direction, scale, maxDepth, crossApplications, nameMatchedTargets, follows });
    this.along = Object.freeze([...along]);
    this.stopAt = Object.freeze([...stopAt]);
    Object.freeze(this);
  }

  walk(graph) {
    const start = this.from.findAncestorAt(this.scale);
    if (!start) return [];
    const chains = [];
    const finish = (relations, end) => chains.push(new Chain({ start, relations, end, scale: this.scale, direction: this.direction }));
    const extend = (at, relations, visited) => {
      const endReason = this.findEndReasonAt(at, relations);
      if (endReason) return finish(relations, new ChainEnd({ reason: endReason, at }));
      const steps = this.listStepsFrom(graph, at);
      const unresolved = this.findUnresolvedAt(graph, at);
      if (!steps.length && !unresolved.length) return finish(relations, null);
      for (const unresolvedReference of unresolved) finish(relations, new ChainEnd({ reason: CHAIN_END_REASONS.UNRESOLVED, at, reference: unresolvedReference.reference, possibleTargets: unresolvedReference.possibleTargets }));
      for (const step of steps) {
        if (step.ambiguous) { finish(relations, new ChainEnd({ reason: CHAIN_END_REASONS.AMBIGUOUS, at, reference: step.reference, possibleTargets: step.possibleTargets })); continue; }
        for (const relation of step.relations) {
          const next = readNextAlong(relation, this.direction);
          const taken = [...relations, relation];
          if (visited.has(next)) finish(taken, new ChainEnd({ reason: CHAIN_END_REASONS.CYCLE, at: next }));
          else if (this.leavesTheApplication(start, next)) finish(taken, new ChainEnd({ reason: CHAIN_END_REASONS.LEAVES_APPLICATION, at: next }));
          else extend(next, taken, new Set([...visited, next]));
        }
      }
      return null;
    };
    extend(start, [], new Set([start]));
    return chains;
  }

  *walkBreadthFirst(graph) {
    const starts = [...new Set([this.from].flat().map(at => at.findAncestorAt(this.scale)).filter(Boolean))];
    const reached = new Set(starts);
    const pending = starts.map(at => ({ at, relations: [] }));
    for (let index = 0; index < pending.length; index++) {
      const { at, relations } = pending[index];
      yield { leaving: at, relations, reached: reached.size };
      if (this.findEndReasonAt(at, relations)) continue;
      for (const step of this.listOrderedStepsFrom(graph, at, relations)) {
        if (step.ambiguous) { yield { ambiguous: true, at, reference: step.reference, possibleTargets: step.possibleTargets, relations }; continue; }
        for (const relation of step.relations) {
          const next = readNextAlong(relation, this.direction);
          const relationStep = { relation, from: at, next, relations: [...relations, relation], first: !reached.has(next), expand: true };
          yield relationStep;
          if (!relationStep.first) continue;
          reached.add(next);
          if (relationStep.expand && (this.crossApplications || !this.leavesTheApplication(starts[0], next))) pending.push({ at: next, relations: relationStep.relations });
        }
      }
    }
  }

  listOrderedStepsFrom(graph, at, relations) {
    const down = this.direction === WALK_DIRECTIONS.DOWN;
    const ordered = (down ? graph.findLiftedFrom(at, this.scale) : graph.findLiftedTo(at, this.scale))
      .filter(relation => this.along.includes(relation.kind) && this.follows(relation, relations))
      .sort(down ? compareInReadingOrder : (left, right) => graph.callGraphAbstractions.readMethodPosition(left.from) - graph.callGraphAbstractions.readMethodPosition(right.from) || compareInReadingOrder(left, right));
    return this.buildStepsOfTheRelations(graph, ordered);
  }

  buildStepsOfTheRelations(graph, relations) {
    return groupByReference(relations).map(group => {
      const reference = group[0].reference;
      const followed = reference ? findFollowedRelations(graph, reference, this.nameMatchedTargets) : group;
      if (!followed) return { ambiguous: true, reference, possibleTargets: graph.findRelationsWithReference(reference).map(relation => relation.to) };
      return { ambiguous: false, relations: reference ? findFollowedOfTheGroup(group, followed) : group };
    });
  }

  findStoppingRole(abstraction) {
    return this.stopAt.find(kind => END_REASON_BY_ROLE_MAP[kind] && abstraction.hasRole(kind)) || null;
  }

  findEndReasonAt(at, relations) {
    const stoppingRole = relations.length ? this.findStoppingRole(at) : null;
    if (stoppingRole) return END_REASON_BY_ROLE_MAP[stoppingRole];
    return relations.length >= this.maxDepth ? CHAIN_END_REASONS.DEPTH_LIMIT : null;
  }

  listStepsFrom(graph, at) {
    const relations = (this.direction === WALK_DIRECTIONS.DOWN ? graph.findLiftedFrom(at, this.scale) : graph.findLiftedTo(at, this.scale))
      .filter(relation => this.along.includes(relation.kind));
    return this.buildStepsOfTheRelations(graph, relations);
  }

  findUnresolvedAt(graph, at) {
    if (this.direction !== WALK_DIRECTIONS.DOWN) return [];
    return graph.findUnresolvedFrom(at).filter(unresolvedReference => this.along.includes(unresolvedReference.reference.kind));
  }

  leavesTheApplication(start, next) {
    return !this.crossApplications && !start.isInTheSameApplicationAs(next);
  }
}
