import { Evidence } from "../Evidence.mjs";
import { Place } from "../abstractions/Place.mjs";

export const RELATION_KINDS = Object.freeze({
  CALLS: "CALLS",
  IMPORTS: "IMPORTS",
  EXTENDS: "EXTENDS",
  IMPLEMENTS: "IMPLEMENTS",
  USES_TYPE: "USES_TYPE",
  READS_FIELD: "READS_FIELD",
  WRITES_FIELD: "WRITES_FIELD",
  DEPENDS_ON: "DEPENDS_ON",
  USES_LITERAL: "USES_LITERAL",
});

export const isACallKind = relation => relation.kind === RELATION_KINDS.CALLS;

export class Relation {
  constructor({ kind, from, to, place = null, evidence, reference = null, liftedFrom = [] }) {
    this.kind = kind;
    this.from = from;
    this.to = to;
    this.place = place;
    this.evidence = evidence;
    this.reference = reference;
    this.liftedFrom = Object.freeze([...liftedFrom]);
    Object.freeze(this);
  }

  isLifted() {
    return this.liftedFrom.length > 0;
  }

  toJSON() {
    return {
      kind: this.kind,
      from: this.from.id,
      to: this.to.id,
      ...(this.place ? { place: this.place.toJSON() } : {}),
      evidence: this.evidence.toJSON(),
      ...(this.reference ? { reference: this.reference.id } : {}),
    };
  }

  static createFromJSON(saved, abstractionAt, referenceAt) {
    return new Relation({
      kind: saved.kind,
      from: abstractionAt(saved.from),
      to: abstractionAt(saved.to),
      place: saved.place ? Place.createFromJSON(saved.place) : null,
      evidence: Evidence.createFromJSON(saved.evidence),
      reference: saved.reference ? referenceAt(saved.reference) : null,
    });
  }
}
