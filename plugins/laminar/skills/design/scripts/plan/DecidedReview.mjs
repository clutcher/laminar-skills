import fs from "node:fs";
import path from "node:path";
import { isAText, readList, readOldTypeName } from "../model/DesignModel.mjs";
import { findClassOfTheFinding, readFindingNamePieces } from "./FindingList.mjs";
import { listFormerNames } from "../round/FormerNames.mjs";
import { listRenamesBetweenRounds } from "../round/RoundRenames.mjs";
import { STANDINGS, findStandingInTheModel } from "../round/AbstractionStanding.mjs";

// The value of decidedBy where neither the decided list nor the object names who decided: the designer left the finding with its reason.
export const DECIDED_BY_THE_DESIGNER = "designer";

export const PLANNED_KIND_OUTSIDE = "outside";

const FOLDER_SCALES = new Set(["application", "module"]);

const METHOD_MARK = "#";

const ENCLOSING_MARK = " in ";

const SOURCES = Object.freeze({ FINDINGS_FILE: "findings.json" });

const formatInputRunSource = number => `input run item ${number}`;

const formatShapeRunSource = (run, number) => `shape run ${run} item ${number}`;

const createDecisionKey = decision => `${decision.check}\t${decision.scale}\t${decision.displayName}`;

const replaceTheClassOfTheEnclosing = (enclosing, scale, theClass) => {
  const { className, methodName } = readFindingNamePieces(enclosing, scale);
  if (!theClass.oldName || className !== readOldTypeName(theClass)) return enclosing;

  const renamedMethod = readList(theClass.methods).find(method => method.oldName === methodName);
  const memberPart = enclosing.slice(className.length);
  return `${theClass.name}${renamedMethod ? `${METHOD_MARK}${renamedMethod.name}` : memberPart}`;
};

// The review names an abstraction of the base by its name in the base, and the written code carries the name the model plans for it.
const readPlannedName = (displayName, scale, theClass) => {
  if (!theClass) return displayName;
  const enclosingAt = displayName.indexOf(ENCLOSING_MARK);
  if (enclosingAt < 0) return replaceTheClassOfTheEnclosing(displayName, scale, theClass);
  const enclosingStart = enclosingAt + ENCLOSING_MARK.length;
  return `${displayName.slice(0, enclosingStart)}${replaceTheClassOfTheEnclosing(displayName.slice(enclosingStart), "method", theClass)}`;
};

const readPlannedKind = (model, theClass, file) => {
  if (theClass) return model.getKindOfClass(theClass);
  const child = model.findChildOfTheFile(file);
  return child ? child.kind : PLANNED_KIND_OUTSIDE;
};

const METHOD_SCALE = "method";

const NO_HOLDING_CLASS = Object.freeze({});

// The class that holds a method by the nesting of the model, never by a prefix of its name, so a method-scale decision may reach a class-scale result on that class and on no class around it.
const readHoldingClass = (displayName, scale, theClass, formerNames) => {
  if (scale !== METHOD_SCALE || !theClass) return NO_HOLDING_CLASS;
  const { className, methodName } = readFindingNamePieces(displayName, scale);
  if (!readList(theClass.methods).some(method => method.name === methodName)) return NO_HOLDING_CLASS;

  const namesOfTheReview = [className, ...formerNames.map(name => readFindingNamePieces(name, scale).className)];
  const classFormerNames = new Set([...namesOfTheReview, ...(theClass.oldName ? [readOldTypeName(theClass)] : [])]);
  classFormerNames.delete(theClass.name);
  return { classDisplayName: theClass.name, classFormerNames: [...classFormerNames].sort() };
};

const readFileOfTheFinding = finding => {
  const place = finding.places.find(other => other.file);
  return place ? place.file : "";
};

// The lines fingerprint of the abstraction as the input run folder gives it under the name of the base, so the render can tell whether its lines changed since the decision.
const readLinesFingerprintField = (linesFingerprints, finding) => {
  if (!linesFingerprints || FOLDER_SCALES.has(finding.scale)) return {};

  const linesFingerprint = linesFingerprints.findLinesFingerprint([finding.displayName], finding.scale, finding.file ?? readFileOfTheFinding(finding));
  return linesFingerprint ? { linesFingerprint } : {};
};

const createDecision = (model, modelBefore, finding, decided) => {
  const isAFolder = FOLDER_SCALES.has(finding.scale);
  const file = isAFolder ? "" : (finding.file ?? readFileOfTheFinding(finding));
  const theClass = isAFolder ? null : findClassOfTheFinding(model, finding.displayName, finding.scale, file);
  const displayName = readPlannedName(finding.displayName, finding.scale, theClass);
  const formerNames = new Set([...listFormerNames(model, modelBefore, displayName), finding.displayName]);
  formerNames.delete(displayName);
  const sortedFormerNames = [...formerNames].sort();
  return {
    check: finding.check,
    scale: finding.scale,
    displayName,
    formerNames: sortedFormerNames,
    ...readHoldingClass(displayName, finding.scale, theClass, sortedFormerNames),
    file: theClass ? theClass.file : file,
    reason: decided.reason,
    says: decided.says || "",
    decidedBy: decided.decidedBy || DECIDED_BY_THE_DESIGNER,
    plan: decided.plan,
    source: decided.source,
    plannedKind: isAFolder ? "" : readPlannedKind(model, theClass, file),
  };
};

