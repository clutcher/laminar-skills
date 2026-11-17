import fs from "node:fs";
import path from "node:path";
import { isAText, readList, readOldTypeName } from "../model/DesignModel.mjs";
import { findClassOfTheFinding, readFindingNamePieces } from "./FindingList.mjs";
import { NOT_REFRESHED_REASONS, formatNotRefreshedLine, readChecksOfTheFinding } from "./DecidedList.mjs";
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

const formatDecidedListSource = round => `decided list round ${round}`;

const createDecisionKey = decision => `${decision.check}\t${decision.scale}\t${decision.displayName}`;

// A method the model renames by oldName follows its new name in a renamed class, and in a class that keeps its name only where the decision holds a lines fingerprint, because without one nothing tells that the renamed method still does what the decision ruled on.
const replaceTheClassOfTheEnclosing = (enclosing, scale, theClass, hasALinesFingerprint) => {
  const { className, methodName } = readFindingNamePieces(enclosing, scale);
  const isTheOldClassName = Boolean(theClass.oldName) && className === readOldTypeName(theClass);
  if (!isTheOldClassName && !hasALinesFingerprint) return enclosing;

  const renamedMethod = methodName ? readList(theClass.methods).find(method => method.oldName === methodName) : null;
  if (!isTheOldClassName && !renamedMethod) return enclosing;
  const memberPart = enclosing.slice(className.length);
  return `${isTheOldClassName ? theClass.name : className}${renamedMethod ? `${METHOD_MARK}${renamedMethod.name}` : memberPart}`;
};

// The review names an abstraction of the base by its name in the base, and the written code carries the name the model plans for it.
const readPlannedName = (displayName, scale, theClass, hasALinesFingerprint) => {
  if (!theClass) return displayName;
  const enclosingAt = displayName.indexOf(ENCLOSING_MARK);
  if (enclosingAt < 0) return replaceTheClassOfTheEnclosing(displayName, scale, theClass, hasALinesFingerprint);
  const enclosingStart = enclosingAt + ENCLOSING_MARK.length;
  return `${displayName.slice(0, enclosingStart)}${replaceTheClassOfTheEnclosing(displayName.slice(enclosingStart), "method", theClass, hasALinesFingerprint)}`;
};

const readPlannedKind = (model, theClass, file) => {
  if (theClass) return model.getKindOfClass(theClass);
  const child = model.findChildOfTheFile(file);
  return child ? child.kind : PLANNED_KIND_OUTSIDE;
};

const METHOD_SCALE = "method";

const CLASS_SCALE = "class";

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

const readSimpleTypeName = typeName => typeName.slice(typeName.lastIndexOf(".") + 1);

const isRenamedByTheModel = member => isAText(member.oldName) && member.oldName !== member.name;

// The renames the model plans for the lines of 1 decided abstraction, as [old name, new name] by simple name: of its own class, the class itself and its fields, and of a method only on the class or on that method, so a rename of another class or of another method never masks these lines.
const listRenamesOfTheDecided = (theClass, finding) => {
  if (!theClass) return [];

  const { methodName } = readFindingNamePieces(finding.displayName, finding.scale);
  const renamedMethods = readList(theClass.methods).filter(isRenamedByTheModel).filter(method => finding.scale === CLASS_SCALE || method.oldName === methodName);
  return [
    ...(isAText(theClass.oldName) ? [[readSimpleTypeName(theClass.oldName), readSimpleTypeName(theClass.name)]] : []),
    ...[...readList(theClass.fields).filter(isRenamedByTheModel), ...renamedMethods].map(member => [member.oldName, member.name]),
  ];
};

// The lines fingerprint of the abstraction as the input run folder gives it under the name of the base, of a folder the fingerprint of its child names, so the render can tell whether it changed since the decision; with the planned renames of its own lines that they use as its rename mask, so those renames alone do not read as a change.
const readLinesFingerprintField = (linesFingerprints, finding, renames) => {
  if (!linesFingerprints) return {};

  const { linesFingerprint, renameMask } = linesFingerprints.findLinesFingerprintWithItsRenames([finding.displayName], finding.scale, finding.file ?? readFileOfTheFinding(finding), renames);
  if (!linesFingerprint) return {};
  return renameMask.length ? { linesFingerprint, renameMask } : { linesFingerprint };
};

const createDecision = (model, modelBefore, finding, decided, linesFingerprints) => {
  const isAFolder = FOLDER_SCALES.has(finding.scale);
  const file = isAFolder ? "" : (finding.file ?? readFileOfTheFinding(finding));
  const theClass = isAFolder ? null : findClassOfTheFinding(model, finding.displayName, finding.scale, file);
  const linesFingerprintField = readLinesFingerprintField(linesFingerprints, finding, listRenamesOfTheDecided(theClass, finding));
  const displayName = readPlannedName(finding.displayName, finding.scale, theClass, Boolean(linesFingerprintField.linesFingerprint));
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
    ...linesFingerprintField,
  };
};

// An object that asks for a change of the code is no decision, so only an object with a reason and no closing enters.
const isADecidingObject = object => isAText(object.reason) && !isAText(object.closedBy) && !isAText(object.openAfterCeiling);

// The findings of an item, 1 per check it decides: an object with a check decides that check, also of a combined result, and one without decides every check of the item.
const listFindingsOfTheItem = (run, number, check) => {
  const item = run ? run.items.find(other => other.number === number) : null;
  if (!item) return [];
  return item.findings.flatMap(finding => readChecksOfTheFinding(finding).filter(other => !isAText(check) || other === check).map(other => ({ ...finding, check: other })));
};

