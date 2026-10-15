import { findCheckWords, readCheckRank, readScaleRank, readTrack, readTrackRank } from "../../../checks/CheckWords.mjs";
import { TRACKS } from "../../../checks/CheckCatalog.mjs";
import { JUDGE_TYPE_BY_TRACK_MAP } from "../../../checks/JudgeType.mjs";
import { isInTheChange } from "../../merge/returns/PossibleFindings.mjs";
import { isAConsideration } from "../../merge/filing/Considerations.mjs";
import { buildPlaceKey } from "../../merge/abstractions/AbstractionsAtPlaces.mjs";
import { isRefuted, VerifyReturns } from "./VerifyReturns.mjs";

const CONFIDENCE_LEVELS = Object.freeze(["high", "moderate", "low"]);

const LOWER_LEVELS = Object.freeze(["moderate", "low"]);

export const DECISIONS = Object.freeze({ KEEP: "keep", LOWER: "lower", COMBINE: "combine", REJECT: "reject" });

const RAISE_OF_AN_OLDER_VERIFIER = "raise";

export const NOT_VERIFIED_STAGES = Object.freeze({ REFUTER: "refuter", VERIFIER: "verifier" });

const JUDGE_TYPES_NOT_SENT_TO_THE_REFUTER = Object.freeze([JUDGE_TYPE_BY_TRACK_MAP[TRACKS.TEST_PLAN], JUDGE_TYPE_BY_TRACK_MAP[TRACKS.IO_PATHS]]);

const NO_VERDICT = Object.freeze({ decision: "" });

const NO_SECOND_READ = Object.freeze({ refutation: null, notVerified: "", notSentToTheRefuter: false });

const FEWEST_COMBINED_CHECKS = 2;

const chooseLevel = (given, fallback) => CONFIDENCE_LEVELS.includes(given) ? given : fallback;

const sitsBelow = (level, other) => CONFIDENCE_LEVELS.indexOf(level) > CONFIDENCE_LEVELS.indexOf(other);

const selectTheLower = (level, other) => sitsBelow(level, other) ? level : other;

const trimText = given => String(given || "").trim();

const carriesAFact = verdict => Boolean(trimText(verdict.fact));

const readSaidDecision = verdict => String(verdict.decision || "").toLowerCase();

export const readDecision = verdict => {
  const said = readSaidDecision(verdict);
  if (said === DECISIONS.REJECT) return carriesAFact(verdict) ? DECISIONS.REJECT : DECISIONS.KEEP;
  if (said === DECISIONS.LOWER) return LOWER_LEVELS.includes(verdict.confidence) ? DECISIONS.LOWER : DECISIONS.KEEP;
  return [DECISIONS.KEEP, DECISIONS.COMBINE, RAISE_OF_AN_OLDER_VERIFIER].includes(said) ? DECISIONS.KEEP : "";
};

const readDecisionOnAConsideration = verdict => {
  const said = readSaidDecision(verdict);
  if (said === DECISIONS.REJECT) return carriesAFact(verdict) ? DECISIONS.REJECT : DECISIONS.KEEP;
  return said ? DECISIONS.KEEP : "";
};

export const EXISTING_CODE_QUESTION = "The change did not touch this code. Should it change now, in a later change, or stay as it is?";

const chooseTheQuestion = (finding, inChange) => {
  if (isAConsideration(finding)) return String(finding.consider).trim();
  return inChange === false ? EXISTING_CODE_QUESTION : "";
};

const chooseConfidence = (verdict, decision, judged) => decision === DECISIONS.LOWER ? selectTheLower(chooseLevel(verdict.confidence, judged), judged) : judged;

const isAMark = given => typeof given === "boolean";

const chooseInTheChange = (group, verdict) => (isAMark(verdict.inChange) ? verdict.inChange : isInTheChange(group));

const chooseWhatWouldConfirm = (finding, verdict, decision) => (decision === DECISIONS.LOWER ? verdict.whatWouldConfirm : "") || finding.whatWouldConfirm || "";

const settleFinding = (finding, verdict, decision, group, secondRead) => {
  const judged = chooseLevel(finding.confidence, "high");
  const confidence = chooseConfidence(verdict, decision, judged);
  const inChange = chooseInTheChange(group, verdict);
  return {
    ...finding,
    inChange,
    consider: chooseTheQuestion(finding, inChange),
    markSetByTheVerifier: inChange !== isInTheChange(group),
    group: finding.group || readTrack(finding.check),
    confidence,
    loweredFrom: sitsBelow(confidence, judged) ? judged : "",
    whatWouldConfirm: chooseWhatWouldConfirm(finding, verdict, decision),
    fact: decision === DECISIONS.REJECT ? verdict.fact : "",
    verdictDecision: readSaidDecision(verdict) && decision ? decision : "",
    ...secondRead,
  };
};

