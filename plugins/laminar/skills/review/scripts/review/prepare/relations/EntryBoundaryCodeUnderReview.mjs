import { Scale } from "../../../code/index.mjs";
import { TRACKS } from "../../../checks/CheckCatalog.mjs";
import { ENTRY_BOUNDARY_CHECKS } from "../selection/TrackSelection.mjs";
import { readJudgeType } from "../../../checks/JudgeType.mjs";
import { numberCodeUnderReviewFrom } from "../formats/CodeUnderReviewIds.mjs";

export const MAX_ENTRY_BOUNDARY_JUDGE_CALLS = 12;
export const MAX_ENTRY_BOUNDARIES_PER_JUDGE_CALL = 6;

const ENTRY_BOUNDARY_JUDGE_TYPE = readJudgeType({ track: TRACKS.ENTRY_BOUNDARY });

const compareByText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const hasACaller = boundary => (boundary.callers || []).length > 0;

const listCallerApplications = boundaries => [...new Set(boundaries.flatMap(boundary => boundary.callers.map(caller => caller.application)))].sort(compareByText);

const createEnclosingTypeKey = boundary => `${boundary.kind}\u0000${boundary.enclosingType.path}\u0000${boundary.enclosingType.line}`;

const splitIntoChunks = (boundaries, size) => Array.from({ length: Math.ceil(boundaries.length / size) }, (unused, at) => boundaries.slice(at * size, (at + 1) * size));

const compareByTheMostCallerApplications = (left, right) => right.callerApplications.length - left.callerApplications.length
  || compareByText(left.path, right.path) || left.lines.from - right.lines.from || compareByText(left.abstractionId, right.abstractionId);

const createAbstractionId = (enclosingType, chunk) => `entry:${enclosingType.path}:${enclosingType.line}${chunk ? `:${chunk + 1}` : ""}`;

const createEntryBoundaryCodeUnderReview = (boundaries, chunk) => {
  const [{ enclosingType, kind, application }] = boundaries;
  return {
    abstractionId: createAbstractionId(enclosingType, chunk),
    displayName: enclosingType.displayName,
    name: enclosingType.name,
    scale: Scale.CLASS.name,
    track: TRACKS.ENTRY_BOUNDARY,
    judgeType: ENTRY_BOUNDARY_JUDGE_TYPE,
    checks: ENTRY_BOUNDARY_CHECKS.map(check => ({ id: check.id, name: check.name, fields: [] })),
    isTest: false,
    path: enclosingType.path,
    lines: { from: enclosingType.line, to: enclosingType.line },
    slice: null,
    kind,
    application,
    callerApplications: listCallerApplications(boundaries),
    abstractionIds: [...new Set(boundaries.flatMap(boundary => boundary.abstractionIds || []))],
    boundaries,
  };
};

const createCodeUnderReviewOfOneEnclosingType = boundaries => splitIntoChunks([...boundaries].sort((left, right) => left.line - right.line), MAX_ENTRY_BOUNDARIES_PER_JUDGE_CALL)
  .map((chunk, at) => createEntryBoundaryCodeUnderReview(chunk, at));

const groupByEnclosingType = boundaries => {
  const boundariesByEnclosingTypeMap = new Map();
  for (const boundary of boundaries) {
    const key = createEnclosingTypeKey(boundary);
    if (!boundariesByEnclosingTypeMap.has(key)) boundariesByEnclosingTypeMap.set(key, []);
    boundariesByEnclosingTypeMap.get(key).push(boundary);
  }
  return [...boundariesByEnclosingTypeMap.values()];
};

const isKeptBy = (keeps, topIds) => boundary => keeps(boundary.path) && (!topIds || (boundary.abstractionIds || []).some(id => topIds.has(id)));

const countBoundaries = (kept, judged) => ({
  boundaries: kept.length,
  applications: new Set(kept.flatMap(boundary => [boundary.application, ...boundary.callers.map(caller => caller.application)])).size,
  judged: judged.length,
  noCaller: kept.filter(boundary => !hasACaller(boundary)).length,
  notJudged: kept.filter(hasACaller).length - judged.length,
});

export function buildEntryBoundaryCodeUnderReview(extracted, { keeps, topIds, firstNumber, judged = true }) {
  const kept = (extracted.entryBoundaries || []).filter(isKeptBy(keeps, topIds));
  const everyCodeUnderReview = judged
    ? groupByEnclosingType(kept.filter(hasACaller)).flatMap(createCodeUnderReviewOfOneEnclosingType).sort(compareByTheMostCallerApplications).slice(0, MAX_ENTRY_BOUNDARY_JUDGE_CALLS)
    : [];
  return {
    judgeCalls: numberCodeUnderReviewFrom(everyCodeUnderReview, firstNumber),
    counts: countBoundaries(kept, everyCodeUnderReview.flatMap(codeUnderReview => codeUnderReview.boundaries)),
  };
}

export const isAnEntryBoundaryCodeUnderReview = codeUnderReview => codeUnderReview.track === TRACKS.ENTRY_BOUNDARY;

const readFencePlaces = (filePath, lines) => (lines || []).map(line => ({ path: filePath, line: line.line, text: line.text }));

const readAnotherFilePlaces = place => (place.declaredInAnotherFile || []).flatMap(declared => readFencePlaces(declared.path, declared.lines));

const readCallerPlaces = caller => [...caller.reached, ...caller.readPlaces]
  .flatMap(place => [...readFencePlaces(place.path, place.lines), ...readFencePlaces(place.path, place.declaredAbove), ...readAnotherFilePlaces(place)]);

const fillPlacesOf = fill => [fill, ...(fill.conditionCalls || [])]
  .flatMap(fillOrConditionCall => [...readFencePlaces(fillOrConditionCall.path, fillOrConditionCall.lines), ...readFencePlaces(fillOrConditionCall.path, fillOrConditionCall.declaredInTheFile), ...readAnotherFilePlaces(fillOrConditionCall)]);

const readComparedFieldPlaces = comparedField => [
  ...readFencePlaces(comparedField.path, comparedField.lines),
  ...(comparedField.declaredType ? readFencePlaces(comparedField.declaredType.path, comparedField.declaredType.lines) : []),
];

export const readEntryBoundaryPlaces = codeUnderReview => (isAnEntryBoundaryCodeUnderReview(codeUnderReview) ? codeUnderReview.boundaries.flatMap(boundary => [
  ...readFencePlaces(boundary.path, boundary.lines),
  ...(boundary.comparedFields || []).flatMap(readComparedFieldPlaces),
  ...boundary.fills.flatMap(fillPlacesOf),
  ...boundary.callers.flatMap(readCallerPlaces),
]) : []);
