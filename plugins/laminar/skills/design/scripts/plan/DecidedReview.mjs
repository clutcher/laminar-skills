import fs from "node:fs";
import path from "node:path";
import { holdsADecidedReason, isAText, isMarkedUnchanged, readList, readOldTypeName } from "../model/DesignModel.mjs";
import { findClassOfTheFinding, readFindingNamePieces } from "./FindingList.mjs";
import { NOT_REFRESHED_REASONS, createFindingCheckKey, formatNotRefreshedLine, readChecksOfTheFinding } from "./DecidedList.mjs";
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

const formatReachSource = decision => `reach of ${decision.check} ${decision.displayName}`;

const formatTakenCodeSource = decision => `code taken from ${decision.check} ${decision.displayName}`;

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

// The class that holds a method by the nesting of the model, never by a prefix of its name, so a method-scale decision may reach a class-scale result on that class and on no class around it. A method the class lists under removed keeps its class, so a later review relates the open siblings and the class of the gone method, with the mark methodRemoved, so the render never decides the class by it; a name that a method of the class carries as its oldName is renamed, not removed, and stands in the next code under its new name.
const readHoldingClass = (displayName, scale, theClass, formerNames) => {
  if (scale !== METHOD_SCALE || !theClass) return NO_HOLDING_CLASS;
  const { className, methodName } = readFindingNamePieces(displayName, scale);
  const isAMethodOfTheClass = readList(theClass.methods).some(method => method.name === methodName);
  const isRenamed = readList(theClass.methods).some(method => method.oldName === methodName);
  const isRemoved = !isAMethodOfTheClass && !isRenamed && readList(theClass.removed).includes(methodName);
  if (!isAMethodOfTheClass && !isRemoved) return NO_HOLDING_CLASS;

  const namesOfTheReview = [className, ...formerNames.map(name => readFindingNamePieces(name, scale).className)];
  const classFormerNames = new Set([...namesOfTheReview, ...(theClass.oldName ? [readOldTypeName(theClass)] : [])]);
  classFormerNames.delete(theClass.name);
  return { classDisplayName: theClass.name, classFormerNames: [...classFormerNames].sort(), ...(isRemoved ? { methodRemoved: true } : {}) };
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

const readReachList = given => (Array.isArray(given) ? given : []);

// The file of a reach key: its own, else the 1 file of the run that holds the name; none where 2 files hold it, which the design check refuses.
const readFileOfTheReachKey = (key, scale, linesFingerprints) => {
  if (key.file) return key.file;
  const files = linesFingerprints.listFilesOfTheAbstraction([key.displayName], scale);
  return files.length === 1 ? files[0] : "";
};

// A reach decision decides only the key the person named, so it carries no class of its method, and never decides a class result by the class-of-the-method match.
const withoutTheClassOfTheMethod = ({ classDisplayName, classFormerNames, methodRemoved, ...decision }) => decision;

// 1 decision per key the person named in the reach of a ruling, each with the lines fingerprint of its own lines in the input run folder, so each holds only while its own lines stand as they were; a key whose file is not 1 or whose lines give no fingerprint is left out, because the design check refuses it.
const listDecisionsOfTheReach = ({ model, modelBefore, linesFingerprints }, decision, reach) => (linesFingerprints ? readReachList(reach) : [])
  .map(key => ({ key, scale: String(key.scale).toLowerCase() }))
  .map(({ key, scale }) => ({ key, scale, file: readFileOfTheReachKey(key, scale, linesFingerprints) }))
  .filter(({ file }) => file)
  .map(({ key, scale, file }) => createDecision(model, modelBefore, { displayName: key.displayName, scale, check: key.check || decision.check, file }, { reason: decision.reason, says: decision.says, decidedBy: decision.decidedBy, plan: decision.plan, source: formatReachSource(decision) }, linesFingerprints))
  .filter(reachDecision => reachDecision.linesFingerprint)
  .map(reachDecision => ({ ...withoutTheClassOfTheMethod(reachDecision), reachOf: decision.displayName }));

const createDecisionWithItsReach = (context, finding, decided, reach) => {
  const decision = createDecision(context.model, context.modelBefore, finding, decided, context.linesFingerprints);
  return [decision, ...listDecisionsOfTheReach(context, decision, reach)];
};

// The reach the decided list gave the check of a finding the designer closes with a reason class, read from the list and never from the model.
const readReachOfTheFinding = (decisionOfFindingCheckMap, finding) => (decisionOfFindingCheckMap.get(createFindingCheckKey(finding, finding.check)) || {}).reach;

// An object that asks for a change of the code is no decision, so only an object with a reason and no closing enters; an object open after the ceiling enters only with the reason that the user or the decided list gave it.
const isADecidingObject = object => isAText(object.reason) && !isAText(object.closedBy) && (!isAText(object.openAfterCeiling) || holdsADecidedReason(object));

// The findings of an item, 1 per check it decides: an object with a check decides that check, also of a combined result, and one without decides every check of the item.
const listFindingsOfTheItem = (run, number, check) => {
  const item = run ? run.items.find(other => other.number === number) : null;
  if (!item) return [];
  return item.findings.flatMap(finding => readChecksOfTheFinding(finding).filter(other => !isAText(check) || other === check).map(other => ({ ...finding, check: other })));
};

const listDecisionsOfTheObjects = context => readList(context.model.decisions.findings)
  .filter(isADecidingObject)
  .flatMap(object => {
    const isOfAShapeRun = Number.isFinite(object.run);
    const run = isOfAShapeRun ? context.readShapeRun(object.run) : context.inputRun;
    const source = isOfAShapeRun ? formatShapeRunSource(object.run, object.number) : formatInputRunSource(object.number);
    const readReach = finding => (isOfAShapeRun ? [] : readReachOfTheFinding(context.decisionOfFindingCheckMap, finding));
    return listFindingsOfTheItem(run, object.number, object.check).flatMap(finding => createDecisionWithItsReach(context, finding, { ...object, plan: context.plan, source }, readReach(finding)));
  });

const listDecisionsOfTheEntries = context => readList(context.entries)
  .filter(entry => isAText(entry.reason))
  .map(entry => ({ ...entry, scale: String(entry.scale).toLowerCase(), file: entry.file || "" }))
  .flatMap(finding => createDecisionWithItsReach(context, finding, { ...finding, plan: context.plan, source: SOURCES.FINDINGS_FILE }, finding.reach));

// A result the input run set apart as decided but changed since, ruled on again by an entry of the round of the run with the lines fingerprint of this run, is a decision of this plan with the lines fingerprint of this run. Where this run gives its abstraction no lines fingerprint, the decision the results folder holds stays, because a decision of this plan with no fingerprint would hold whatever its code becomes or expire on the kind of this plan.
const listDecisionsOfTheRefreshed = context => context.refreshed
  .map(({ finding, decision, round }) => {
    const [refreshedDecision, ...reachDecisions] = createDecisionWithItsReach(context, finding, { ...decision, plan: context.plan, source: formatDecidedListSource(round) }, decision.reach);
    return { decision: refreshedDecision, reachDecisions, replacedKey: createCheckAndNameKey(finding.check, finding.displayNameOfTheDecision || finding.displayName) };
  })
  .filter(({ decision }) => decision.linesFingerprint);

const listKeysOfTheDecision = decision => [decision.displayName, ...readList(decision.formerNames)].map(displayName => createDecisionKey({ ...decision, displayName }));

const isSentToAFix = entry => !isAText(entry.reason) && !entry.toConsider;

const isADirectDecision = decision => !decision.reachOf && !decision.takenFrom;

// A method the change creates: a method marked unchanged or renamed by oldName stands in the current tree, so no decision is taken onto it.
export const isACreatedMethod = method => !isMarkedUnchanged(method) && !isAText(method.oldName);

// Each method of the model with the sources its body takes code from, each the display name of a decided method or of the class that holds the method, with 1 check whose finding is about the moved lines, and its own display name.
export const listMethodsThatTakeCode = model => model.classes.flatMap(theClass => readList(theClass.methods)
  .filter(method => readList(method.takesCodeFrom).length)
  .map(method => ({ theClass, method, displayName: `${theClass.name}${METHOD_MARK}${method.name}`, sources: readList(method.takesCodeFrom) })));

// A source names a class where its display name holds no method mark, so it carries a class-scale decision.
export const isAClassSource = source => isAText(source.displayName) && !source.displayName.includes(METHOD_MARK);

// A class source names the class that holds the created method, by its name or by the name it had before the change, because a decision of another class is not about code the method took.
export const namesTheHoldingClass = (source, theClass) => [theClass.name, readOldTypeName(theClass)].includes(source.displayName);

const isOfTheSourceScale = (decision, source, theClass) => (isAClassSource(source)
  ? decision.scale === CLASS_SCALE && namesTheHoldingClass(source, theClass) && decision.displayName === theClass.name
  : decision.scale === METHOD_SCALE);

// The decisions of the check of 1 source by its planned name or a former name, of its method or of the class that holds the created method, never a decision that was itself taken from another abstraction, so a decision of another check of that abstraction never travels.
export const listDecisionsOfTheSource = (decisions, source, theClass) => decisions.filter(decision => isOfTheSourceScale(decision, source, theClass)
  && !decision.takenFrom
  && decision.check === source.check
  && [decision.displayName, ...readList(decision.formerNames)].includes(source.displayName));

export const holdsALinesFingerprint = decision => isAText(decision.linesFingerprint);

const withoutTheReach = ({ reachOf, ...decision }) => decision;

const createTakenDecision = (model, plan, theClass, decision, onTheCreatedMethod) => ({
  ...decision,
  ...onTheCreatedMethod,
  file: theClass.file,
  plan,
  source: formatTakenCodeSource(decision),
  plannedKind: model.getKindOfClass(theClass),
  takenFrom: decision.displayName,
});

// A created method that takes code from a decided method takes the decision of each named check of that method that holds a lines fingerprint, with that fingerprint, so its result is decided only while its own lines are the lines the person ruled on, and decided but changed since once they differ. It takes no class of its method, so it never decides a class result, and it never decides a finding that no decision holds.
const listMethodDecisionsOfTheTakenCode = (model, plan, decisions) => listMethodsThatTakeCode(model)
  .filter(({ method }) => isACreatedMethod(method))
  .flatMap(({ theClass, displayName, sources }) => sources.filter(source => !isAClassSource(source)).flatMap(source => listDecisionsOfTheSource(decisions, source, theClass)
    .filter(holdsALinesFingerprint)
    .map(decision => createTakenDecision(model, plan, theClass, withoutTheClassOfTheMethod(withoutTheReach(decision)), { displayName, formerNames: [] }))));

// A created method that takes the cause of a class decision of its own class takes that decision onto the class, with the lines fingerprint of the class as the person ruled on it, so it reads decided or decided but changed since exactly as the class decision does and only names the code that moved. It stands beside the class decision it copies, which keeps its relations, and 1 copy stands per key.
const listClassDecisionsOfTheTakenCode = (model, plan, decisions, entries) => {
  const keysSentToAFix = new Set(readList(entries).filter(isSentToAFix).map(entry => createDecisionKey({ ...entry, scale: String(entry.scale).toLowerCase() })));
  const decisionOfKeyMap = new Map();
  for (const { theClass, method, sources } of listMethodsThatTakeCode(model)) {
    if (!isACreatedMethod(method)) continue;
    for (const decision of sources.filter(isAClassSource).flatMap(source => listDecisionsOfTheSource(decisions, source, theClass)).filter(holdsALinesFingerprint)) {
      const key = createDecisionKey(decision);
      if (!keysSentToAFix.has(key) && !decisionOfKeyMap.has(key)) decisionOfKeyMap.set(key, createTakenDecision(model, plan, theClass, withoutTheReach(decision), {}));
    }
  }
  return [...decisionOfKeyMap.values()];
};

// A reach never replaces a ruling, in any order of the list: a decision this plan made on its key by an entry or an object, a decision of an earlier plan the export carries, and a key the same round sends to a fix each keep the key, and of 2 reaches on 1 key the first stands.
const keepTheReachOffTheRulings = (decisions, carried, entries) => {
  const ruledKeys = new Set([
    ...decisions.filter(isADirectDecision).flatMap(listKeysOfTheDecision),
    ...carried.flatMap(listKeysOfTheDecision),
    ...readList(entries).filter(isSentToAFix).map(entry => createDecisionKey({ ...entry, scale: String(entry.scale).toLowerCase() })),
  ]);
  return decisions.filter(decision => {
    if (isADirectDecision(decision)) return true;
    const keys = listKeysOfTheDecision(decision);
    if (keys.some(key => ruledKeys.has(key))) return false;
    for (const key of keys) ruledKeys.add(key);
    return true;
  });
};

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
export const buildDecidedReview = ({ model, modelBefore, plan, inputRun, entries, readShapeRun, baseCommit, planCommit, earlier, linesFingerprints = null, refreshed = [], decisionOfFindingCheckMap = new Map() }) => {
  const context = { model, modelBefore, plan, inputRun, entries, readShapeRun, linesFingerprints, refreshed, decisionOfFindingCheckMap };
  const decisionOfKeyMap = new Map();
  const refreshedDecisions = listDecisionsOfTheRefreshed(context);
  for (const decision of [...listDecisionsOfTheObjects(context), ...listDecisionsOfTheEntries(context), ...refreshedDecisions.flatMap(refresh => [refresh.decision, ...refresh.reachDecisions])]) {
    const key = `${createDecisionKey(decision)}\t${decision.source}`;
    if (!decisionOfKeyMap.has(key)) decisionOfKeyMap.set(key, decision);
  }
  const decisionsOfThePlan = [...decisionOfKeyMap.values()];
  const replacedKeys = new Set(refreshedDecisions.map(refresh => refresh.replacedKey));
  const { carried, dropped } = carryTheEarlierDecisions(earlier, model, new Set(decisionsOfThePlan.filter(isADirectDecision).map(createDecisionKey)), replacedKeys);
  const decisionsBeforeTheTakenCode = keepTheReachOffTheRulings(decisionsOfThePlan, carried, entries);
  const decisionsToTakeCodeFrom = [...carried, ...decisionsBeforeTheTakenCode];
  const decisions = [
    ...keepTheReachOffTheRulings([...decisionsBeforeTheTakenCode, ...listMethodDecisionsOfTheTakenCode(model, plan, decisionsToTakeCodeFrom)], carried, entries),
    ...listClassDecisionsOfTheTakenCode(model, plan, decisionsToTakeCodeFrom, entries),
  ];
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