const readKindRank = isTest => isTest ? 1 : 0;

const readChangeRank = inChange => inChange ? 0 : 1;

const compareOrder = (left, right) =>
  readTrackRank(left.group) - readTrackRank(right.group)
  || readKindRank(left.isTest) - readKindRank(right.isTest)
  || readChangeRank(left.inChange) - readChangeRank(right.inChange)
  || readCheckRank(left.check) - readCheckRank(right.check)
  || readScaleRank(left.scale) - readScaleRank(right.scale)
  || (left.file < right.file ? -1 : left.file > right.file ? 1 : 0)
  || (left.line || 0) - (right.line || 0);

const readCheckKey = check => {
  const checkWords = findCheckWords(check);
  return checkWords ? checkWords.id : String(check || "").trim().toUpperCase();
};

const listNamedChecks = verdict => [verdict.check, ...(Array.isArray(verdict.checks) ? verdict.checks : [])].filter(Boolean).map(readCheckKey);

const namesTheCheck = (verdict, check) => listNamedChecks(verdict).includes(readCheckKey(check));

const isACombine = verdict => readSaidDecision(verdict) === DECISIONS.COMBINE;

const findItemVerdictOfTheCheck = (verdicts, check) => verdicts.find(verdict => !isACombine(verdict) && namesTheCheck(verdict, check))
  || verdicts.find(verdict => namesTheCheck(verdict, check))
  || verdicts.find(verdict => !verdict.check)
  || NO_VERDICT;

const listChecksOfTheGroup = group => [...new Set(group.possibleFindings.map(finding => readCheckKey(finding.check)))];

const findCombinedChecks = (verdict, group) => {
  const checksOfTheItem = listChecksOfTheGroup(group);
  return [...new Set(listNamedChecks(verdict))].filter(check => checksOfTheItem.includes(check));
};

const isAValidCombine = (verdict, group) => isACombine(verdict)
  && findCombinedChecks(verdict, group).length >= FEWEST_COMBINED_CHECKS
  && Boolean(trimText(verdict.summary));

const combinesOf = (group, verdicts) => {
  const taken = new Set();
  return verdicts.filter(verdict => isAValidCombine(verdict, group)).flatMap(verdict => {
    const checks = findCombinedChecks(verdict, group).filter(check => !taken.has(check));
    if (checks.length < FEWEST_COMBINED_CHECKS) return [];
    checks.forEach(check => taken.add(check));
    return [{ verdict, checks: checks.sort((left, right) => readCheckRank(left) - readCheckRank(right)) }];
  });
};

const combineHolding = (combines, finding) => combines.find(combine => combine.checks.includes(readCheckKey(finding.check)));

const readJudgeTypeOf = (finding, group) => finding.judgeType || group.judgeType || "";

const isNotSentToTheRefuter = (finding, group) => JUDGE_TYPES_NOT_SENT_TO_THE_REFUTER.includes(readJudgeTypeOf(finding, group));

const readTheStageNotVerified = (notVerified, refutation) => {
  if (notVerified) return String(notVerified.stage || NOT_VERIFIED_STAGES.REFUTER);
  return isRefuted(refutation) ? NOT_VERIFIED_STAGES.VERIFIER : "";
};

const readTheSecondReadWithNoVerdict = (finding, group, returns) => {
  if (group.verdict) return NO_SECOND_READ;
  if (!returns.holdsRefutations) return { ...NO_SECOND_READ, notVerified: NOT_VERIFIED_STAGES.VERIFIER };
  const refutation = returns.findRefutationOf(finding.number);
  const notVerified = readTheStageNotVerified(returns.findNotVerifiedOf(finding.number), refutation);
  if (refutation || notVerified) return { ...NO_SECOND_READ, refutation, notVerified };
  if (isNotSentToTheRefuter(finding, group)) return { ...NO_SECOND_READ, notSentToTheRefuter: true };
  return isAConsideration(finding) ? NO_SECOND_READ : { ...NO_SECOND_READ, notVerified: NOT_VERIFIED_STAGES.REFUTER };
};

const findTheVerdict = (finding, group, returns) => {
  if (group.verdict) return group.verdict;
  return returns.findVerdictOf(finding.number) || findItemVerdictOfTheCheck(returns.listItemVerdictsOf(group.id), finding.check);
};

