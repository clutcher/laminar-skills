import { readList } from "../model/DesignModel.mjs";
import { MIGRATION_STAGES } from "./MigrationSteps.mjs";

const STAGE_ORDER = Object.values(MIGRATION_STAGES);

const FIRST_GROUP = 1;

const WRITER = "writer";

// The 2 lists of decisions.tests, each with the key that names what its tests test.
const TEST_LISTS = Object.freeze([{ kind: "unit", testedKey: "class" }, { kind: "integration", testedKey: "entry" }]);

export const CHANGED_CLASS_NOT_IN_MODEL = "changed-class-not-in-model";

const getGroupOfTheClass = theClass => (Number.isFinite(theClass.group) ? theClass.group : FIRST_GROUP);

// The group of a test file is the group of the step of the whole plan that writes its tests, which waits for the production code it tests.
const findGroupOfTheTestFile = (steps, file) => {
  const testStep = steps.find(step => step.stage === MIGRATION_STAGES.TESTS && step.files.includes(file));
  return testStep ? testStep.group : null;
};

// The group of the file of a finding whose display name names no class of the model, such as a variable or a class inside a test file: the group of the class of the model in that file, else the group of the tests of that file.
const findGroupOfTheFile = (model, steps, file) => {
  const classOfTheFile = model.classes.find(theClass => theClass.file === file);
  return classOfTheFile ? getGroupOfTheClass(classOfTheFile) : findGroupOfTheTestFile(steps, file);
};

// A finding sent to a writer becomes 1 step in the migration stage of its kind: tests for a finding on test code, bodies for every other. A finding whose display name names no class of the model names the file of the finding, in the group of that file.
const createFindingStep = (model, steps, disposition, round) => {
  const theClass = model.findClass(disposition.displayName);
  const file = theClass ? theClass.file : disposition.file || "";
  const groupOfTheFile = !theClass && file ? findGroupOfTheFile(model, steps, file) : null;
  return {
    stage: disposition.testCode ? MIGRATION_STAGES.TESTS : MIGRATION_STAGES.BODIES,
    group: groupOfTheFile === null ? disposition.group : groupOfTheFile,
    says: `fixes finding ${disposition.number} of round ${round}: ${disposition.check} on ${disposition.displayName}`,
    files: file ? [file] : [],
  };
};

const listTestObjects = model => TEST_LISTS.flatMap(({ kind, testedKey }) => readList((model.decisions.tests || {})[kind])
  .map(testObject => ({ key: `${kind}:${testObject.file}`, kind, file: testObject.file, testedName: testObject[testedKey], names: readList(testObject.tests) })));

const listNamesMissingFrom = (names, otherNames) => names.filter(name => !otherNames.includes(name));

const describeTheTestChange = (added, removed) => [
  ...(added.length ? [`adds ${added.join(", ")}`] : []),
  ...(removed.length ? [`removes ${removed.join(", ")}`] : []),
].join("; ");

const readGroupOfTheTests = (model, steps, testObject) => {
  const testGroup = findGroupOfTheTestFile(steps, testObject.file);
  if (testGroup !== null) return testGroup;

  const theClass = model.findClass(testObject.testedName);
  return theClass ? getGroupOfTheClass(theClass) : FIRST_GROUP;
};

const createTestChangeStep = (model, steps, round, objectNow, objectBefore) => {
  const namesNow = objectNow ? objectNow.names : [];
  const namesBefore = objectBefore ? objectBefore.names : [];
  const added = listNamesMissingFrom(namesNow, namesBefore);
  const removed = listNamesMissingFrom(namesBefore, namesNow);
  if (!added.length && !removed.length) return [];

  const testObject = objectNow || objectBefore;
  return [{
    stage: MIGRATION_STAGES.TESTS,
    group: readGroupOfTheTests(model, steps, testObject),
    says: `changes the ${testObject.kind} tests of ${testObject.testedName} in round ${round}: ${describeTheTestChange(added, removed)}`,
    files: [testObject.file],
  }];
};

// A round whose model adds, removes or renames a test of decisions.tests gets 1 test step per changed test object, because the steps of the changed classes hold no test; a rename reads as 1 removed and 1 added name.
const listTestChangeSteps = (model, modelBefore, steps, round) => {
  if (!modelBefore) return [];

  const objectBeforeOfKeyMap = new Map(listTestObjects(modelBefore).map(testObject => [testObject.key, testObject]));
  const objectNowOfKeyMap = new Map(listTestObjects(model).map(testObject => [testObject.key, testObject]));
  const keys = [...new Set([...objectNowOfKeyMap.keys(), ...objectBeforeOfKeyMap.keys()])];
  return keys.flatMap(key => createTestChangeStep(model, steps, round, objectNowOfKeyMap.get(key), objectBeforeOfKeyMap.get(key)));
};

export const findChangedClassDefects = (model, classNames) => classNames
  .filter(className => !model.findClass(className))
  .map(className => ({ code: CHANGED_CLASS_NOT_IN_MODEL, sentence: `--classes names ${className}, and the model holds no such class` }));

// A round plans only the migration groups that hold a class the designer changed, a changed test or a finding sent to a writer, with the steps of the changed classes, 1 step per changed test object and 1 step per such finding.
export const listRoundSteps = (model, steps, { round, classNames, dispositions, modelBefore = null }) => {
  const changedClasses = classNames.map(className => model.findClass(className)).filter(Boolean);
  const changedFiles = new Set(changedClasses.map(theClass => theClass.file));
  const findingSteps = dispositions.filter(disposition => disposition.to === WRITER).map(disposition => createFindingStep(model, steps, disposition, round));
  const testChangeSteps = listTestChangeSteps(model, modelBefore, steps, round);
  const plannedGroups = new Set([...changedClasses.map(getGroupOfTheClass), ...findingSteps.map(step => step.group), ...testChangeSteps.map(step => step.group)]);

  const changedClassSteps = steps.filter(step => plannedGroups.has(step.group) && step.files.some(file => changedFiles.has(file)));
  const readRank = step => STAGE_ORDER.indexOf(step.stage);
  const roundSteps = [...changedClassSteps, ...testChangeSteps, ...findingSteps]
    .sort((first, second) => first.group - second.group || readRank(first) - readRank(second))
    .map((step, at) => ({ ...step, number: at + 1, existingDefect: Boolean(step.existingDefect) }));
  return { steps: roundSteps, plannedGroups: [...plannedGroups].sort((first, second) => first - second) };
};
