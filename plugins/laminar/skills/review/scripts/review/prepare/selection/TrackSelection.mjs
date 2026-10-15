import { ABSTRACTION_KINDS, CHANGE_KINDS, changesTheBoundary, changesTheCode, holdsKeyTreesAt, isAFileNamedByTheLanguage, isATypesOnlyFile, Scale, TEST_KINDS } from "../../../code/index.mjs";
import { OCCURRENCE_KINDS } from "../abstractions/walks/decisions/SameDecisionWalk.mjs";
import { CHECKS_BY_ID_MAP, GATE_KINDS, TRACKS } from "../../../checks/CheckCatalog.mjs";
import { findTheSingleLetterName, listCommentsTheJudgeReads, onlyStoresItsParameters } from "../settled/ScriptSettledForms.mjs";

const PREVENTION_SCALES = new Set([Scale.METHOD.name, Scale.CLASS.name, Scale.MODULE.name]);
const SCALES_JUDGED_FOR_PREVENTION_ONLY_WITH_BEHAVIOR = new Set([Scale.METHOD.name]);
const PERFORMANCE_SCALES = new Set([Scale.METHOD.name, Scale.CLASS.name]);

export const holdsBehavior = abstraction => !(abstraction.path && isATypesOnlyFile(abstraction.path));

export const TEST_METHOD_CHECKS = Object.freeze([CHECKS_BY_ID_MAP.S2, CHECKS_BY_ID_MAP.S4, CHECKS_BY_ID_MAP.S5, CHECKS_BY_ID_MAP.CD2]);
export const TEST_CLASS_CHECKS = Object.freeze([CHECKS_BY_ID_MAP.S2, CHECKS_BY_ID_MAP.S5]);
export const TEST_PLAN_CHECKS = Object.freeze(Object.values(CHECKS_BY_ID_MAP).filter(check => check.track === TRACKS.TEST_PLAN));
export const IO_PATHS_CHECKS = Object.freeze([CHECKS_BY_ID_MAP.P1, CHECKS_BY_ID_MAP.P2]);
export const CHAIN_GROUP_CHECKS = Object.freeze([CHECKS_BY_ID_MAP.D1]);
export const PARAMETER_RELATION_CHECKS = Object.freeze([CHECKS_BY_ID_MAP.D2]);
export const CORE_OPERATION_CHECKS = Object.freeze([CHECKS_BY_ID_MAP.D3]);
export const MEMBER_GROUP_CHECKS = Object.freeze([CHECKS_BY_ID_MAP.D4]);
export const ENTRY_BOUNDARY_CHECKS = Object.freeze([CHECKS_BY_ID_MAP.S1, CHECKS_BY_ID_MAP.CP1, CHECKS_BY_ID_MAP.D3]);
export const BOUNDARY_PATH_CHECKS = Object.freeze([CHECKS_BY_ID_MAP.CP6]);

const isFoundByTheNameOfAClass = (abstraction, occurrence) => abstraction.scale === Scale.CLASS.name && occurrence.kind === OCCURRENCE_KINDS.NAME_STEMS;

export const findDecisionPlaces = abstraction => (abstraction.sameDecisionAt || []).filter(occurrence => !isFoundByTheNameOfAClass(abstraction, occurrence));

const hasSameDecision = abstraction => findDecisionPlaces(abstraction).length > 0;

export const findJudgedComments = abstraction => listCommentsTheJudgeReads(abstraction).filter(comment => !(abstraction.isTest && comment.isPhaseComment));

const holdsAJudgedComment = abstraction => findJudgedComments(abstraction).length > 0;

const isAMethodWithNoBody = abstraction => abstraction.scale === Scale.METHOD.name && !holdsBehavior(abstraction);

const holdsFunctionsInsideCallArguments = abstraction => (abstraction.callArgumentFunctions || []).length > 0;

const isATestHelper = abstraction => abstraction.testKind === TEST_KINDS.HELPER;

const isATestHook = abstraction => abstraction.testKind === TEST_KINDS.HOOK;

const passesItsMeasure = (check, abstraction) => ((abstraction.measures || {})[check.gate.fields[0]] || 0) > check.gate.allowed;

const passesItsMeasureGate = (check, abstraction) => check.gate.kind !== GATE_KINDS.MEASURE || passesItsMeasure(check, abstraction);

const isTheClassOfAFileNamedByTheLanguage = abstraction => abstraction.kind === ABSTRACTION_KINDS.FILE && isAFileNamedByTheLanguage(abstraction.path);

const NAME_ONLY_KINDS = new Set([CHANGE_KINDS.REFERENCE, CHANGE_KINDS.RENAMED]);

