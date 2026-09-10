import { findFollowedRelations, isWithinTheNameMatchedLimit, Scale } from "../../../../code/index.mjs";
import { NAMING_KINDS } from "./ReferenceLines.mjs";

const EVERY_POSSIBLE_TARGET = Number.MAX_SAFE_INTEGER;

export class ReferenceTargets {
  constructor(graph, nameMatchedTargets) {
    this.graph = graph;
    this.nameMatchedTargets = nameMatchedTargets;
  }

  findTargets(reference, nameMatchedTargets = this.nameMatchedTargets) {
    if (reference.isAReadCall()) return (findFollowedRelations(this.graph, reference, nameMatchedTargets) || []).map(relation => relation.to);
    const resolution = this.graph.findWalkedResolution(reference);
    if (!resolution) return [];
    if (resolution.to) return [resolution.to];
    return isWithinTheNameMatchedLimit(resolution.possibleTargets.length, nameMatchedTargets) ? [...resolution.possibleTargets] : [];
  }

  findEveryTarget(reference) {
    return this.findTargets(reference, EVERY_POSSIBLE_TARGET);
  }

  findTypesNamed(filePath, name) {
    const targets = this.graph.findWalkedReferencesIn(filePath)
      .filter(reference => reference.name === name && NAMING_KINDS.has(reference.kind))
      .flatMap(reference => this.findEveryTarget(reference))
      .filter(target => target.scale === Scale.CLASS);
    return [...new Set(targets)];
  }
}
