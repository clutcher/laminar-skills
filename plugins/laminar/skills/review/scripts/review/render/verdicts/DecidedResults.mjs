import { readRunFileText, RunFileStop } from "../../../files/runFile.mjs";
import { formatDisplayNameText } from "../sections/ItemText.mjs";
import { PUBLIC_CHANGE_KINDS } from "../../../code/index.mjs";

export const MATCHED_BY = Object.freeze({ DISPLAY_NAME: "displayName", FORMER_NAME: "formerName", CLASS_OF_THE_METHOD: "classOfTheMethod" });

const METHOD_SCALE = "method";

const CLASS_SCALE = "class";

const OUTSIDE_THE_CHANGE = "outside the change";

// A plan that leaves an abstraction as it is decides it only while the code under it stays as it is.
const KINDS_THE_PLAN_LEAVES = new Set([PUBLIC_CHANGE_KINDS.UNCHANGED, "outside"]);

const KINDS_OF_A_CHANGE = new Set([PUBLIC_CHANGE_KINDS.MODIFIED, PUBLIC_CHANGE_KINDS.MOVED, PUBLIC_CHANGE_KINDS.CREATED]);

const KEY_FIELDS = Object.freeze(["check", "scale", "displayName"]);

const isAText = given => typeof given === "string" && given.trim().length > 0;

const readTexts = given => (Array.isArray(given) ? given.filter(isAText) : []);

const createDecision = (given, order) => {
  const missing = KEY_FIELDS.filter(field => !isAText(given[field]));
  if (missing.length) throw new RunFileStop(`decided review file: decision ${order + 1} has no ${missing.join(", ")}`);
  return {
    check: given.check,
    scale: given.scale.toLowerCase(),
    displayName: given.displayName,
    formerNames: readTexts(given.formerNames).filter(name => name !== given.displayName),
    file: isAText(given.file) ? given.file : "",
    reason: String(given.reason || ""),
    says: String(given.says || ""),
    decidedBy: String(given.decidedBy || ""),
    plan: Number.isFinite(given.plan) ? given.plan : null,
    source: String(given.source || ""),
    plannedKind: String(given.plannedKind || ""),
    classDisplayName: isAText(given.classDisplayName) ? given.classDisplayName : "",
    classFormerNames: readTexts(given.classFormerNames),
  };
};

// The file the design writes per ready plan; the render reads its decisions and carries the rest as context for the reader.
export const readDecidedReviewFile = filePath => {
  let given;
  try {
    given = JSON.parse(readRunFileText(filePath));
  } catch (error) {
    if (error instanceof RunFileStop) throw error;
    throw new RunFileStop(`decided review file: ${filePath} is no JSON: ${error.message}`);
  }
  if (!given || !Array.isArray(given.decided)) throw new RunFileStop(`decided review file: ${filePath} holds no list decided`);

  return {
    filePath,
    plan: Number.isFinite(given.plan) ? given.plan : null,
    baseCommit: isAText(given.baseCommit) ? given.baseCommit.trim() : "",
    decisions: given.decided.map(createDecision),
    overrides: Array.isArray(given.overrides) ? given.overrides : [],
  };
};

const readCheckIds = finding => (finding.combined ? [...finding.combined.checks] : [finding.check]);

const readScale = finding => String(finding.scale || (finding.abstraction || {}).scale || "").toLowerCase();

export const readDisplayNameOfTheFinding = finding => formatDisplayNameText(finding) || String((finding.abstraction || {}).displayName || "");

const readMethodName = decision => decision.displayName.slice(decision.displayName.lastIndexOf("#") + 1);

const escapeForAPattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A name stands in a line where no letter, digit, underscore or dollar sign touches it on either side.
const namesTheMethod = (text, methodName) => new RegExp(`(^|[^A-Za-z0-9_$])${escapeForAPattern(methodName)}([^A-Za-z0-9_$]|$)`).test(String(text || ""));

const listEvidenceTexts = finding => [...(finding.evidence || []), ...(finding.quotes || [])].map(line => (line && typeof line === "object" ? line.text : ""));

// 1 step up only: a method-scale decision reaches a class-scale result on the class the model gives the method, and only where the judge's evidence names the method.
const isOnTheClassOfTheMethod = (decision, finding, displayName) => decision.scale === METHOD_SCALE
  && readScale(finding) === CLASS_SCALE
  && isAText(decision.classDisplayName)
  && (displayName === decision.classDisplayName || decision.classFormerNames.includes(displayName))
  && listEvidenceTexts(finding).some(text => namesTheMethod(text, readMethodName(decision)));

