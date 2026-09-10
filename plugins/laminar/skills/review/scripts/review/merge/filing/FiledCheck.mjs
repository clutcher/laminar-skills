import { findCheckWords } from "../../../checks/CheckWords.mjs";
import { buildPossibleFindingId } from "../returns/PossibleFindings.mjs";

const findCheckWordsOfTheDecision = finding => (finding.decision ? findCheckWords(finding.decision) : null);

const isFiledUnderAnotherCheck = finding => {
  const named = findCheckWordsOfTheDecision(finding);
  const filed = findCheckWords(finding.check);
  return Boolean(named && filed && named.id !== filed.id);
};

const collectChecksAnsweredInEachJudgeCall = ({ codeUnderReview = [], notRun = [] }) => {
  const closed = new Set(notRun.map(notRunCheck => buildPossibleFindingId(notRunCheck.codeUnderReviewId, notRunCheck.check)));
  return new Set(codeUnderReview.flatMap(codeUnderReview => (codeUnderReview.checks || [])
    .map(check => buildPossibleFindingId(codeUnderReview.id, check.id))
    .filter(possibleFindingId => !closed.has(possibleFindingId))));
};

const refileUnderItsDecision = finding => ({ ...finding, check: findCheckWordsOfTheDecision(finding).id });

export function splitFindingsByFiledCheck(possibleFindings, judgedCodeUnderReview = {}) {
  const answered = collectChecksAnsweredInEachJudgeCall(judgedCodeUnderReview);
  const isAnsweredInItsJudgeCall = finding => answered.has(buildPossibleFindingId(finding.codeUnderReviewId, findCheckWordsOfTheDecision(finding).id));
  const isRefiled = finding => isFiledUnderAnotherCheck(finding) && isAnsweredInItsJudgeCall(finding);
  const isDropped = finding => isFiledUnderAnotherCheck(finding) && !isAnsweredInItsJudgeCall(finding);
  return {
    kept: possibleFindings.filter(finding => !isDropped(finding)).map(finding => (isRefiled(finding) ? refileUnderItsDecision(finding) : finding)),
    refiled: possibleFindings.filter(isRefiled),
    underAnotherCheck: possibleFindings.filter(isDropped),
  };
}
