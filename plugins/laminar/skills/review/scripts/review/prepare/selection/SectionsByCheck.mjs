import { formatPlaceKey, Scale } from "../../../code/index.mjs";
import { FIELD_READING_SECTIONS, findPlaceOfSliceLine } from "../formats/SliceFormat.mjs";
import { CALLING_METHODS_SECTION, FIELD_TYPE_HEADS, SLICE_NEEDS } from "../abstractions/slices/CodeSlice.mjs";
import { CHECKS_BY_ID_MAP, TRACKS } from "../../../checks/CheckCatalog.mjs";
import { TEST_METHOD_CHECKS } from "./TrackSelection.mjs";
import { JUDGE_TYPE_BY_SCALE_MAP, JUDGE_TYPE_BY_TRACK_MAP } from "../../../checks/JudgeType.mjs";

const EVERY_SECTION = () => true;

const readBy = (judgeType, ...checks) => Object.freeze({ judgeType, checks: checks.map(check => check.id), readsTheSectionWhere: EVERY_SECTION });

const readOnlyWhere = (reader, readsTheSectionWhere) => Object.freeze({ ...reader, readsTheSectionWhere });

const joinsAnotherApplication = section => Boolean(section.joinsAnotherApplication);

const CLASS_JUDGE = JUDGE_TYPE_BY_SCALE_MAP[Scale.CLASS.name];
const METHOD_JUDGE = JUDGE_TYPE_BY_SCALE_MAP[Scale.METHOD.name];
const MODULE_JUDGE = JUDGE_TYPE_BY_SCALE_MAP[Scale.MODULE.name];
const VARIABLE_JUDGE = JUDGE_TYPE_BY_SCALE_MAP[Scale.VARIABLE.name];
const PREVENTION_JUDGE = JUDGE_TYPE_BY_TRACK_MAP[TRACKS.PREVENTION];
const TEST_METHOD_JUDGE = JUDGE_TYPE_BY_TRACK_MAP[TRACKS.TEST_METHOD];
const DECISION_JUDGE = JUDGE_TYPE_BY_TRACK_MAP[TRACKS.DECISION];
const PERFORMANCE_JUDGE = JUDGE_TYPE_BY_TRACK_MAP[TRACKS.PERFORMANCE];

const PREVENTION_CHECKS = Object.values(CHECKS_BY_ID_MAP).filter(check => check.track === TRACKS.PREVENTION);
const PERFORMANCE_CHECKS = Object.values(CHECKS_BY_ID_MAP).filter(check => check.track === TRACKS.PERFORMANCE);

const CALLER_SHAPED_CHECKS = [CHECKS_BY_ID_MAP.CP4, CHECKS_BY_ID_MAP.CP7];

const CALL_SITE_READERS = [readBy(METHOD_JUDGE, CHECKS_BY_ID_MAP.S2), readBy(PREVENTION_JUDGE, ...PREVENTION_CHECKS)];

const FIELD_READING_READERS = [readBy(VARIABLE_JUDGE, CHECKS_BY_ID_MAP.S2), readBy(CLASS_JUDGE, CHECKS_BY_ID_MAP.S2, CHECKS_BY_ID_MAP.S5)];

