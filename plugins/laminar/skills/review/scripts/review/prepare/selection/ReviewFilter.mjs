import { Scale } from "../../../code/index.mjs";
import { convertToPathPrefix } from "../../../files/paths.mjs";
import { DESIGN_JUDGE_TYPES, JUDGE_TYPE_BY_SCALE_MAP, JUDGE_TYPE_BY_TRACK_MAP } from "../../../checks/JudgeType.mjs";

export const JUDGE_TYPES = Object.freeze([...new Set([...Object.values(JUDGE_TYPE_BY_SCALE_MAP), ...DESIGN_JUDGE_TYPES, ...Object.values(JUDGE_TYPE_BY_TRACK_MAP)])]);

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

const formatScaleName = scale => scale.name.toLowerCase();

const resolveScaleNamed = name => {
  const scale = Scale.findNamed(name.toUpperCase());
  if (!scale) throw new FilterStop(`unknown scale ${name}, known: ${Scale.ALL.map(formatScaleName).join(", ")}`);
  return scale.name;
};

export class ReviewFilter {
  constructor({ judges = [], paths = [], scales = [] } = {}) {
    this.judges = [...new Set(judges.flatMap(resolveJudgeTypesNamed))];
    this.paths = paths.map(convertToPathPrefix).filter(Boolean);
    this.scales = [...new Set(scales.map(resolveScaleNamed))];
  }

  isEmpty() {
    return !this.judges.length && !this.paths.length && !this.scales.length;
  }

  keepsJudgeType(judgeType) {
    return !this.judges.length || this.judges.includes(judgeType);
  }

  keepsPath(given) {
    return !this.paths.length || this.paths.some(prefix => isUnder(String(given || ""), prefix));
  }

  namesAPathInside(folder) {
    return this.paths.some(prefix => prefix !== folder && isUnder(prefix, String(folder || "")));
  }

  keepsScale(scale) {
    return !this.scales.length || this.scales.includes(String(scale));
  }

  keepsOnlyScalesAmong(scales) {
    return this.scales.length > 0 && this.scales.every(scale => scales.includes(scale));
  }

  copyWithScales(scales) {
    return new ReviewFilter({ judges: this.judges, paths: this.paths, scales });
  }

  convertToFields() {
    return this.isEmpty() ? null : { judges: this.judges, paths: this.paths, scales: this.scales };
  }
}

export const NO_FILTER = new ReviewFilter();
