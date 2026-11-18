import fs from "node:fs";
import path from "node:path";
import { readRunFileText, RunFileStop } from "../../../files/runFile.mjs";
import { formatDisplayNameText } from "../sections/ItemText.mjs";
import { PUBLIC_CHANGE_KINDS } from "../../../code/index.mjs";
import { LinesFingerprintsOfTheRun } from "./LinesFingerprint.mjs";

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

// The renames of the plan the decision's lines use, each [old name, new name]; a malformed pair is left out, which can only read as changed since.
const readRenameMask = given => (Array.isArray(given) ? given.filter(names => Array.isArray(names) && names.length === 2 && names.every(isAText)) : []);

const isAnObject = given => typeof given === "object" && given !== null && !Array.isArray(given);

// A decision that is no object, that lacks a field of its key, whose reachOf is present and no text, or whose methodRemoved is present and no boolean, stops the render with its number, never with an error of the language, because a reach read as a direct decision, or a removed method read as a method of its class, would take the class of its method.
const createDecision = (given, order) => {
  if (!isAnObject(given)) throw new RunFileStop(`decided review file: decision ${order + 1} is no object`);
  const missing = KEY_FIELDS.filter(field => !isAText(given[field]));
  if (missing.length) throw new RunFileStop(`decided review file: decision ${order + 1} has no ${missing.join(", ")}`);
  if (given.reachOf !== undefined && !isAText(given.reachOf)) throw new RunFileStop(`decided review file: decision ${order + 1} (${given.check} ${given.displayName}) has a reachOf that is no text`);
  if (given.methodRemoved !== undefined && typeof given.methodRemoved !== "boolean") throw new RunFileStop(`decided review file: decision ${order + 1} (${given.check} ${given.displayName}) has a methodRemoved that is no boolean`);
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
    linesFingerprint: isAText(given.linesFingerprint) ? given.linesFingerprint : "",
    renameMask: readRenameMask(given.renameMask),
    reachOf: isAText(given.reachOf) ? given.reachOf : "",
    takenFrom: isAText(given.takenFrom) ? given.takenFrom : "",
    methodRemoved: given.methodRemoved === true,
  };
};

// A plain JSON list is the form of the decided list the design reads, so the reader most likely gave that file in place of the decided review file the design writes.
const formatTheHintOfAList = given => (Array.isArray(given) ? "; the file is a JSON list, the form of a decided list, and --decided-review takes the file plans/<n>/decided-review.json of the results folder" : "");

// The file the design writes per ready plan; the render reads its decisions and carries the rest as context for the reader.
export const readDecidedReviewFile = filePath => {
  let given;
  try {
    given = JSON.parse(readRunFileText(filePath));
  } catch (error) {
    if (error instanceof RunFileStop) throw error;
    throw new RunFileStop(`decided review file: ${filePath} is no JSON: ${error.message}`);
  }
  if (!given || !Array.isArray(given.decided)) throw new RunFileStop(`decided review file: ${filePath} holds no list decided${formatTheHintOfAList(given)}`);

  return {
    filePath,
    plan: Number.isFinite(given.plan) ? given.plan : null,
    baseCommit: isAText(given.baseCommit) ? given.baseCommit.trim() : "",
    decisions: given.decided.map(createDecision),
    overrides: Array.isArray(given.overrides) ? given.overrides : [],
  };
};

export const readCheckIds = finding => (finding.combined ? [...finding.combined.checks] : [finding.check]);

export const readScale = finding => String(finding.scale || (finding.abstraction || {}).scale || "").toLowerCase();

export const readDisplayNameOfTheFinding = finding => formatDisplayNameText(finding) || String((finding.abstraction || {}).displayName || "");

const readMethodName = decision => decision.displayName.slice(decision.displayName.lastIndexOf("#") + 1);

const escapeForAPattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A name stands in a line where no letter, digit, underscore or dollar sign touches it on either side, and it names the method of the class only where no member access, such as . or :: or -> or #, stands before it: in a line of the class, that is the declaring line or a call of the class on itself, while a qualified call can reach a same-named method of another class.
const namesTheOwnMethod = (text, methodName) => new RegExp(`(?<![A-Za-z0-9_$])(?<!(?:\\.|::|->|#)\\s*)${escapeForAPattern(methodName)}(?![A-Za-z0-9_$])`).test(String(text || ""));

const listEvidenceTexts = finding => [...(finding.evidence || []), ...(finding.quotes || [])].map(line => (line && typeof line === "object" ? line.text : ""));

