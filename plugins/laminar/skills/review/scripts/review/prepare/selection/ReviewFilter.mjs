import { Scale, SHAPE_SHOWS } from "../../../code/index.mjs";
import { convertToPathPrefix } from "../../../files/paths.mjs";
import { DESIGN_JUDGE_TYPES, JUDGE_TYPE_BY_SCALE_MAP, JUDGE_TYPE_BY_TRACK_MAP } from "../../../checks/JudgeType.mjs";
import { TRACKS } from "../../../checks/CheckCatalog.mjs";

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

// Out until the next version: the slice of a shape names a shared constant and not its value, so the decision judge cannot see that 2 lists are 1.
const DECISION_JUDGE_IN_SHAPE_MODE = false;

const JUDGE_TYPES_OF_A_BODY = DECISION_JUDGE_IN_SHAPE_MODE
  ? [JUDGE_TYPE_BY_SCALE_MAP[Scale.METHOD.name], JUDGE_TYPE_BY_TRACK_MAP[TRACKS.DECISION]]
  : [JUDGE_TYPE_BY_SCALE_MAP[Scale.METHOD.name]];

const JUDGE_TYPES_BY_WHAT_THE_SHAPE_SHOWS_MAP = Object.freeze({
  [SHAPE_SHOWS.FOLDERS]: [JUDGE_TYPE_BY_SCALE_MAP[Scale.MODULE.name]],
  [SHAPE_SHOWS.CLASSES]: [JUDGE_TYPE_BY_SCALE_MAP[Scale.CLASS.name]],
  [SHAPE_SHOWS.BODIES]: JUDGE_TYPES_OF_A_BODY,
});

export const listJudgeTypesAllowedByTheShape = shows => shows.flatMap(shown => JUDGE_TYPES_BY_WHAT_THE_SHAPE_SHOWS_MAP[shown]);

export class ReviewFilter {
  static createForAShapeRun({ judges = [], paths = [], scales = [] }, shows) {
    const allowed = listJudgeTypesAllowedByTheShape(shows);
    const asked = new ReviewFilter({ judges, paths, scales });
    const outside = asked.judges.filter(judgeType => !allowed.includes(judgeType));
    if (outside.length) throw new FilterStop(`the shape model allows only the judge types ${allowed.join(", ")}, so ${outside.join(", ")} cannot run`);
    return new ReviewFilter({ judges: asked.judges.length ? asked.judges : allowed, paths, scales });
  }

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