const findMatchedBy = (decision, finding) => {
  const displayName = readDisplayNameOfTheFinding(finding);
  if (readScale(finding) === decision.scale) {
    if (displayName === decision.displayName) return MATCHED_BY.DISPLAY_NAME;
    return decision.formerNames.includes(displayName) ? MATCHED_BY.FORMER_NAME : "";
  }
  return isOnTheClassOfTheMethod(decision, finding, displayName) ? MATCHED_BY.CLASS_OF_THE_METHOD : "";
};

const isOfTheKey = (decision, finding) => readCheckIds(finding).includes(decision.check) && Boolean(findMatchedBy(decision, finding));

// The 2 expiries of a decision: outside the change holds only while the change does not touch the result, and a kind the plan left holds only while the review reads it unchanged.
const findExpiry = (decision, finding, changeKinds) => {
  if (decision.reason === OUTSIDE_THE_CHANGE && finding.inChange !== false) return "the change touches it";
  const reviewedKind = changeKinds.readKindOfTheFinding(finding);
  if (KINDS_THE_PLAN_LEAVES.has(decision.plannedKind) && KINDS_OF_A_CHANGE.has(reviewedKind)) return `the plan leaves it ${decision.plannedKind} and the review reads it ${reviewedKind}`;
  return "";
};

// 1 decision on 2 results of 1 key in 2 files marks the result in its own file, and none where its file names neither.
const chooseTheMatchesOfItsFile = (decision, matches) => {
  const files = new Set(matches.map(finding => finding.file));
  return files.size > 1 ? matches.filter(finding => finding.file === decision.file) : matches;
};

const RANK_OF_MATCHED_BY = Object.freeze({ [MATCHED_BY.DISPLAY_NAME]: 0, [MATCHED_BY.FORMER_NAME]: 1, [MATCHED_BY.CLASS_OF_THE_METHOD]: 2 });

const compareTheMarks = (left, right) => {
  const byName = RANK_OF_MATCHED_BY[left.matchedBy] - RANK_OF_MATCHED_BY[right.matchedBy];
  return byName || (right.decision.plan ?? 0) - (left.decision.plan ?? 0);
};

export class DecidedResults {
  // A file whose plan base the reviewed range does not hold applies no decision, and the reports say why.
  constructor(decidedReview, settledFindings, changeKinds, notAppliedReason = "") {
    this.filePath = decidedReview.filePath;
    this.decisionCount = decidedReview.decisions.length;
    this.overrides = decidedReview.overrides;
    this.notAppliedReason = notAppliedReason;
    this.notMet = [];
    this.ambiguous = [];
    this.expired = [];
    const marksOfFindingMap = new Map();
    const appliedDecisions = notAppliedReason ? [] : decidedReview.decisions;
    for (const decision of appliedDecisions) this.matchTheDecision(decision, settledFindings, changeKinds, marksOfFindingMap);
    this.decided = settledFindings
      .filter(finding => marksOfFindingMap.has(finding))
      .map(finding => {
        const [mark, ...others] = marksOfFindingMap.get(finding).sort(compareTheMarks);
        return { finding, ...mark, alsoDecidedBy: others.map(other => other.decision) };
      });
  }

  matchTheDecision(decision, settledFindings, changeKinds, marksOfFindingMap) {
    const matches = settledFindings.filter(finding => isOfTheKey(decision, finding));
    if (!matches.length) {
      this.notMet.push(decision);
      return;
    }

    const chosen = chooseTheMatchesOfItsFile(decision, matches);
    if (!chosen.length) {
      this.ambiguous.push({ decision, files: [...new Set(matches.map(finding => finding.file))] });
      return;
    }

    for (const finding of chosen) {
      const expiry = findExpiry(decision, finding, changeKinds);
      if (expiry) {
        this.expired.push({ decision, finding, expiry });
        continue;
      }
      const marks = marksOfFindingMap.get(finding) || [];
      marks.push({ decision, matchedBy: findMatchedBy(decision, finding) });
      marksOfFindingMap.set(finding, marks);
    }
  }

  listDecidedFindings() {
    return this.decided.map(mark => mark.finding);
  }
}