export const READERS_BY_SECTION_MAP = Object.freeze({
  openConstructs: [readBy(METHOD_JUDGE, CHECKS_BY_ID_MAP.S6)],
  callArgumentFunctions: [readBy(METHOD_JUDGE, CHECKS_BY_ID_MAP.S5)],
  callArgumentCalls: [readBy(METHOD_JUDGE, CHECKS_BY_ID_MAP.S5)],
  typeHeads: [readBy(CLASS_JUDGE, CHECKS_BY_ID_MAP.S2, CHECKS_BY_ID_MAP.S5), readBy(VARIABLE_JUDGE, CHECKS_BY_ID_MAP.S2), readBy(PREVENTION_JUDGE, ...PREVENTION_CHECKS), readBy(TEST_METHOD_JUDGE, CHECKS_BY_ID_MAP.CD2)],
  references: [...CALL_SITE_READERS, readBy(VARIABLE_JUDGE, CHECKS_BY_ID_MAP.S2)],
  callersInFile: CALL_SITE_READERS,
  [CALLING_METHODS_SECTION]: [readOnlyWhere(readBy(DECISION_JUDGE, CHECKS_BY_ID_MAP.S1), joinsAnotherApplication), readBy(PREVENTION_JUDGE, ...CALLER_SHAPED_CHECKS)],
  hiddenDependency: [readBy(PREVENTION_JUDGE, CHECKS_BY_ID_MAP.CP5)],
  interactionAssertion: [readBy(TEST_METHOD_JUDGE, CHECKS_BY_ID_MAP.CD2)],
  calledBodies: [readBy(TEST_METHOD_JUDGE, ...TEST_METHOD_CHECKS), readBy(PREVENTION_JUDGE, CHECKS_BY_ID_MAP.CP3, ...CALLER_SHAPED_CHECKS)],
  [FIELD_TYPE_HEADS]: [readBy(CLASS_JUDGE, CHECKS_BY_ID_MAP.S2, CHECKS_BY_ID_MAP.S5), readBy(PERFORMANCE_JUDGE, ...PERFORMANCE_CHECKS), readBy(PREVENTION_JUDGE, ...PREVENTION_CHECKS)],
  nestedUsedBare: [readBy(CLASS_JUDGE, CHECKS_BY_ID_MAP.S2)],
  testFriction: [readBy(CLASS_JUDGE, CHECKS_BY_ID_MAP.S5), readBy(METHOD_JUDGE, CHECKS_BY_ID_MAP.S5)],
  createdSubfolders: [readBy(MODULE_JUDGE, CHECKS_BY_ID_MAP.S2, CHECKS_BY_ID_MAP.S5)],
  childCount: [readBy(MODULE_JUDGE, CHECKS_BY_ID_MAP.S5)],
  [FIELD_READING_SECTIONS.SAME_NAME]: FIELD_READING_READERS,
});

const THE_CODE_OF_A_GONE_ABSTRACTION = SLICE_NEEDS.THE_REFERENCES_AND_TYPE_HEADS;

const readsTheSection = (codeUnderReview, sectionName, section = {}) => {
  const readers = READERS_BY_SECTION_MAP[sectionName];
  if (!readers) return true;
  const selected = (codeUnderReview.checks || []).map(check => check.id);
  return readers.some(reader => reader.judgeType === codeUnderReview.judgeType
    && reader.checks.some(check => selected.includes(check))
    && reader.readsTheSectionWhere(section));
};

const isTheCodeOfAGoneAbstraction = slice => Boolean(slice) && slice.need === THE_CODE_OF_A_GONE_ABSTRACTION;

const REPEATING_SECTION = "references";

const readPlaceKeyOfSliceLine = (abstractionPath, line) => {
  const place = findPlaceOfSliceLine(abstractionPath, line);
  return place ? formatPlaceKey({ path: place.file, line: place.line }) : line;
};

const removeRepeatedReferences = (abstractionPath, sections) => {
  const shownBefore = new Set();
  return sections.map(section => {
    const lines = section.section === REPEATING_SECTION ? section.lines.filter(line => !shownBefore.has(readPlaceKeyOfSliceLine(abstractionPath, line))) : section.lines;
    section.lines.forEach(line => shownBefore.add(readPlaceKeyOfSliceLine(abstractionPath, line)));
    return lines === section.lines ? section : { ...section, lines };
  }).filter(section => section.lines.length);
};

const filterReadSlice = (codeUnderReview, slice) => isTheCodeOfAGoneAbstraction(slice)
  ? slice
  : { ...slice, sections: removeRepeatedReferences(codeUnderReview.path, (slice.sections || []).filter(section => readsTheSection(codeUnderReview, section.section, section))) };

const filterReadFacts = (codeUnderReview, facts) => Object.fromEntries(Object.entries(facts)
  .filter(([name]) => readsTheSection(codeUnderReview, name)));

export const selectSectionsReadByTheChecks = codeUnderReview => ({
  ...codeUnderReview,
  openConstructs: readsTheSection(codeUnderReview, "openConstructs") ? codeUnderReview.openConstructs : null,
  callArgumentFunctions: readsTheSection(codeUnderReview, "callArgumentFunctions") ? codeUnderReview.callArgumentFunctions || [] : [],
  callArgumentCalls: readsTheSection(codeUnderReview, "callArgumentCalls") ? codeUnderReview.callArgumentCalls || [] : [],
  testFriction: readsTheSection(codeUnderReview, "testFriction") ? codeUnderReview.testFriction || [] : [],
  facts: filterReadFacts(codeUnderReview, codeUnderReview.facts || {}),
  slice: codeUnderReview.slice ? filterReadSlice(codeUnderReview, codeUnderReview.slice) : codeUnderReview.slice,
});