// 1 step up only: a method-scale decision reaches a class-scale result on the class the model gives the method, and only where the judge's evidence names the method. A reach decision decides only the key the person named, so it never takes the class of its method. A method the model removed stands in no later code, so evidence that names it names a call of another method of that name, and its class only relates the decision.
const isOnTheClassOfTheMethod = (decision, finding, displayName) => decision.scale === METHOD_SCALE
  && !decision.reachOf
  && !decision.methodRemoved
  && readScale(finding) === CLASS_SCALE
  && isAText(decision.classDisplayName)
  && (displayName === decision.classDisplayName || decision.classFormerNames.includes(displayName))
  && listEvidenceTexts(finding).some(text => namesTheOwnMethod(text, readMethodName(decision)));

// A decision on a removed method with no lines fingerprint cannot tell a method later added under that name from the method it ruled on, so it matches no key and only relates.
const isARemovedMethodWithoutAFingerprint = decision => decision.methodRemoved && !decision.linesFingerprint;

const findMatchedBy = (decision, finding) => {
  if (isARemovedMethodWithoutAFingerprint(decision)) return "";
  const displayName = readDisplayNameOfTheFinding(finding);
  if (readScale(finding) === decision.scale) {
    if (displayName === decision.displayName) return MATCHED_BY.DISPLAY_NAME;
    return decision.formerNames.includes(displayName) ? MATCHED_BY.FORMER_NAME : "";
  }
  return isOnTheClassOfTheMethod(decision, finding, displayName) ? MATCHED_BY.CLASS_OF_THE_METHOD : "";
};

const isOfTheKey = (decision, finding) => readCheckIds(finding).includes(decision.check) && Boolean(findMatchedBy(decision, finding));

const FOLDER_SCALES = new Set(["application", "module"]);

