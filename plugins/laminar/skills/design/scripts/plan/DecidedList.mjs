import { FINDING_REASONS } from "../model/DesignModelForm.mjs";
import { isAText } from "../model/DesignModel.mjs";

export const DECIDED_BY_DEFAULT = "caller";

export const DECIDED_DEFECT_CODES = Object.freeze({ DECIDED_KEY_UNKNOWN: "decided-key-unknown", DECIDED_NOT_CARRIED: "decided-not-carried", DECIDED_ROUND_NOT_OF_THE_RUN: "decided-round-not-of-the-run" });

// The keys of a disposition that the decided list never holds, because the calling session decides only a reason class.
const REFUSED_KEYS = Object.freeze(["to", "question", "renamedFrom"]);

export class DecidedListStop extends Error {}

const isARound = given => Number.isInteger(given) && given > 0;

const describeTheObject = at => `decided[${at}]`;

const findFormProblem = (decided, at) => {
  if (decided === null || typeof decided !== "object" || Array.isArray(decided)) return `${describeTheObject(at)} is no object`;
  const refusedKey = REFUSED_KEYS.find(key => decided[key] !== undefined);
  if (refusedKey) return `${describeTheObject(at)} holds ${refusedKey}, and the decided list holds only a reason class with says`;
  const isByNumber = Number.isInteger(decided.number);
  const isByKey = isAText(decided.displayName) && isAText(decided.check);
  if (!isByNumber && !isByKey) return `${describeTheObject(at)} names its finding neither by number nor by displayName with check`;
  if (decided.check !== undefined && !isAText(decided.check)) return `${describeTheObject(at)}: check is no text`;
  if (!FINDING_REASONS.includes(decided.reason)) return `${describeTheObject(at)}: reason ${JSON.stringify(decided.reason)} is not 1 of ${FINDING_REASONS.join(", ")}`;
  if (!isAText(decided.says)) return `${describeTheObject(at)} holds no text under says`;
  if (decided.decidedBy !== undefined && !isAText(decided.decidedBy)) return `${describeTheObject(at)}: decidedBy is no text`;
  if (decided.round !== undefined && !isARound(decided.round)) return `${describeTheObject(at)}: round is no whole number above 0`;
  if (decided.linesFingerprintNow !== undefined && !isAText(decided.linesFingerprintNow)) return `${describeTheObject(at)}: linesFingerprintNow is no text`;
  return null;
};

// The file is the list itself, or an object that names the round of the run of --review beside the list.
const isTheFormWithARound = given => given !== null && typeof given === "object" && !Array.isArray(given);

// The objects of a decided list file in either form; an empty list where the file holds neither.
export const readDecidedEntries = given => {
  const decided = isTheFormWithARound(given) ? given.decided : given;
  return Array.isArray(decided) ? decided : [];
};

// A list with 1 malformed object is refused whole, because the calling session mapped its decisions and a part of them would plan the rest wrong.
export const checkDecidedListForm = given => {
  const decided = isTheFormWithARound(given) ? given.decided : given;
  if (!Array.isArray(decided)) throw new DecidedListStop("decided: the file holds neither a JSON list nor an object with round and the list decided");
  if (isTheFormWithARound(given) && given.round !== undefined && !isARound(given.round)) throw new DecidedListStop("decided: round is no whole number above 0");
  const problems = decided.map(findFormProblem).filter(Boolean);
  if (problems.length) throw new DecidedListStop(`decided: the list is refused:\n${problems.map(problem => `  ${problem}`).join("\n")}`);
  return { round: isTheFormWithARound(given) && given.round !== undefined ? given.round : null, decided };
};

// The checks of a finding: every check of a result the merge combined, else its 1 check.
export const readChecksOfTheFinding = finding => (Array.isArray(finding.checks) && finding.checks.length ? finding.checks : [finding.check]);

export const createFindingCheckKey = (finding, check) => `${finding.index}\t${check}`;

const holdsTheCheck = (finding, check) => check === undefined || readChecksOfTheFinding(finding).includes(check);

// A finding key also names a result that the render set apart as decided by the design or as decided but changed since the decision, because the run still holds it outside its findings; a check names any check of a combined result.
const listFindingsOfTheDecided = (decided, run) => {
  if (Number.isInteger(decided.number)) {
    const item = run.items.find(other => other.number === decided.number);
    return item ? item.findings.filter(finding => holdsTheCheck(finding, decided.check)) : [];
  }
  return [...run.findings, ...run.decidedFindings, ...(run.changedSinceFindings || [])].filter(finding => finding.displayName === decided.displayName && holdsTheCheck(finding, decided.check));
};

