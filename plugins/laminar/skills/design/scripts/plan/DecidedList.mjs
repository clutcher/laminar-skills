import { FINDING_REASONS } from "../model/DesignModelForm.mjs";
import { holdsADecidedReason, isAText } from "../model/DesignModel.mjs";

export const DECIDED_BY_DEFAULT = "caller";

export const DECIDED_DEFECT_CODES = Object.freeze({
  DECIDED_KEY_UNKNOWN: "decided-key-unknown",
  DECIDED_NOT_CARRIED: "decided-not-carried",
  DECIDED_ROUND_NOT_OF_THE_RUN: "decided-round-not-of-the-run",
  DECIDED_LIST_MALFORMED: "decided-list-malformed",
  REACH_KEY_UNKNOWN: "reach-key-unknown",
  REACH_KEY_WITHOUT_FINGERPRINT: "reach-key-without-fingerprint",
  REACH_KEY_AMBIGUOUS: "reach-key-ambiguous",
  REACH_KEY_ALREADY_DECIDED: "reach-key-already-decided",
  REACH_KEY_SENT_TO_A_FIX: "reach-key-sent-to-a-fix",
});

// The keys of a disposition that the decided list never holds, because the calling session decides only a reason class.
const REFUSED_KEYS = Object.freeze(["to", "question", "renamedFrom"]);

const createMalformedDefect = problem => ({ code: DECIDED_DEFECT_CODES.DECIDED_LIST_MALFORMED, name: "", sentence: problem });

// The list is refused whole; each problem of its form is 1 defect decided-list-malformed, which the commands print as a defect line and never as a thrown error.
export class DecidedListStop extends Error {
  constructor(problems) {
    super(`decided: the list is refused:\n${problems.map(problem => `  ${problem}`).join("\n")}`);
    this.defects = problems.map(createMalformedDefect);
  }
}

const isARound = given => Number.isInteger(given) && given > 0;

const describeTheObject = at => `decided[${at}]`;

const PATTERN_MARKS = /[*?]/;

const isAnObject = given => given !== null && typeof given === "object" && !Array.isArray(given);

// The person extends a ruling to keys of the run by name, never by a pattern, and never to the key of the ruling itself.
const findReachKeyProblem = (decided, key, at, keyAt) => {
  const described = `${describeTheObject(at)}.reach[${keyAt}]`;
  if (!isAnObject(key)) return `${described} is no object`;
  if (!isAText(key.displayName) || !isAText(key.scale)) return `${described} names no displayName and scale as text`;
  if (PATTERN_MARKS.test(key.displayName)) return `${described}: displayName ${JSON.stringify(key.displayName)} is a pattern, and a reach names keys only`;
  if (key.file !== undefined && !isAText(key.file)) return `${described}: file is no text`;
  if (key.check !== undefined && !isAText(key.check)) return `${described}: check is no text`;
  if (key.displayName === decided.displayName && (key.check ?? decided.check) === decided.check) return `${described} names the key of its own ruling`;
  return null;
};

const findReachProblem = (decided, at) => {
  if (decided.reach === undefined) return null;
  if (!Array.isArray(decided.reach)) return `${describeTheObject(at)}: reach is no list`;
  return decided.reach.map((key, keyAt) => findReachKeyProblem(decided, key, at, keyAt)).find(Boolean) || null;
};

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
  return findReachProblem(decided, at);
};

// The file is the list itself, or an object that names the round of the run of --review beside the list.
const isTheFormWithARound = given => given !== null && typeof given === "object" && !Array.isArray(given);

// The objects of a decided list file in either form; an empty list where the file holds neither.
export const readDecidedEntries = given => {
  const decided = isTheFormWithARound(given) ? given.decided : given;
  return Array.isArray(decided) ? decided : [];
};

// A round of null stands for none, as in the list that checkDecidedListForm returns.
const readTheRoundOfTheList = given => (isTheFormWithARound(given) && given.round !== undefined && given.round !== null ? given.round : null);

// The list in its checked form, a plain list of the form before the round or an object with round and the list decided, with every problem of its form.
const readTheFormOfTheList = given => {
  const decided = isTheFormWithARound(given) ? given.decided : given;
  if (!Array.isArray(decided)) return { problems: [isTheFormWithARound(given) ? "decided: the list decided of the file is no JSON list" : "decided: the file holds neither a JSON list nor an object with round and the list decided"] };
  const round = readTheRoundOfTheList(given);
  if (round !== null && !isARound(round)) return { problems: ["decided: round is no whole number above 0"] };
  return { decidedList: { round, decided }, problems: decided.map(findFormProblem).filter(Boolean) };
};

