export const WALK_DIRECTIONS = Object.freeze({ DOWN: "DOWN", UP: "UP" });

export const CHAIN_END_REASONS = Object.freeze({
  ENTRY_BOUNDARY: "ENTRY_BOUNDARY",
  EXIT_BOUNDARY: "EXIT_BOUNDARY",
  TEST: "TEST",
  UNRESOLVED: "UNRESOLVED",
  AMBIGUOUS: "AMBIGUOUS",
  DEPTH_LIMIT: "DEPTH_LIMIT",
  CYCLE: "CYCLE",
  LEAVES_APPLICATION: "LEAVES_APPLICATION",
});

export class ChainEnd {
  constructor({ reason, at, reference = null, possibleTargets = [] }) {
    this.reason = reason;
    this.at = at;
    this.reference = reference;
    this.possibleTargets = Object.freeze([...possibleTargets]);
    Object.freeze(this);
  }
}

const ENDS_BY_DIRECTION_MAP = Object.freeze({
  [WALK_DIRECTIONS.DOWN]: Object.freeze({ previous: "from", next: "to" }),
  [WALK_DIRECTIONS.UP]: Object.freeze({ previous: "to", next: "from" }),
});

export const readNextAlong = (relation, direction) => relation[ENDS_BY_DIRECTION_MAP[direction].next];

const readPreviousAlong = (relation, direction) => relation[ENDS_BY_DIRECTION_MAP[direction].previous];

export class ChainBreak extends Error {}

function checkContinuity(start, relations, direction) {
  let at = start;
  relations.forEach((relation, index) => {
    if (readPreviousAlong(relation, direction) !== at) throw new ChainBreak(`relation ${index + 1} of the chain from ${start.id} does not start at ${at.id}`);
    at = readNextAlong(relation, direction);
  });
}

export class Chain {
  constructor({ start, relations = [], end = null, scale = start.scale, direction = WALK_DIRECTIONS.DOWN }) {
    checkContinuity(start, relations, direction);
    this.start = start;
    this.relations = Object.freeze([...relations]);
    this.end = end;
    this.scale = scale;
    this.direction = direction;
    Object.freeze(this);
  }

  listAbstractions() {
    return [this.start, ...this.relations.map(relation => readNextAlong(relation, this.direction))];
  }
}
