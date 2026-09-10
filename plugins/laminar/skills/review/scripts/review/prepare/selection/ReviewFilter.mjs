import { BOUNDARY_RANKS } from "../../../code/index.mjs";
import { DESIGN_JUDGE_TYPES, JUDGE_TYPE_BY_SCALE_MAP, JUDGE_TYPE_BY_TRACK_MAP } from "../../../checks/JudgeType.mjs";

export const JUDGE_TYPES = Object.freeze([...new Set([...Object.values(JUDGE_TYPE_BY_SCALE_MAP), ...DESIGN_JUDGE_TYPES, ...Object.values(JUDGE_TYPE_BY_TRACK_MAP)])]);

const RANK_ORDER = Object.freeze([
  BOUNDARY_RANKS.SYSTEM_BOUNDARY,
  BOUNDARY_RANKS.MODULE_BOUNDARY,
  BOUNDARY_RANKS.DOMAIN_MODEL,
  BOUNDARY_RANKS.API_IMPLEMENTATION,
  BOUNDARY_RANKS.OUT_CODE,
  BOUNDARY_RANKS.IN_CODE,
  BOUNDARY_RANKS.UNKNOWN,
]);

const readRankPlace = rank => {
  const place = RANK_ORDER.indexOf(rank);
  return place < 0 ? RANK_ORDER.length : place;
};

const readIdNumber = abstraction => Number(String(abstraction.id).replace(/\D/g, "")) || 0;

const compareByText = (left, right) => left < right ? -1 : left > right ? 1 : 0;

export const compareByBoundaryRank = (left, right) => readRankPlace(left.boundaryRank) - readRankPlace(right.boundaryRank)
  || compareByText(String(left.path || ""), String(right.path || ""))
  || readIdNumber(left) - readIdNumber(right);

const removeEndSlash = prefix => prefix.replace(/^\.\//, "").replace(/\/+$/, "");

const isUnder = (given, prefix) => given === prefix || given.startsWith(`${prefix}/`);

export class FilterStop extends Error {}

const JUDGE_TYPES_BY_RETIRED_NAME_MAP = Object.freeze({
  "judge-design-abstraction": DESIGN_JUDGE_TYPES,
});

const isNamed = (known, bare) => known === bare || known === `judge-${bare}`;

const resolveJudgeTypesNamed = name => {
  const bare = name.replace(/^(laminar-)?review-/, "");
  const retired = Object.keys(JUDGE_TYPES_BY_RETIRED_NAME_MAP).find(known => isNamed(known, bare));
  if (retired) return JUDGE_TYPES_BY_RETIRED_NAME_MAP[retired];
  const judgeType = JUDGE_TYPES.find(known => isNamed(known, bare));
  if (!judgeType) throw new FilterStop(`unknown judge type ${name}, known: ${JUDGE_TYPES.join(", ")}`);
  return [judgeType];
};

const parseTop = given => {
  if (given === null || given === undefined) return null;
  const top = Number(given);
  if (!Number.isInteger(top) || top < 1) throw new FilterStop(`--top takes a whole number above 0, not ${given}`);
  return top;
};

export class ReviewFilter {
  constructor({ judges = [], paths = [], top = null } = {}) {
    this.judges = [...new Set(judges.flatMap(resolveJudgeTypesNamed))];
    this.paths = paths.map(removeEndSlash).filter(Boolean);
    this.top = parseTop(top);
  }

  isEmpty() {
    return !this.judges.length && !this.paths.length && this.top === null;
  }

  keepsJudgeType(judgeType) {
    return !this.judges.length || this.judges.includes(judgeType);
  }

  keepsPath(given) {
    return !this.paths.length || this.paths.some(prefix => isUnder(String(given || ""), prefix));
  }

  findTopIds(abstractions) {
    if (this.top === null) return null;
    return new Set([...abstractions].sort(compareByBoundaryRank).slice(0, this.top).map(abstraction => abstraction.id));
  }

  copyWithTop(top) {
    return new ReviewFilter({ judges: this.judges, paths: this.paths, top });
  }

  convertToFields() {
    return this.isEmpty() ? null : { judges: this.judges, paths: this.paths, top: this.top };
  }
}

export const NO_FILTER = new ReviewFilter();
