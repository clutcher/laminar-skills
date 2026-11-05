import { FINDING_REASONS } from "../model/DesignModelForm.mjs";
import { isAText } from "../model/DesignModel.mjs";

export const DECIDED_BY_DEFAULT = "caller";

export const DECIDED_DEFECT_CODES = Object.freeze({ DECIDED_KEY_UNKNOWN: "decided-key-unknown", DECIDED_NOT_CARRIED: "decided-not-carried" });

// The keys of a disposition that the decided list never holds, because the calling session decides only a reason class.
const REFUSED_KEYS = Object.freeze(["to", "question", "renamedFrom"]);

export class DecidedListStop extends Error {}

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
  return null;
};

// A list with 1 malformed object is refused whole, because the calling session mapped its decisions and a part of them would plan the rest wrong.
export const checkDecidedListForm = given => {
  if (!Array.isArray(given)) throw new DecidedListStop("decided: the file holds no JSON list");
  const problems = given.map(findFormProblem).filter(Boolean);
  if (problems.length) throw new DecidedListStop(`decided: the list is refused:\n${problems.map(problem => `  ${problem}`).join("\n")}`);
  return given;
};

const listFindingsOfTheDecided = (decided, run) => {
  if (Number.isInteger(decided.number)) {
    const item = run.items.find(other => other.number === decided.number);
    return item ? item.findings.filter(finding => decided.check === undefined || finding.check === decided.check) : [];
  }
  return run.findings.filter(finding => finding.displayName === decided.displayName && finding.check === decided.check);
};

const describeTheKey = decided => (Number.isInteger(decided.number)
  ? `item ${decided.number}${decided.check === undefined ? "" : ` with the check ${decided.check}`}`
  : `the finding key ${decided.displayName} with the check ${decided.check}`);

// Each object of the decided list applies to every finding its item number or its finding key names, with decidedBy as the list gives it, else caller.
export const resolveDecidedList = (decidedList, run) => {
  const decisionOfFindingMap = new Map();
  const defects = [];
  for (const decided of decidedList) {
    const findings = listFindingsOfTheDecided(decided, run);
    if (!findings.length) {
      defects.push({ code: DECIDED_DEFECT_CODES.DECIDED_KEY_UNKNOWN, name: decided.displayName || "", sentence: `the decided list names ${describeTheKey(decided)}, and no finding of the run holds it` });
      continue;
    }
    const decision = { reason: decided.reason, says: decided.says, decidedBy: decided.decidedBy || DECIDED_BY_DEFAULT };
    for (const finding of findings) decisionOfFindingMap.set(finding.index, decision);
  }
  return { decisionOfFindingMap, defects };
};
