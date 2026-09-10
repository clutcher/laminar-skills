import { Scale } from "../code/index.mjs";
import { TRACKS } from "./CheckCatalog.mjs";

export const JUDGE_TYPE_BY_SCALE_MAP = Object.freeze({
  [Scale.VARIABLE.name]: "judge-simplicity-variable",
  [Scale.METHOD.name]: "judge-simplicity-method",
  [Scale.CLASS.name]: "judge-simplicity-class",
  [Scale.MODULE.name]: "judge-simplicity-module",
});

export const JUDGE_TYPE_BY_DESIGN_CHECK_MAP = Object.freeze({
  D1: "judge-design-over-extraction",
  D2: "judge-design-scoped-parameters",
  D3: "judge-design-leaked-details",
});

export const DESIGN_JUDGE_TYPES = Object.freeze(Object.values(JUDGE_TYPE_BY_DESIGN_CHECK_MAP));

export const JUDGE_TYPE_BY_TRACK_MAP = Object.freeze({
  [TRACKS.ENTRY_BOUNDARY]: "judge-design-entry-boundary",
  [TRACKS.PREVENTION]: "judge-correctness-prevention",
  [TRACKS.BOUNDARY]: "judge-correctness-validate-at-the-boundary",
  [TRACKS.TEST_METHOD]: "judge-correctness-simplicity-test-method",
  [TRACKS.TEST_PLAN]: "judge-correctness-test-plan",
  [TRACKS.PERFORMANCE]: "judge-performance-abstraction",
  [TRACKS.IO_PATHS]: "judge-performance-io-paths",
  [TRACKS.DECISION]: "judge-simplicity-decision",
  [TRACKS.COMMENT]: "judge-simplicity-comment",
});

const readFirstCheckId = codeUnderReview => ((codeUnderReview.checks || [])[0] || {}).id;

export const readJudgeType = codeUnderReview => {
  if (codeUnderReview.track === TRACKS.SIMPLICITY) return JUDGE_TYPE_BY_SCALE_MAP[codeUnderReview.scale];
  if (codeUnderReview.track === TRACKS.DESIGN) return JUDGE_TYPE_BY_DESIGN_CHECK_MAP[readFirstCheckId(codeUnderReview)];
  return JUDGE_TYPE_BY_TRACK_MAP[codeUnderReview.track];
};