const ruleFinding = (finding, group, returns, combines) => {
  const refutation = returns.findRefutationOf(finding.number);
  const combine = combineHolding(combines, finding);
  if (combine) return { decision: DECISIONS.COMBINE, combine, finding: settleFinding(finding, combine.verdict, DECISIONS.KEEP, group, { ...NO_SECOND_READ, refutation }) };
  const verdict = findTheVerdict(finding, group, returns);
  const said = isAConsideration(finding) ? readDecisionOnAConsideration(verdict) : readDecision(verdict);
  if (said) return { decision: said, finding: settleFinding(finding, verdict, said, group, { ...NO_SECOND_READ, refutation }) };
  return { decision: DECISIONS.KEEP, finding: settleFinding(finding, NO_VERDICT, DECISIONS.KEEP, group, readTheSecondReadWithNoVerdict(finding, group, returns)) };
};

const selectLowest = levels => levels.reduce((lowest, level) => sitsBelow(level, lowest) ? level : lowest, CONFIDENCE_LEVELS[0]);

const buildCombinedFinding = (combine, settledFindings) => {
  const ordered = [...settledFindings].sort((left, right) => readCheckRank(left.check) - readCheckRank(right.check));
  const lead = ordered[0];
  const lowestJudged = selectLowest(ordered.map(finding => finding.confidence));
  const confidence = selectTheLower(chooseLevel(combine.verdict.confidence, lowestJudged), lowestJudged);
  const lowest = ordered.find(finding => finding.confidence === confidence) || lead;
  return {
    ...lead,
    inChange: ordered.some(finding => finding.inChange),
    consider: ordered.every(isAConsideration) ? lead.consider : "",
    summary: trimText(combine.verdict.summary),
    confidence,
    loweredFrom: "",
    refutation: null,
    notVerified: "",
    notSentToTheRefuter: false,
    whatWouldConfirm: confidence === "high" ? "" : trimText(combine.verdict.whatWouldConfirm) || lowest.whatWouldConfirm || "",
    combined: { checks: combine.checks, findings: ordered },
  };
};

const foldTheCombines = ruled => {
  const folded = [];
  const done = new Set();
  for (const ruledFinding of ruled) {
    if (!ruledFinding.combine) { folded.push(ruledFinding); continue; }
    if (done.has(ruledFinding.combine)) continue;
    done.add(ruledFinding.combine);
    const settledFindings = ruled.filter(other => other.combine === ruledFinding.combine).map(other => other.finding);
    folded.push({ decision: DECISIONS.COMBINE, finding: buildCombinedFinding(ruledFinding.combine, settledFindings) });
  }
  return folded;
};

const isRejected = ruledFinding => ruledFinding.decision === DECISIONS.REJECT;

const findTheRejectedLeadOfItsCheck = (ruledFinding, ruled) => {
  const leadOfTheCheck = ruled.find(other => other.finding.check === ruledFinding.finding.check);
  const firstSurvivorOfTheCheck = ruled.find(other => other.finding.check === ruledFinding.finding.check && !isRejected(other));
  return isRejected(leadOfTheCheck) && firstSurvivorOfTheCheck === ruledFinding ? leadOfTheCheck.finding : null;
};

const listPlacesOfSurvivors = (ruledFinding, ruled, placeKeysOfTheRejected) => {
  const rejectedLead = findTheRejectedLeadOfItsCheck(ruledFinding, ruled);
  const shown = new Set([buildPlaceKey(ruledFinding.finding)]);
  return [...(rejectedLead ? rejectedLead.alsoAt || [] : []), ...(ruledFinding.finding.alsoAt || [])]
    .filter(place => !placeKeysOfTheRejected.has(buildPlaceKey(place)) && !shown.has(buildPlaceKey(place)) && shown.add(buildPlaceKey(place)));
};

const keepThePlacesOfSurvivors = ruled => {
  if (!ruled.some(isRejected)) return ruled;
  const placeKeysOfSurvivors = new Set(ruled.filter(ruledFinding => !isRejected(ruledFinding)).map(ruledFinding => buildPlaceKey(ruledFinding.finding)));
  const placeKeysOfTheRejected = new Set(ruled.filter(isRejected).map(ruledFinding => buildPlaceKey(ruledFinding.finding)).filter(key => !placeKeysOfSurvivors.has(key)));
  return ruled.map(ruledFinding => isRejected(ruledFinding)
    ? ruledFinding
    : { ...ruledFinding, finding: { ...ruledFinding.finding, alsoAt: listPlacesOfSurvivors(ruledFinding, ruled, placeKeysOfTheRejected) } });
};

export const UNMATCHED_REASONS = Object.freeze({
  NO_ITEM: "no item has this id",
  NO_CHECK: "the item holds no check with this id",
  NO_POSSIBLE_FINDING: "no possible finding has this number",
});