// A list with 1 malformed object is refused whole, because the calling session mapped its decisions and a part of them would plan the rest wrong.
export const checkDecidedListForm = given => {
  const { decidedList, problems } = readTheFormOfTheList(given);
  if (problems.length) throw new DecidedListStop(problems);
  return decidedList;
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
export const resolveDecidedList = (given, run, findRunHoldingTheKey = () => "", roundOfTheRun = null) => {
  const { decidedList, problems } = readTheFormOfTheList(given);
  if (problems.length) return { decisionOfFindingMap: new Map(), decisionOfFindingCheckMap: new Map(), defects: problems.map(createMalformedDefect), refreshed: [], notRefreshedLines: [] };

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
    const decision = { reason: decided.reason, says: decided.says, decidedBy: decided.decidedBy || DECIDED_BY_DEFAULT, ...(decided.reach ? { reach: decided.reach } : {}) };
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

const createShapeItemCheckKey = (shapeRunNumber, itemNumber, check) => `${shapeRunNumber}\t${itemNumber}\t${check}`;

const createKeyUnknownDefect = (decided, why) => ({ code: DECIDED_DEFECT_CODES.DECIDED_KEY_UNKNOWN, name: decided.displayName || "", sentence: `the decided list names ${describeTheKey(decided)}, and ${why}` });

const listShapeItemsOfTheDecided = (decided, shapeRuns) => shapeRuns.flatMap(shapeRun => shapeRun.run.items
  .filter(item => item.findings.some(finding => finding.displayName === decided.displayName && holdsTheCheck(finding, decided.check)))
  .map(item => ({ shapeRun: shapeRun.number, number: item.number, check: decided.check, displayName: decided.displayName })));

export const DECIDED_KEY_NOT_RAISED_PREFIX = "decided key not raised";

export const formatDecidedKeyNotRaisedLine = decidedKey => `${DECIDED_KEY_NOT_RAISED_PREFIX}\t${decidedKey.displayName}\t${decidedKey.check}\tthe decided list names the finding key ${decidedKey.displayName} with the check ${decidedKey.check}, and no shape run raised it, so it decides nothing in this plan`;

// With no run folder of --review, such as for a described change, the decided list decides items of the shape runs by their finding key, because an item number names an item of 1 run only and a reach names abstractions of a run folder. The list is written before the shape runs, so a key that no shape run raised is no defect: it is a decided key not raised, which the finish command prints and lists in outcome.json, so no object is dropped in silence.
export const resolveDecidedListOnShapeRuns = (decidedList, shapeRuns) => {
  const decidedShapeItemOfKeyMap = new Map();
  const decidedKeysNotRaised = [];
  const defects = [];
  for (const decided of decidedList.decided) {
    if (Number.isInteger(decided.number)) {
      defects.push(createKeyUnknownDefect(decided, "with no run folder of --review an item number names no item, so the object names its finding by displayName with check"));
      continue;
    }
    if (decided.reach) {
      defects.push(...decided.reach.map(key => createReachKeyDefect(DECIDED_DEFECT_CODES.REACH_KEY_UNKNOWN, decided, key, "and with no run folder of --review the decided list has no abstractions to extend a ruling to")));
      continue;
    }

    const shapeItems = listShapeItemsOfTheDecided(decided, shapeRuns);
    if (!shapeItems.length) {
      decidedKeysNotRaised.push({ displayName: decided.displayName, check: decided.check });
      continue;
    }
    const decision = { reason: decided.reason, says: decided.says, decidedBy: decided.decidedBy || DECIDED_BY_DEFAULT };
    for (const shapeItem of shapeItems) decidedShapeItemOfKeyMap.set(createShapeItemCheckKey(shapeItem.shapeRun, shapeItem.number, shapeItem.check), { ...shapeItem, decision });
  }
  return { decidedShapeItems: [...decidedShapeItemOfKeyMap.values()], decidedKeysNotRaised, defects };
};

const describeTheReachKey = (decided, key) => `the reach of ${describeTheKey(decided)} names ${key.displayName} at ${key.scale} scale${key.file ? ` in ${key.file}` : ""}`;

const createReachKeyDefect = (code, decided, key, why) => ({ code, name: key.displayName, sentence: `${describeTheReachKey(decided, key)}, ${why}` });

// The check a reach key extends the ruling to: its own, else the check of the ruling; none where an object by number names no check, which then holds every check of the result.
const readCheckOfTheReachKey = (decided, key) => key.check ?? decided.check;

const isTheResultOfTheReachKey = (finding, decided, key) => finding.displayName === key.displayName && finding.scale === key.scale.toLowerCase() && holdsTheCheck(finding, readCheckOfTheReachKey(decided, key));

const listChecksOfTheReachKey = (finding, decided, key) => {
  const check = readCheckOfTheReachKey(decided, key);
  return check === undefined ? readChecksOfTheFinding(finding) : [check];
};

const readModelFindingObjects = model => (model && model.decisions && Array.isArray(model.decisions.findings) ? model.decisions.findings.filter(object => object && typeof object === "object") : []);

// An object of the model that closes an item with a reason is a decision of the designer; one without a reason asks the writer for a change.
const isADecisionOfTheDesigner = (object, check) => isAText(object.reason) && !isAText(object.closedBy) && (!isAText(object.openAfterCeiling) || holdsADecidedReason(object)) && (object.check === undefined || object.check === check);

const buildItemNumberOfFindingMap = run => new Map((run ? run.items || [] : []).flatMap(item => item.findings.map(finding => [finding.index, item.number])));

const isRuledByTheList = (finding, check, round) => round.decisionOfFindingCheckMap.has(createFindingCheckKey(finding, check));

// A finding the same round sends to a fix: no entry of the decided list rules on its check, it is no item to consider, and no object of the designer decides its item, so findings.json gives it to a writer.
const isSentToAFixByTheRound = (finding, check, round) => !isRuledByTheList(finding, check, round)
  && !finding.toConsider
  && !readModelFindingObjects(round.model).some(object => object.number === round.itemNumberOfFindingMap.get(finding.index) && isADecisionOfTheDesigner(object, check));

const listFindingsOfTheReachKey = (findings, decided, key) => findings
  .filter(finding => isTheResultOfTheReachKey(finding, decided, key))
  .flatMap(finding => listChecksOfTheReachKey(finding, decided, key).map(check => ({ finding, check })));

// A reach key names 1 abstraction of the run the person ruled on, in 1 file, and only one whose own lines give a lines fingerprint, because a decision with no guard may not be widened. A reach never stands in for a ruling: a result of the key that this run set apart by an earlier ruling of the person, or that the same round sends to a fix, is ruled on by its own entry; a result that the list rules on by its own entry needs no refusal, because that entry wins over the reach.
const findReachKeyDefect = (decided, key, linesFingerprints, round) => {
  const displayNames = [key.displayName];
  const scale = key.scale.toLowerCase();
  if (!linesFingerprints.holdsTheAbstraction(displayNames, scale, key.file)) return createReachKeyDefect(DECIDED_DEFECT_CODES.REACH_KEY_UNKNOWN, decided, key, "and the run holds no such abstraction");
  const files = linesFingerprints.listFilesOfTheAbstraction(displayNames, scale);
  if (!key.file && files.length > 1) return createReachKeyDefect(DECIDED_DEFECT_CODES.REACH_KEY_AMBIGUOUS, decided, key, `and ${files.length} files hold it, ${files.join(" and ")}, so the key needs the file the person read`);
  const setApart = listFindingsOfTheReachKey(round.setApartFindings, decided, key);
  if (setApart.some(({ finding, check }) => !isRuledByTheList(finding, check, round))) return createReachKeyDefect(DECIDED_DEFECT_CODES.REACH_KEY_ALREADY_DECIDED, decided, key, "and this run set its result apart by an earlier ruling of the person, so only its own entry may rule on it again, with the linesFingerprintNow of this run where it changed since");
  const open = listFindingsOfTheReachKey(round.findings, decided, key);
  if (open.some(({ finding, check }) => isSentToAFixByTheRound(finding, check, round))) return createReachKeyDefect(DECIDED_DEFECT_CODES.REACH_KEY_SENT_TO_A_FIX, decided, key, "and the same round sends its finding to a fix, so a reach may not decide it; rule on it by its own entry or leave it out of the reach");
  if (linesFingerprints.findLinesFingerprint(displayNames, scale, key.file)) return null;
  return createReachKeyDefect(DECIDED_DEFECT_CODES.REACH_KEY_WITHOUT_FINGERPRINT, decided, key, "and the run gives its own lines no lines fingerprint, such as for a folder, a field group or a class seen only through a hunk, so the reach may not cover it");
};

// The defects of the reach keys of a checked decided list against the run the person ruled on: its abstractions, its set-apart results, and the findings the round sends to a fix by the decisions of the list and the objects of the model.
export const findReachDefects = (decidedList, linesFingerprints, { run = null, decisionOfFindingCheckMap = new Map(), model = null } = {}) => {
  const round = {
    findings: run ? run.findings || [] : [],
    setApartFindings: run ? [...(run.decidedFindings || []), ...(run.changedSinceFindings || [])] : [],
    decisionOfFindingCheckMap,
    model,
    itemNumberOfFindingMap: buildItemNumberOfFindingMap(run),
  };
  return decidedList.decided
    .flatMap(decided => (decided.reach || []).map(key => findReachKeyDefect(decided, key, linesFingerprints, round)))
    .filter(Boolean);
};
