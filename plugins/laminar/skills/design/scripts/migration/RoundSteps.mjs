import { MIGRATION_STAGES } from "./MigrationSteps.mjs";

const STAGE_ORDER = Object.values(MIGRATION_STAGES);

const FIRST_GROUP = 1;

const WRITER = "writer";

export const CHANGED_CLASS_NOT_IN_MODEL = "changed-class-not-in-model";

const getGroupOfTheClass = theClass => (Number.isFinite(theClass.group) ? theClass.group : FIRST_GROUP);

// A finding sent to a writer becomes 1 step in the migration stage of its kind: tests for a finding on test code, bodies for every other.
const createFindingStep = (model, disposition, round) => {
  const theClass = model.findClass(disposition.displayName);
  return {
    stage: disposition.testCode ? MIGRATION_STAGES.TESTS : MIGRATION_STAGES.BODIES,
    group: disposition.group,
    says: `fixes finding ${disposition.number} of round ${round}: ${disposition.check} on ${disposition.displayName}`,
    files: theClass ? [theClass.file] : [],
  };
};

export const findChangedClassDefects = (model, classNames) => classNames
  .filter(className => !model.findClass(className))
  .map(className => ({ code: CHANGED_CLASS_NOT_IN_MODEL, sentence: `--classes names ${className}, and the model holds no such class` }));

// A round plans only the migration groups that hold a class the designer changed or a finding sent to a writer, with the steps of the changed classes and 1 step per such finding.
export const listRoundSteps = (model, steps, { round, classNames, dispositions }) => {
  const changedClasses = classNames.map(className => model.findClass(className)).filter(Boolean);
  const changedFiles = new Set(changedClasses.map(theClass => theClass.file));
  const writerDispositions = dispositions.filter(disposition => disposition.to === WRITER);
  const plannedGroups = new Set([...changedClasses.map(getGroupOfTheClass), ...writerDispositions.map(disposition => disposition.group)]);

  const changedClassSteps = steps.filter(step => plannedGroups.has(step.group) && step.files.some(file => changedFiles.has(file)));
  const findingSteps = writerDispositions.map(disposition => createFindingStep(model, disposition, round));
  const readRank = step => STAGE_ORDER.indexOf(step.stage);
  const roundSteps = [...changedClassSteps, ...findingSteps]
    .sort((first, second) => first.group - second.group || readRank(first) - readRank(second))
    .map((step, at) => ({ ...step, number: at + 1, existingDefect: Boolean(step.existingDefect) }));
  return { steps: roundSteps, plannedGroups: [...plannedGroups].sort((first, second) => first - second) };
};