// An object that asks for a change of the code is no decision, so only an object with a reason and no closing enters.
const isADecidingObject = object => isAText(object.reason) && !isAText(object.closedBy) && !isAText(object.openAfterCeiling);

const listFindingsOfTheItem = (run, number, check) => {
  const item = run ? run.items.find(other => other.number === number) : null;
  return item ? item.findings.filter(finding => !isAText(check) || finding.check === check) : [];
};

const listDecisionsOfTheObjects = ({ model, modelBefore, plan, inputRun, readShapeRun, linesFingerprints }) => readList(model.decisions.findings)
  .filter(isADecidingObject)
  .flatMap(object => {
    const isOfAShapeRun = Number.isFinite(object.run);
    const run = isOfAShapeRun ? readShapeRun(object.run) : inputRun;
    const source = isOfAShapeRun ? formatShapeRunSource(object.run, object.number) : formatInputRunSource(object.number);
    return listFindingsOfTheItem(run, object.number, object.check).map(finding => ({ ...createDecision(model, modelBefore, finding, { ...object, plan, source }), ...readLinesFingerprintField(linesFingerprints, finding) }));
  });

const listDecisionsOfTheEntries = ({ model, modelBefore, plan, entries, linesFingerprints }) => readList(entries)
  .filter(entry => isAText(entry.reason))
  .map(entry => ({ ...entry, scale: String(entry.scale).toLowerCase(), file: entry.file || "" }))
  .map(finding => ({ ...createDecision(model, modelBefore, finding, { ...finding, plan, source: SOURCES.FINDINGS_FILE }), ...readLinesFingerprintField(linesFingerprints, finding) }));

// An earlier decision follows the renames of the designer and leaves the export where the model removes its abstraction.
const carryTheEarlierDecisions = (earlier, model, decisionKeys) => {
  if (!earlier) return { carried: [], dropped: [] };

  const renames = listRenamesBetweenRounds(earlier.model, model);
  const carried = [];
  const dropped = [];
  for (const decision of earlier.decided) {
    const standing = findStandingInTheModel(model, decision.displayName, renames);
    if (standing.standing === STANDINGS.REMOVED) {
      dropped.push(decision);
      continue;
    }
    const renamed = standing.standing === STANDINGS.RENAMED
      ? { ...decision, displayName: standing.newDisplayName, formerNames: [...new Set([...decision.formerNames, decision.displayName])].sort() }
      : decision;
    if (!decisionKeys.has(createDecisionKey(renamed))) carried.push(renamed);
  }
  return { carried, dropped };
};

const listAnsweredQuestions = model => readList(model.decisions.questions)
  .filter(question => question.answer && (isAText(question.answer.says) || isAText(question.answer.option)))
  .map(question => ({ id: question.id, fact: question.fact || "", answer: question.answer.says || question.answer.option, by: question.answer.by || "" }));

const listExistingDefectsLeftUnfixed = model => readList(model.decisions.existingDefects)
  .filter(existingDefect => isAText(existingDefect.notFixed))
  .map(existingDefect => ({ class: existingDefect.class || "", member: existingDefect.member || "", defect: existingDefect.defect || "", notFixed: existingDefect.notFixed }));

const listOverrides = model => readList(model.decisions.conventions?.overrides).filter(override => override.kind === "override");

// The decided review file of 1 ready plan: every decision of this plan and of the earlier ready plans of the results folder, each with the lines fingerprint of the input run folder where it gives one, and as context the answered questions and the existing defects left unfixed, which match no result.
export const buildDecidedReview = ({ model, modelBefore, plan, inputRun, entries, readShapeRun, baseCommit, planCommit, earlier, linesFingerprints = null }) => {
  const decisionOfKeyMap = new Map();
  for (const decision of [...listDecisionsOfTheObjects({ model, modelBefore, plan, inputRun, readShapeRun, linesFingerprints }), ...listDecisionsOfTheEntries({ model, modelBefore, plan, entries, linesFingerprints })]) {
    const key = `${createDecisionKey(decision)}\t${decision.source}`;
    if (!decisionOfKeyMap.has(key)) decisionOfKeyMap.set(key, decision);
  }
  const decisions = [...decisionOfKeyMap.values()];
  const { carried, dropped } = carryTheEarlierDecisions(earlier, model, new Set(decisions.map(createDecisionKey)));
  return {
    decidedReview: {
      plan,
      baseCommit,
      planCommit,
      decided: [...carried, ...decisions],
      overrides: listOverrides(model),
      answeredQuestions: listAnsweredQuestions(model),
      existingDefects: listExistingDefectsLeftUnfixed(model),
    },
    droppedLines: dropped.map(decision => `dropped: ${decision.displayName} (${decision.scale}, ${decision.check}): the model removes it`),
  };
};

const readTextIfPresent = filePath => (fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").trim() : "");

export const readCommitOfThePlan = (planFolder, commitFile) => readTextIfPresent(path.join(planFolder, commitFile));
