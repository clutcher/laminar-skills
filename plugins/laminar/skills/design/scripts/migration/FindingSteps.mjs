import { KINDS, isAText, isMarkedUnchanged, readList } from "../model/DesignModel.mjs";
import { findClassOfTheFinding, readFindingNamePieces } from "../plan/FindingList.mjs";
import { MIGRATION_STAGES } from "./MigrationSteps.mjs";

export const FINDING_DEFECT_CODES = Object.freeze({ FINDING_WITHOUT_GROUP: "finding-without-group", FINDING_ON_UNCHANGED_METHOD: "finding-on-unchanged-method" });

const METHOD_MARK = "#";

// The group of a test file is the group of the step of the whole plan that writes its tests, which waits for the production code it tests.
export const findGroupOfTheTestFile = (steps, file) => {
  const testStep = steps.find(step => step.stage === MIGRATION_STAGES.TESTS && step.files.includes(file));
  return testStep ? testStep.group : null;
};

// The method of the model that the finding names, under its name in the model, so a method the model renames by oldName is found by its old name too.
const findMethodOfTheFinding = (theClass, methodName) => {
  if (!theClass || !methodName) return null;
  const methods = readList(theClass.methods);
  return methods.find(method => method.name === methodName) || methods.find(method => method.oldName === methodName) || null;
};

const findRemovedName = (model, theClass, entry, pieces) => {
  const child = model.findChildOfTheFile(theClass ? theClass.file : entry.file);
  if (child && child.kind === KINDS.REMOVED) return theClass ? model.getClassDisplayName(theClass) : entry.file;
  if (!theClass) return child && readList(child.removedClasses).includes(pieces.className) ? pieces.className : "";

  const memberName = pieces.methodName || pieces.fieldName;
  return memberName && readList(theClass.removed).includes(memberName) ? `${model.getClassDisplayName(theClass)}${METHOD_MARK}${memberName}` : "";
};

// The display name of the finding with the names of the model, so a step on a renamed class or method names the name the writer writes.
const writeNameInTheModel = (model, theClass, method, entry, pieces) => {
  if (!theClass) return entry.displayName;

  const memberName = method ? method.name : pieces.fieldName || pieces.methodName;
  const enclosing = memberName ? `${model.getClassDisplayName(theClass)}${METHOD_MARK}${memberName}` : model.getClassDisplayName(theClass);
  return pieces.variableName ? `${pieces.variableName} in ${enclosing}` : enclosing;
};

const createNoStepLine = (entry, why) => ({ number: entry.number, check: entry.check, displayName: entry.displayName, why });

const createFindingDefect = (code, entry, sentence) => ({ code, sentence: `finding ${entry.number}: ${entry.check} on ${entry.displayName} ${sentence}` });

// 1 finding step per entry of findings.json that holds no reason class and names an abstraction the model keeps; every other entry gets a no-step line or a defect, so no finding is dropped in silence.
export const listFindingSteps = (model, steps, entries) => {
  const findingSteps = [];
  const noStepLines = [];
  const defects = [];
  for (const entry of entries) {
    if (isAText(entry.reason)) {
      noStepLines.push(createNoStepLine(entry, `decided by ${entry.decidedBy}: ${entry.reason}`));
      continue;
    }
    const pieces = readFindingNamePieces(entry.displayName, entry.scale);
    const theClass = findClassOfTheFinding(model, entry.displayName, entry.scale, entry.file);
    const removedName = findRemovedName(model, theClass, entry, pieces);
    if (removedName) {
      noStepLines.push(createNoStepLine(entry, `the model removes ${removedName}`));
      continue;
    }
    const method = findMethodOfTheFinding(theClass, pieces.methodName);
    if (method && isMarkedUnchanged(method)) {
      defects.push(createFindingDefect(FINDING_DEFECT_CODES.FINDING_ON_UNCHANGED_METHOD, entry, `names ${model.getMethodDisplayName(theClass, method)}, which the model marks unchanged, so its step would change a method the model keeps as it is`));
      continue;
    }
    const group = Number.isFinite(entry.group) ? entry.group : findGroupOfTheTestFile(steps, entry.file);
    if (group === null) {
      defects.push(createFindingDefect(FINDING_DEFECT_CODES.FINDING_WITHOUT_GROUP, entry, `stands in ${entry.file || "no file"}, which no class of the model and no test step of the plan holds; add its class to the model as modified`));
      continue;
    }
    findingSteps.push({
      stage: entry.testCode ? MIGRATION_STAGES.TESTS : MIGRATION_STAGES.BODIES,
      group,
      says: `fixes finding ${entry.number}: ${entry.check} on ${writeNameInTheModel(model, theClass, method, entry, pieces)}`,
      files: [theClass ? theClass.file : entry.file].filter(Boolean),
      existingDefect: false,
    });
  }
  return { findingSteps, noStepLines, defects };
};