const listDecisionsOfTheObjects = ({ model, modelBefore, plan, inputRun, readShapeRun, linesFingerprints }) => readList(model.decisions.findings)
  .filter(isADecidingObject)
  .flatMap(object => {
    const isOfAShapeRun = Number.isFinite(object.run);
    const run = isOfAShapeRun ? readShapeRun(object.run) : inputRun;
    const source = isOfAShapeRun ? formatShapeRunSource(object.run, object.number) : formatInputRunSource(object.number);
    return listFindingsOfTheItem(run, object.number, object.check).map(finding => createDecision(model, modelBefore, finding, { ...object, plan, source }, linesFingerprints));
  });

const listDecisionsOfTheEntries = ({ model, modelBefore, plan, entries, linesFingerprints }) => readList(entries)
  .filter(entry => isAText(entry.reason))
  .map(entry => ({ ...entry, scale: String(entry.scale).toLowerCase(), file: entry.file || "" }))
  .map(finding => createDecision(model, modelBefore, finding, { ...finding, plan, source: SOURCES.FINDINGS_FILE }, linesFingerprints));

// A result the input run set apart as decided but changed since, ruled on again by an entry of the round of the run with the lines fingerprint of this run, is a decision of this plan with the lines fingerprint of this run. Where this run gives its abstraction no lines fingerprint, the decision the results folder holds stays, because a decision of this plan with no fingerprint would hold whatever its code becomes or expire on the kind of this plan.
const listDecisionsOfTheRefreshed = ({ model, modelBefore, plan, refreshed, linesFingerprints }) => refreshed
  .map(({ finding, decision, round }) => ({ decision: createDecision(model, modelBefore, finding, { ...decision, plan, source: formatDecidedListSource(round) }, linesFingerprints), replacedKey: createCheckAndNameKey(finding.check, finding.displayNameOfTheDecision || finding.displayName) }))
  .filter(({ decision }) => decision.linesFingerprint);

// The key of an earlier decision on 1 check by its display name, which the suppression of a set-apart result names as the key of the decision that marked it.
const createCheckAndNameKey = (check, displayName) => `${check}\t${displayName}`;

// A refresh replaces the earlier decision that marked the result; where that decision marked it by the class of its method or by a former name, its key is not the key of the refreshed decision, and it would stand beside it and keep the result changed since.
const isReplacedByARefresh = (decision, replacedKeys) => [decision.displayName, ...decision.formerNames].some(displayName => replacedKeys.has(createCheckAndNameKey(decision.check, displayName)));

const listResultsNotRefreshed = (refreshed, linesFingerprints) => refreshed
  .filter(({ finding }) => !readLinesFingerprintField(linesFingerprints, finding, []).linesFingerprint)
  .map(({ finding }) => formatNotRefreshedLine(finding, NOT_REFRESHED_REASONS.LINES_NOT_IN_THE_RUN, `this run gives the lines of ${finding.displayName} no fingerprint, so the decided list cannot rule on its current lines, and the decision of the earlier plan stays`));

// An earlier decision follows the renames of the designer and leaves the export where the model removes its abstraction, or where a decision of this plan or a refresh replaces it.
const carryTheEarlierDecisions = (earlier, model, decisionKeys, replacedKeys) => {
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
    if (!decisionKeys.has(createDecisionKey(renamed)) && !isReplacedByARefresh(decision, replacedKeys)) carried.push(renamed);
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

// The decided review file of 1 ready plan: every decision of this plan, also of a result the input run set apart and the decided list rules on again in the round of the run, and of the earlier ready plans of the results folder, each with the lines fingerprint of the input run folder where it gives one, and as context the answered questions and the existing defects left unfixed, which match no result.
export const buildDecidedReview = ({ model, modelBefore, plan, inputRun, entries, readShapeRun, baseCommit, planCommit, earlier, linesFingerprints = null, refreshed = [] }) => {
  const decisionOfKeyMap = new Map();
  const refreshedDecisions = listDecisionsOfTheRefreshed({ model, modelBefore, plan, refreshed, linesFingerprints });
  for (const decision of [...listDecisionsOfTheObjects({ model, modelBefore, plan, inputRun, readShapeRun, linesFingerprints }), ...listDecisionsOfTheEntries({ model, modelBefore, plan, entries, linesFingerprints }), ...refreshedDecisions.map(refresh => refresh.decision)]) {
    const key = `${createDecisionKey(decision)}\t${decision.source}`;
    if (!decisionOfKeyMap.has(key)) decisionOfKeyMap.set(key, decision);
  }
  const decisions = [...decisionOfKeyMap.values()];
  const replacedKeys = new Set(refreshedDecisions.map(refresh => refresh.replacedKey));
  const { carried, dropped } = carryTheEarlierDecisions(earlier, model, new Set(decisions.map(createDecisionKey)), replacedKeys);
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
    droppedLines: [...dropped.map(decision => `dropped: ${decision.displayName} (${decision.scale}, ${decision.check}): the model removes it`), ...listResultsNotRefreshed(refreshed, linesFingerprints)],
  };
};

const readTextIfPresent = filePath => (fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").trim() : "");

export const readCommitOfThePlan = (planFolder, commitFile) => readTextIfPresent(path.join(planFolder, commitFile));