// A finding is decided as a whole only where every check of it holds a decision, and then by the decision of its first check, so a decision on 1 check of a combined result never decides the other.
const buildDecisionOfFindingMap = (run, decisionOfFindingCheckMap) => new Map([...run.findings, ...run.decidedFindings, ...(run.changedSinceFindings || [])]
  .filter(finding => readChecksOfTheFinding(finding).every(check => decisionOfFindingCheckMap.has(createFindingCheckKey(finding, check))))
  .map(finding => [finding.index, decisionOfFindingCheckMap.get(createFindingCheckKey(finding, finding.check))]));

const describeTheKey = decided => (Number.isInteger(decided.number)
  ? `item ${decided.number}${decided.check === undefined ? "" : ` with the check ${decided.check}`}`
  : `the finding key ${decided.displayName} with the check ${decided.check}`);

export const NOT_REFRESHED_PREFIX = "not refreshed";

export const NOT_REFRESHED_REASONS = Object.freeze({
  NO_FINGERPRINT: "no-fingerprint",
  FINGERPRINT_DIFFERS: "fingerprint-differs",
  NO_RESULT_CHANGED_SINCE: "no-result-changed-since",
  ROUND_NOT_OF_THE_RUN: "round-not-of-the-run",
  LINES_NOT_IN_THE_RUN: "lines-not-in-the-run",
});

export const formatNotRefreshedLine = (finding, reason, text) => `${NOT_REFRESHED_PREFIX}\t${finding.displayName}\t${finding.check}\t${reason}\t${text}`;

// The round of the list refreshes only where the rounds folder gives the run no other round; where the rounds folder holds no round, the round the caller counted stands.
const readTheRoundToRefresh = (decidedList, roundOfTheRun) => (roundOfTheRun === null || decidedList.round === roundOfTheRun ? decidedList.round : null);

const listRoundDefectsOfTheList = (decidedList, roundOfTheRun) => (decidedList.round !== null && roundOfTheRun !== null && decidedList.round !== roundOfTheRun
  ? [{ code: DECIDED_DEFECT_CODES.DECIDED_ROUND_NOT_OF_THE_RUN, name: "", sentence: `the decided list names round ${decidedList.round}, and the rounds folder of the results folder gives this run round ${roundOfTheRun}, so the list was written for another run` }]
  : []);

// An entry of a round after the round of the run was written for a later run, so it decides nothing here.
const isOfALaterRound = (decided, lastRound) => lastRound !== null && decided.round !== undefined && decided.round > lastRound;

const createLaterRoundDefect = (decided, lastRound) => ({ code: DECIDED_DEFECT_CODES.DECIDED_ROUND_NOT_OF_THE_RUN, name: decided.displayName || "", sentence: `the decided list names ${describeTheKey(decided)} with round ${decided.round}, a later round than round ${lastRound} of the run, so the entry was written for another run` });

const formatRoundHint = decidedList => (decidedList.round === null
  ? "give the list the round of this run and the entry the same round to rule on its current lines"
  : `give the entry round ${decidedList.round} to rule on its current lines`);

const COPY_HINT = "once the lines are read, copy linesFingerprintNow of its underReview suppression in review.sarif of this run, which review-evidence.md prints after now on its line Lines fingerprint";

// Why an entry does not rule again on a result decided but changed since, null where it does: the entry carries the lines fingerprint that this run gives the lines of the result, so the ruling stands on the lines the person read in this run, and it is of the round of the run.
const findTheReasonNotRefreshed = (decided, finding, roundToRefresh) => {
  if (!decided.linesFingerprintNow) return NOT_REFRESHED_REASONS.NO_FINGERPRINT;
  if (decided.linesFingerprintNow !== finding.linesFingerprintNow) return NOT_REFRESHED_REASONS.FINGERPRINT_DIFFERS;
  if (roundToRefresh === null || decided.round !== roundToRefresh) return NOT_REFRESHED_REASONS.ROUND_NOT_OF_THE_RUN;
  return null;
};

