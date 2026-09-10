export const EVIDENCE_KINDS = Object.freeze({
  DECLARED: "DECLARED",
  RESOLVED: "RESOLVED",
  NAME_MATCHED: "NAME_MATCHED",
  CONVENTION: "CONVENTION",
  ROUTE_MATCHED: "ROUTE_MATCHED",
  LIFTED: "LIFTED",
});

export class Evidence {
  constructor({ kind, foundBy = "", detail = "" }) {
    this.kind = kind;
    this.foundBy = foundBy;
    this.detail = detail;
    Object.freeze(this);
  }

  toJSON() {
    return { kind: this.kind, ...(this.foundBy ? { foundBy: this.foundBy } : {}), ...(this.detail ? { detail: this.detail } : {}) };
  }

  static createFromJSON(saved) {
    return new Evidence(saved);
  }

  static createFrom(given) {
    return given instanceof Evidence ? given : Evidence.createFromJSON(given);
  }
}
