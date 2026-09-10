import { Evidence } from "../Evidence.mjs";

export const BOUNDARY_RANKS = Object.freeze({
  SYSTEM_BOUNDARY: "SYSTEM_BOUNDARY",
  MODULE_BOUNDARY: "MODULE_BOUNDARY",
  DOMAIN_MODEL: "DOMAIN_MODEL",
  API_IMPLEMENTATION: "API_IMPLEMENTATION",
  OUT_CODE: "OUT_CODE",
  IN_CODE: "IN_CODE",
  UNKNOWN: "UNKNOWN",
});

export const isEntryBoundaryRank = rank => rank === BOUNDARY_RANKS.IN_CODE;

export const ROLE_KINDS = Object.freeze({
  ENTRY_BOUNDARY: "ENTRY_BOUNDARY",
  EXIT_BOUNDARY: "EXIT_BOUNDARY",
  API_SPI: "API_SPI",
  IN_OUT_CODE: "IN_OUT_CODE",
  TEST: "TEST",
  APPLICATION_START: "APPLICATION_START",
  DOMAIN_MODEL: "DOMAIN_MODEL",
  IMPLEMENTATION: "IMPLEMENTATION",
  APPLICATION_CORE: "APPLICATION_CORE",
  OPENING: "OPENING",
});

export const API_SPI_SIDES = Object.freeze({ OFFERED: "offered", NEEDED: "needed" });

export const IN_OUT_SIDES = Object.freeze({ IN: "in", OUT: "out" });

const ROLE_KIND_BY_RANK_MAP = Object.freeze({
  [BOUNDARY_RANKS.IN_CODE]: ROLE_KINDS.ENTRY_BOUNDARY,
  [BOUNDARY_RANKS.OUT_CODE]: ROLE_KINDS.IN_OUT_CODE,
  [BOUNDARY_RANKS.DOMAIN_MODEL]: ROLE_KINDS.DOMAIN_MODEL,
  [BOUNDARY_RANKS.API_IMPLEMENTATION]: ROLE_KINDS.IMPLEMENTATION,
});

export const findRoleKindOfRank = rank => ROLE_KIND_BY_RANK_MAP[rank] || null;

const FOLDER_ROLE_KIND_BY_RANK_MAP = Object.freeze({ ...ROLE_KIND_BY_RANK_MAP, [BOUNDARY_RANKS.MODULE_BOUNDARY]: ROLE_KINDS.API_SPI });

export const findFolderRoleKindOfRank = rank => FOLDER_ROLE_KIND_BY_RANK_MAP[rank] || null;

const RANK_BY_FOLDER_ROLE_KIND_MAP = Object.freeze(Object.fromEntries(Object.entries(FOLDER_ROLE_KIND_BY_RANK_MAP).map(([rank, kind]) => [kind, rank])));

const isAnInCodeRole = role => role.kind === ROLE_KINDS.IN_OUT_CODE && role.facts.side === IN_OUT_SIDES.IN;

const readBoundaryRankOfFolderRole = role => (isAnInCodeRole(role) ? BOUNDARY_RANKS.IN_CODE : RANK_BY_FOLDER_ROLE_KIND_MAP[role.kind]);

export const findBoundaryRankOfFolderRoles = roles => roles.map(readBoundaryRankOfFolderRole).find(Boolean) || null;

export const isAnEntryBoundaryRole = role => role.kind === ROLE_KINDS.ENTRY_BOUNDARY;

export class Role {
  constructor({ kind, of, detail = "", evidence, facts = {} }) {
    this.kind = kind;
    this.of = of;
    this.detail = detail;
    this.evidence = Evidence.createFrom(evidence);
    this.facts = Object.freeze({ ...facts });
    Object.freeze(this);
  }

  toJSON() {
    return { kind: this.kind, ...(this.detail ? { detail: this.detail } : {}), evidence: this.evidence.toJSON(), ...(Object.keys(this.facts).length ? { facts: { ...this.facts } } : {}) };
  }

  static createFromJSON(saved, of) {
    return new Role({ kind: saved.kind, of, detail: saved.detail, evidence: saved.evidence, facts: saved.facts || {} });
  }
}