const formatTheReasonText = (reason, decided, finding, decidedList) => {
  const head = `the decided list names the finding key ${finding.displayName} with the check ${finding.check}, which this run set apart as decided but changed since`;
  if (reason === NOT_REFRESHED_REASONS.NO_FINGERPRINT) return `${head}, and the entry carries no linesFingerprintNow; ${COPY_HINT}`;
  if (reason === NOT_REFRESHED_REASONS.FINGERPRINT_DIFFERS) return `${head}, and the entry carries the lines fingerprint ${decided.linesFingerprintNow}, which is not the fingerprint of its lines in this run, so the ruling was made on other lines`;
  return `${head}, and the entry is not of the round of the run; ${formatRoundHint(decidedList)}`;
};

const formatNoResultChangedSinceLine = finding => formatNotRefreshedLine(finding, NOT_REFRESHED_REASONS.NO_RESULT_CHANGED_SINCE, `the decided list names the finding key ${finding.displayName} with the check ${finding.check} with a lines fingerprint, and this run set apart no result decided but changed since under it, so there is no ruling to make again`);

const describeTheRunHoldingTheKey = runFolder => (runFolder ? `; the run ${runFolder} holds it` : "");

// Each object of the decided list applies to every finding its item number or its finding key names, with decidedBy as the list gives it, else caller. A result the run set apart as decided but changed since, named by an entry of the round of the run that carries the lines fingerprint this run gives it, is refreshed: the plan exports it again as its own decision; every other entry on such a result, and an entry with a lines fingerprint on no such result, gives 1 not refreshed line with its reason. The round of the run is the one the rounds folder gives, null where it holds no round.
export const resolveDecidedList = (decidedList, run, findRunHoldingTheKey = () => "", roundOfTheRun = null) => {
  const decisionOfFindingCheckMap = new Map();
  const defects = listRoundDefectsOfTheList(decidedList, roundOfTheRun);
  const refreshed = [];
  const notRefreshedLines = [];
  const changedSinceIndexes = new Set((run.changedSinceFindings || []).map(finding => finding.index));
  const roundToRefresh = readTheRoundToRefresh(decidedList, roundOfTheRun);
  const lastRound = roundOfTheRun ?? decidedList.round;
  for (const decided of decidedList.decided) {
    if (isOfALaterRound(decided, lastRound)) {
      defects.push(createLaterRoundDefect(decided, lastRound));
      continue;
    }

    const findings = listFindingsOfTheDecided(decided, run);
    if (!findings.length) {
      const holdingRun = Number.isInteger(decided.number) ? "" : findRunHoldingTheKey(decided.displayName, decided.check);
      defects.push({ code: DECIDED_DEFECT_CODES.DECIDED_KEY_UNKNOWN, name: decided.displayName || "", sentence: `the decided list names ${describeTheKey(decided)}, and no finding of the run holds it${describeTheRunHoldingTheKey(holdingRun)}` });
      continue;
    }
    const decision = { reason: decided.reason, says: decided.says, decidedBy: decided.decidedBy || DECIDED_BY_DEFAULT };
    const decidedChecksOfTheFinding = finding => (decided.check === undefined ? readChecksOfTheFinding(finding) : [decided.check]);
    for (const finding of findings) for (const check of decidedChecksOfTheFinding(finding)) decisionOfFindingCheckMap.set(createFindingCheckKey(finding, check), decision);
    const changedSince = findings.filter(finding => changedSinceIndexes.has(finding.index));
    if (!changedSince.length) {
      if (decided.linesFingerprintNow) notRefreshedLines.push(formatNoResultChangedSinceLine({ ...findings[0], check: decided.check ?? findings[0].check }));
      continue;
    }
    for (const finding of changedSince) {
      const named = { ...finding, check: decided.check ?? finding.check };
      const reason = findTheReasonNotRefreshed(decided, finding, roundToRefresh);
      if (reason) notRefreshedLines.push(formatNotRefreshedLine(named, reason, formatTheReasonText(reason, decided, named, decidedList)));
      else refreshed.push(...decidedChecksOfTheFinding(finding).map(check => ({ finding: { ...finding, check }, decision, round: roundToRefresh })));
    }
  }
  return { decisionOfFindingMap: buildDecisionOfFindingMap(run, decisionOfFindingCheckMap), decisionOfFindingCheckMap, defects, refreshed, notRefreshedLines };
};
