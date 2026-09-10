import { buildPossibleFindingId } from "../returns/PossibleFindings.mjs";

const isClosedByTheScreen = closed => Boolean(closed.field);

const readReason = closed => isClosedByTheScreen(closed) ? closed.reason || `the screen answered ${closed.field} false` : closed.reason || "not stated";

const buildClosedCheck = (codeUnderReview, closed) => ({
  codeUnderReviewId: codeUnderReview.id,
  displayName: codeUnderReview.displayName,
  check: closed.check,
  reason: readReason(closed),
});

const buildJudgedCheck = (codeUnderReview, check) => ({
  codeUnderReviewId: codeUnderReview.id,
  displayName: codeUnderReview.displayName,
  check: check.id,
});

export const formatSweepWords = sweep =>
  `${sweep.selected} check(s), ${sweep.withAFinding} finished with a finding, ${sweep.noFindingByAJudge + sweep.noFindingByTheScreen} finished with no finding (${sweep.noFindingByAJudge} by a judge, ${sweep.noFindingByTheScreen} by the screen), ${sweep.failed} failed`;

export function buildSweep(everyCodeUnderReview, closedChecks, findings) {
  const found = new Set(findings.map(finding => buildPossibleFindingId(finding.codeUnderReviewId, finding.check)));
  const closedChecksByPossibleFindingIdMap = new Map(closedChecks.map(closed => [buildPossibleFindingId(closed.codeUnderReviewId, closed.check), closed]));
  const sweep = { selected: 0, withAFinding: 0, noFindingByAJudge: 0, noFindingByTheScreen: 0, failed: 0 };
  const byAJudge = [];
  const byTheScreen = [];
  const failed = [];
  for (const codeUnderReview of everyCodeUnderReview) {
    for (const check of codeUnderReview.checks) {
      sweep.selected++;
      const closed = closedChecksByPossibleFindingIdMap.get(buildPossibleFindingId(codeUnderReview.id, check.id));
      if (closed && isClosedByTheScreen(closed)) {
        sweep.noFindingByTheScreen++;
        byTheScreen.push(buildClosedCheck(codeUnderReview, closed));
        continue;
      }
      if (closed) {
        sweep.failed++;
        failed.push(buildClosedCheck(codeUnderReview, closed));
        continue;
      }
      if (found.has(buildPossibleFindingId(codeUnderReview.id, check.id))) { sweep.withAFinding++; continue; }
      sweep.noFindingByAJudge++;
      byAJudge.push(buildJudgedCheck(codeUnderReview, check));
    }
  }
  return { ...sweep, noFindingByAJudgeChecks: byAJudge, noFindingByTheScreenChecks: byTheScreen, failedChecks: failed };
}

export function addTheFindingsToTheSweep(sweep, findings) {
  const found = new Set(findings.map(finding => buildPossibleFindingId(finding.codeUnderReviewId, finding.check)));
  const isNowFound = sweptCheck => found.has(buildPossibleFindingId(sweptCheck.codeUnderReviewId, sweptCheck.check));
  const nowFound = (sweep.noFindingByAJudgeChecks || []).filter(isNowFound);
  if (!nowFound.length) return sweep;
  return {
    ...sweep,
    withAFinding: sweep.withAFinding + nowFound.length,
    noFindingByAJudge: sweep.noFindingByAJudge - nowFound.length,
    noFindingByAJudgeChecks: (sweep.noFindingByAJudgeChecks || []).filter(sweptCheck => !isNowFound(sweptCheck)),
  };
}