const listSimplicityChecks = abstraction => {
  if (isTheClassOfAFileNamedByTheLanguage(abstraction)) return [];
  if (NAME_ONLY_KINDS.has(abstraction.changeKind)) return [CHECKS_BY_ID_MAP.S2];
  if (abstraction.isTest && !isATestHelper(abstraction)) return [...TEST_CLASS_CHECKS];
  if (onlyStoresItsParameters(abstraction)) return [];
  const selected = findTheSingleLetterName(abstraction) ? [] : [CHECKS_BY_ID_MAP.S2];
  if ((abstraction.scale !== Scale.VARIABLE.name && !isAMethodWithNoBody(abstraction)) || holdsFunctionsInsideCallArguments(abstraction)) selected.push(CHECKS_BY_ID_MAP.S5);
  if (abstraction.scale === Scale.METHOD.name && passesItsMeasure(CHECKS_BY_ID_MAP.S6, abstraction)) selected.push(CHECKS_BY_ID_MAP.S6);
  return selected;
};

const listPreventionChecks = abstraction => Object.values(CHECKS_BY_ID_MAP)
  .filter(check => check.track === TRACKS.PREVENTION)
  .filter(check => check.gate.kind !== GATE_KINDS.FACT || abstraction.facts[check.gate.fields[0]]);

const listDecisionChecks = () => [CHECKS_BY_ID_MAP.S1];

const listCommentChecks = () => [CHECKS_BY_ID_MAP.S2, CHECKS_BY_ID_MAP.S5];

const listPerformanceChecks = () => Object.values(CHECKS_BY_ID_MAP).filter(check => check.track === TRACKS.PERFORMANCE);

const listTracksOfATestCodeMethod = abstraction => {
  if (isATestHook(abstraction)) return [];
  if (isATestHelper(abstraction)) return [TRACKS.SIMPLICITY];
  return [TRACKS.TEST_METHOD];
};

const listTestTracks = abstraction => {
  if (abstraction.scale === Scale.METHOD.name && changesTheCode(abstraction.changeKind)) return listTracksOfATestCodeMethod(abstraction);
  if (abstraction.scale === Scale.CLASS.name && changesTheBoundary(abstraction.changeKind)) return [TRACKS.SIMPLICITY];
  return [];
};

const holdsOnlyCreatedSubfolders = abstraction => abstraction.scale === Scale.MODULE.name && Boolean((abstraction.module || {}).holdsOnlyCreatedSubfolders);

const holdsOnlyAnOpening = abstraction => abstraction.scale === Scale.MODULE.name && Boolean((abstraction.module || {}).holdsOnlyAnOpening);

const isAModuleWithOnlyItsInternalsChanged = abstraction => abstraction.scale === Scale.MODULE.name && abstraction.changeKind === CHANGE_KINDS.INTERNALS_CHANGED;

const isReadOnly = abstraction => NAME_ONLY_KINDS.has(abstraction.changeKind)
  || holdsOnlyCreatedSubfolders(abstraction)
  || holdsOnlyAnOpening(abstraction)
  || isAModuleWithOnlyItsInternalsChanged(abstraction);

export function listTracks(abstraction) {
  if (abstraction.commentsOnly) return holdsAJudgedComment(abstraction) ? [TRACKS.COMMENT] : [];
  if (abstraction.isTest) return listTestTracks(abstraction);
  if (isReadOnly(abstraction) || holdsKeyTreesAt(abstraction.path)) return [TRACKS.SIMPLICITY];
  const tracks = [TRACKS.SIMPLICITY];
  if (PREVENTION_SCALES.has(abstraction.scale) && (holdsBehavior(abstraction) || !SCALES_JUDGED_FOR_PREVENTION_ONLY_WITH_BEHAVIOR.has(abstraction.scale))) tracks.push(TRACKS.PREVENTION);
  if (PERFORMANCE_SCALES.has(abstraction.scale) && holdsBehavior(abstraction)) tracks.push(TRACKS.PERFORMANCE);
  if (hasSameDecision(abstraction)) tracks.push(TRACKS.DECISION);
  if (holdsAJudgedComment(abstraction)) tracks.push(TRACKS.COMMENT);
  return tracks;
}

export function listChecks(abstraction, track) {
  if (track === TRACKS.DECISION) return listDecisionChecks();
  if (track === TRACKS.COMMENT) return listCommentChecks();
  if (track === TRACKS.TEST_METHOD) return TEST_METHOD_CHECKS.filter(check => passesItsMeasureGate(check, abstraction));
  if (track === TRACKS.SIMPLICITY) return listSimplicityChecks(abstraction);
  if (track === TRACKS.PREVENTION) return listPreventionChecks(abstraction);
  if (track === TRACKS.PERFORMANCE) return listPerformanceChecks();
  throw new Error(`No checks are scheduled on the track ${track}`);
}