const listNamedChecksAsWritten = verdict => [...new Set([verdict.check, ...(Array.isArray(verdict.checks) ? verdict.checks : [])].filter(Boolean).map(String))];

const buildUnmatched = (verdict, reason) => ({ itemId: String(verdict.itemId || verdict.possibleFinding || ""), check: listNamedChecksAsWritten(verdict).join(", "), reason });

const namesACheckTheItemDoesNotHold = (verdict, group) => verdict.check
  && listNamedChecks(verdict).some(check => !group.possibleFindings.some(finding => readCheckKey(finding.check) === check));

const findUnmatchedItemVerdicts = (groups, itemVerdictsByItemMap) => [...itemVerdictsByItemMap.entries()].flatMap(([itemId, verdicts]) => {
  const group = groups.find(item => item.id === itemId);
  if (!group) return verdicts.map(verdict => buildUnmatched(verdict, UNMATCHED_REASONS.NO_ITEM));
  return verdicts
    .filter(verdict => namesACheckTheItemDoesNotHold(verdict, group))
    .map(verdict => buildUnmatched(verdict, UNMATCHED_REASONS.NO_CHECK));
});

const findUnmatchedNumberedVerdicts = (groups, numberedVerdicts, numbersSettledElsewhere) => {
  const numbers = new Set([...groups.flatMap(group => group.possibleFindings.map(finding => finding.number)), ...numbersSettledElsewhere]);
  return numberedVerdicts
    .filter(verdict => !numbers.has(Number(verdict.possibleFinding)))
    .map(verdict => buildUnmatched(verdict, UNMATCHED_REASONS.NO_POSSIBLE_FINDING));
};

const findTheCheckOfTheNumber = (group, number) => (group.possibleFindings.find(finding => finding.number === number) || {}).check;

const listVerdictsOfTheGroup = (group, returns) => [
  ...group.possibleFindings
    .map(finding => returns.findVerdictOf(finding.number))
    .filter(Boolean)
    .map(verdict => ({ ...verdict, check: verdict.check || findTheCheckOfTheNumber(group, Number(verdict.possibleFinding)) })),
  ...returns.listItemVerdictsOf(group.id),
];

export class SettledFindings {
  constructor(groups, givenReturns, numbersSettledElsewhere = []) {
    const returns = givenReturns instanceof Map ? VerifyReturns.fromVerdictsByItem(givenReturns) : givenReturns;
    this.kept = [];
    this.considered = [];
    this.rejected = [];
    this.notVerified = [];
    this.notSentToTheRefuter = [];
    this.items = [];
    this.considerations = [];
    this.unmatchedVerdicts = [...findUnmatchedItemVerdicts(groups, returns.itemVerdictsByItemMap), ...findUnmatchedNumberedVerdicts(groups, returns.numberedVerdicts, numbersSettledElsewhere)];
    for (const group of groups) this.settle(group, returns);
    this.items.sort((left, right) => compareOrder(left.lead, right.lead));
    this.considerations.sort((left, right) => compareOrder(left.lead, right.lead));
    this.kept.sort(compareOrder);
    this.considered.sort(compareOrder);
  }

  settle(group, returns) {
    const combines = group.verdict ? [] : combinesOf(group, listVerdictsOfTheGroup(group, returns));
    const ruled = keepThePlacesOfSurvivors(group.possibleFindings.map(finding => ruleFinding(finding, group, returns, combines)));
    const standing = foldTheCombines(ruled.filter(ruledFinding => !isRejected(ruledFinding)));
    this.rejected.push(...ruled.filter(isRejected).map(ruledFinding => ruledFinding.finding));
    if (!standing.length) return;
    const settledFindings = standing.map(ruledFinding => ruledFinding.finding);
    this.notVerified.push(...settledFindings.filter(finding => finding.notVerified));
    this.notSentToTheRefuter.push(...settledFindings.filter(finding => finding.notSentToTheRefuter));
    const findings = settledFindings.filter(finding => !isAConsideration(finding));
    const considered = settledFindings.filter(isAConsideration);
    this.kept.push(...findings);
    this.considered.push(...considered);
    if (findings.length) this.items.push({ ...group, findings, lead: findings[0] });
    if (considered.length) this.considerations.push({ ...group, findings: considered, lead: considered[0] });
  }

  countByConfidence() {
    return Object.fromEntries(CONFIDENCE_LEVELS.map(level => [level, this.kept.filter(finding => finding.confidence === level).length]));
  }

  countConsideredInExistingCode() {
    return this.considered.filter(finding => finding.inChange === false).length;
  }
}
