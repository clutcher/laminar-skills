export const EXPOSED_SETS = Object.freeze({
  DECLARATIONS: "DECLARATIONS",
  RE_EXPORTS: "RE_EXPORTS",
  DECLARED_NAMES: "DECLARED_NAMES",
});

const formatBoundaryKey = boundary => `${boundary.name}|${JSON.stringify(boundary.signature ? boundary.signature.toJSON() : {})}`;

const formatRoleKey = role => `${role.kind}|${role.of ? role.of.qualifiedName : ""}|${role.detail}`;

const compareByKey = keyOf => (left, right) => keyOf(left).localeCompare(keyOf(right));

const areSameBoundaries = (left, right) => {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort(compareByKey(formatBoundaryKey));
  const sortedRight = [...right].sort(compareByKey(formatBoundaryKey));
  return sortedLeft.every((boundary, index) => boundary.equals(sortedRight[index]));
};

const sortRoleKeys = roles => roles.map(formatRoleKey).sort();

const areSameKeys = (left, right) => left.length === right.length && left.every((key, index) => key === right[index]);

const areSameRoles = (left, right) => areSameKeys(sortRoleKeys(left), sortRoleKeys(right));

const areSameSignatures = (left, right) => (left && right ? left.equals(right) : !left && !right);

export class Boundary {
  constructor({ abstraction, name, signature = null, exposed = [], entryBoundaries = [], exits = [] }) {
    this.abstraction = abstraction;
    this.name = name;
    this.signature = signature;
    this.exposed = Object.freeze([...exposed]);
    this.entryBoundaries = Object.freeze([...entryBoundaries]);
    this.exits = Object.freeze([...exits]);
    Object.freeze(this);
  }

  equals(other) {
    return Boolean(other)
      && this.name === other.name
      && areSameSignatures(this.signature, other.signature)
      && areSameBoundaries(this.exposed, other.exposed)
      && areSameRoles(this.entryBoundaries, other.entryBoundaries)
      && areSameRoles(this.exits, other.exits);
  }
}