// The 2 expiries: outside the change holds only while the change does not touch the result, and a kind the plan left holds only while the review reads it unchanged. A lines fingerprint of the decision's own lines guards closer than either, because any change of those lines reads changed since, so such a decision never expires. The fingerprint of a folder holds only its child names, so a folder decision expires as one without a fingerprint, and its fingerprint only reads changed since where a child joins or leaves.
const findExpiry = (decision, finding, changeKinds) => {
  if (decision.linesFingerprint && !FOLDER_SCALES.has(decision.scale)) return "";
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

const isTakenFromCode = mark => Boolean(mark.decision.takenFrom);

// Of 2 marks with the same match and plan, the decision the design carried onto code that moved leads, so the result names the carry; the design copies a class decision onto its own key with the same lines fingerprint, so both read alike.
const compareTheMarks = (left, right) => {
  const byName = RANK_OF_MATCHED_BY[left.matchedBy] - RANK_OF_MATCHED_BY[right.matchedBy];
  const byPlan = (right.decision.plan ?? 0) - (left.decision.plan ?? 0);
  return byName || byPlan || Number(isTakenFromCode(right)) - Number(isTakenFromCode(left));
};

// A method decision that marked a class-scale result compares the lines of its method, and every other mark the lines of the result's own abstraction.
const readLinesFingerprintNow = (mark, linesFingerprints) => (mark.matchedBy === MATCHED_BY.CLASS_OF_THE_METHOD
  ? linesFingerprints.findLinesFingerprint([mark.decision.displayName, ...mark.decision.formerNames], METHOD_SCALE, mark.finding.file, mark.decision.renameMask)
  : linesFingerprints.findLinesFingerprint([readDisplayNameOfTheFinding(mark.finding)], readScale(mark.finding), mark.finding.file, mark.decision.renameMask));

// The plan whose writers wrote the lines a changed-since result stands on now, read from the self-check run folders of that plan; null where no self-check gives those lines. It only names where the change came from: the result stays changed since, because nobody ruled on the written lines.
const findThePlanThatWroteTheLines = (mark, written) => {
  const writtenFingerprint = written.linesFingerprints.map(linesFingerprints => readLinesFingerprintNow(mark, linesFingerprints)).filter(Boolean).at(-1) || "";
  return writtenFingerprint && writtenFingerprint === mark.linesFingerprintNow ? written.plan : null;
};

const NO_WRITTEN_LINES = Object.freeze({ plan: null, linesFingerprints: [] });

// The checks of a result the merge combined that no decision of its marks names; a decision on 1 check rules on that check only, so the result stays open while any check of it is left.
const listChecksLeftOpen = (finding, marks) => {
  const decidedChecks = new Set(marks.map(mark => mark.decision.check));
  return readCheckIds(finding).filter(check => !decidedChecks.has(check));
};

// The design keeps the self-check run folders of a plan's writers beside its decided review file, as self-check/group-<g>.
const SELF_CHECK_FOLDER = "self-check";

const readGroupNumber = groupFolder => Number(path.basename(groupFolder).replace(/\D+/g, "")) || 0;

// The lines the writers of the plan of a decided review file wrote, as the self-check run folders beside the file read them, in the order of the groups, so the last group that wrote an abstraction gives its lines; none where the plan ran no self-check.
export const readTheLinesOfTheWriters = decidedReview => {
  const selfCheckFolder = path.join(path.dirname(decidedReview.filePath), SELF_CHECK_FOLDER);
  if (decidedReview.plan === null || !fs.existsSync(selfCheckFolder)) return NO_WRITTEN_LINES;

  const groupFolders = fs.readdirSync(selfCheckFolder, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(selfCheckFolder, entry.name))
    .sort((first, second) => readGroupNumber(first) - readGroupNumber(second));
  return { plan: decidedReview.plan, linesFingerprints: groupFolders.map(groupFolder => LinesFingerprintsOfTheRun.readFrom(groupFolder)) };
};

// A decision holds while the lines it was made on stand as they were; lines the run cannot read count as changed, so a decision never hides a result it cannot confirm.
const isChangedSince = mark => Boolean(mark.decision.linesFingerprint) && mark.linesFingerprintNow !== mark.decision.linesFingerprint;

// Every decision on a result that holds a lines fingerprint is compared, so a result stays decided only while the lines of each of its decisions stand as they were; the first decision that reads changed since leads the mark, else the first by its match and its plan.
const createTheMarkOfTheFinding = (finding, marks, linesFingerprints) => {
  const compared = [...marks].sort(compareTheMarks).map(mark => (mark.decision.linesFingerprint ? { ...mark, linesFingerprintNow: readLinesFingerprintNow({ finding, ...mark }, linesFingerprints) } : mark));
  const leading = compared.find(isChangedSince) || compared[0];
  return { finding, ...leading, alsoDecidedBy: compared.filter(mark => mark !== leading).map(mark => mark.decision) };
};

const NO_LINES_FINGERPRINTS = new LinesFingerprintsOfTheRun(null, null);

// A decision the reach of a ruling gave holds only while the lines of its own key stand as they were, so one without a lines fingerprint, as a file written by hand can hold, is never applied.
const isAReachWithoutAFingerprint = decision => Boolean(decision.reachOf) && !decision.linesFingerprint;

export class DecidedResults {
  // A file whose plan base the reviewed range does not hold applies no decision, and the reports say why.
  constructor(decidedReview, settledFindings, changeKinds, { notAppliedReason = "", linesFingerprints = NO_LINES_FINGERPRINTS, written = NO_WRITTEN_LINES } = {}) {
    this.filePath = decidedReview.filePath;
    this.decisionCount = decidedReview.decisions.length;
    this.overrides = decidedReview.overrides;
    this.notAppliedReason = notAppliedReason;
    this.holdsALinesFingerprint = decidedReview.decisions.some(decision => decision.linesFingerprint);
    this.notMet = [];
    this.ambiguous = [];
    this.expired = [];
    const marksOfFindingMap = new Map();
    const decisionsOfTheFile = notAppliedReason ? [] : decidedReview.decisions;
    this.reachWithoutAFingerprint = decisionsOfTheFile.filter(isAReachWithoutAFingerprint);
    this.appliedDecisions = decisionsOfTheFile.filter(decision => !isAReachWithoutAFingerprint(decision));
    for (const decision of this.appliedDecisions) this.matchTheDecision(decision, settledFindings, changeKinds, marksOfFindingMap);
    this.combinedLeftOpen = settledFindings.filter(finding => marksOfFindingMap.has(finding) && listChecksLeftOpen(finding, marksOfFindingMap.get(finding)).length)
      .map(finding => ({ finding, decisions: marksOfFindingMap.get(finding).map(mark => mark.decision), openChecks: listChecksLeftOpen(finding, marksOfFindingMap.get(finding)) }));
    for (const { finding } of this.combinedLeftOpen) marksOfFindingMap.delete(finding);
    const marks = settledFindings
      .filter(finding => marksOfFindingMap.has(finding))
      .map(finding => createTheMarkOfTheFinding(finding, marksOfFindingMap.get(finding), linesFingerprints));
    this.decided = marks.filter(mark => !isChangedSince(mark));
    this.changedSince = marks.filter(isChangedSince).map(mark => ({ ...mark, changedSince: true, writtenByPlan: findThePlanThatWroteTheLines(mark, written) }));
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

  // The results decided and those decided but changed since both leave the items: neither is kept, and neither is decided alone.
  listDecidedFindings() {
    return [...this.decided, ...this.changedSince].map(mark => mark.finding);
  }

  listMarks() {
    return [...this.decided, ...this.changedSince];
  }
}
