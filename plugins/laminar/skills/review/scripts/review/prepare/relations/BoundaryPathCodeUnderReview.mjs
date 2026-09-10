import { TRACKS } from "../../../checks/CheckCatalog.mjs";
import { BOUNDARY_PATH_CHECKS } from "../selection/TrackSelection.mjs";
import { readJudgeType } from "../../../checks/JudgeType.mjs";
import { numberCodeUnderReviewFrom } from "../formats/CodeUnderReviewIds.mjs";
import { BOUNDARY_PATH_KINDS } from "../abstractions/walks/BoundaryPathsWalk.mjs";

export const MAX_BOUNDARY_PATH_JUDGE_CALLS = 24;

const BOUNDARY_JUDGE_TYPE = readJudgeType({ track: TRACKS.BOUNDARY });

const compareByText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const KIND_ORDER = [BOUNDARY_PATH_KINDS.INNER, BOUNDARY_PATH_KINDS.ENTRY];

const compareByKindThenPlace = (left, right) => KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind)
  || compareByText(left.path, right.path) || left.from - right.from;

const createBoundaryPathCodeUnderReview = found => ({
  ...found,
  track: TRACKS.BOUNDARY,
  judgeType: BOUNDARY_JUDGE_TYPE,
  checks: BOUNDARY_PATH_CHECKS.map(check => ({ id: check.id, name: check.name, fields: [] })),
  isTest: false,
  lines: { from: found.from, to: found.to },
  ownLines: found.lines,
  slice: null,
});

const isKeptBy = (keeps, topIds, selectedIds) => found => keeps(found.path)
  && selectedIds.has(found.abstractionId)
  && (!topIds || topIds.has(found.abstractionId));

const countPaths = (kept, judged) => ({
  paths: kept.length,
  inner: kept.filter(found => found.kind === BOUNDARY_PATH_KINDS.INNER).length,
  entry: kept.filter(found => found.kind === BOUNDARY_PATH_KINDS.ENTRY).length,
  judged: judged.length,
  notJudged: kept.length - judged.length,
});

export function buildBoundaryPathCodeUnderReview(extracted, { keeps, topIds, selectedIds, firstNumber, judged = true }) {
  const kept = (extracted.boundaryPaths || []).filter(isKeptBy(keeps, topIds, selectedIds)).sort(compareByKindThenPlace);
  const judgedPaths = judged ? kept.slice(0, MAX_BOUNDARY_PATH_JUDGE_CALLS) : [];
  return {
    judgeCalls: numberCodeUnderReviewFrom(judgedPaths.map(createBoundaryPathCodeUnderReview), firstNumber),
    counts: countPaths(kept, judgedPaths),
  };
}

export const isABoundaryPathCodeUnderReview = codeUnderReview => codeUnderReview.track === TRACKS.BOUNDARY;

const readPlacesOfLines = (filePath, lines) => (lines || []).map(line => ({ path: filePath, line: line.line, text: line.text }));

const readPlacesOfAnEntryMethod = entryMethod => [...readPlacesOfLines(entryMethod.path, entryMethod.lines), ...(entryMethod.calls || []).map(call => ({ path: call.path, line: call.line, text: call.text }))];

export const readBoundaryPathPlaces = boundaryPath => (isABoundaryPathCodeUnderReview(boundaryPath) ? [
  ...readPlacesOfLines(boundaryPath.path, boundaryPath.ownLines),
  ...(boundaryPath.entryMethods || []).flatMap(readPlacesOfAnEntryMethod),
  ...(boundaryPath.passedTo || []).flatMap(passed => readPlacesOfLines(passed.path, passed.lines)),
  ...(boundaryPath.sinks || []).map(sink => ({ path: sink.path, line: sink.line, text: sink.text })),
] : []);
