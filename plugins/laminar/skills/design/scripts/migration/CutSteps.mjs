import { readList } from "../model/DesignModel.mjs";
import { getGroupOfTheClass } from "../plan/FindingList.mjs";
import { readGroupOfTheStop } from "../plan/StopList.mjs";
import { findGroupOfTheTestFile } from "./FindingSteps.mjs";
import { MIGRATION_STAGES } from "./MigrationSteps.mjs";

const STAGE_ORDER = Object.values(MIGRATION_STAGES);

const FIRST_GROUP = 1;

// The 2 lists of decisions.tests, each with the key that names what its tests test.
const TEST_LISTS = Object.freeze([{ kind: "unit", testedKey: "class" }, { kind: "integration", testedKey: "entry" }]);

export const CHANGED_CLASS_NOT_IN_MODEL = "changed-class-not-in-model";

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

const createTestChangeStep = (model, steps, objectNow, objectBefore) => {
  const namesNow = objectNow ? objectNow.names : [];
  const namesBefore = objectBefore ? objectBefore.names : [];
  const added = listNamesMissingFrom(namesNow, namesBefore);
  const removed = listNamesMissingFrom(namesBefore, namesNow);
  if (!added.length && !removed.length) return [];

  const testObject = objectNow || objectBefore;
  return [{
    stage: MIGRATION_STAGES.TESTS,
    group: readGroupOfTheTests(model, steps, testObject),
    says: `changes the ${testObject.kind} tests of ${testObject.testedName}: ${describeTheTestChange(added, removed)}`,
    files: [testObject.file],
    existingDefect: false,
  }];
};

// A plan whose model adds, removes or renames a test of decisions.tests against the model of the plan before gets 1 test step per changed test object, because the steps of the changed classes hold no test; a rename reads as 1 removed and 1 added name.
const listTestChangeSteps = (model, modelBefore, steps) => {
  if (!modelBefore) return [];

  const objectBeforeOfKeyMap = new Map(listTestObjects(modelBefore).map(testObject => [testObject.key, testObject]));
  const objectNowOfKeyMap = new Map(listTestObjects(model).map(testObject => [testObject.key, testObject]));
  const keys = [...new Set([...objectNowOfKeyMap.keys(), ...objectBeforeOfKeyMap.keys()])];
  return keys.flatMap(key => createTestChangeStep(model, steps, objectNowOfKeyMap.get(key), objectBeforeOfKeyMap.get(key)));
};

export const findChangedClassDefects = (model, classNames) => classNames
  .filter(className => !model.findClass(className))
  .map(className => ({ code: CHANGED_CLASS_NOT_IN_MODEL, sentence: `--classes names ${className}, and the model holds no such class` }));

// The groups whose writer stopped in the plan before, by the group of each stop, else by the class of the abstraction it names, so the next writer of the group goes on from its left files.
export const listStoppedGroups = (model, plan) => {
  if (!Number.isInteger(plan)) return [];
  return readList(model.decisions.stops)
    .filter(stop => (stop.plan ?? stop.round) === plan - 1)
    .map(stop => readGroupOfTheStop(model, stop))
    .filter(Number.isInteger);
};

export const sortAndNumberTheSteps = steps => {
  const readRank = step => STAGE_ORDER.indexOf(step.stage);
  return [...steps]
    .sort((first, second) => first.group - second.group || readRank(first) - readRank(second))
    .map(({ testedFiles, ...step }, at) => ({ ...step, number: at + 1, existingDefect: Boolean(step.existingDefect) }));
};

// A step belongs to a changed class where it edits its file, or where it updates the tests of that class, whose files are test files.
const isAStepOfTheFiles = (step, files) => step.files.some(file => files.has(file)) || (step.testedFiles || []).some(file => files.has(file));

// A cut plan holds only the migration groups with a class the designer changed, a changed test, a finding step or a stopped writer: the steps of the changed classes with the test steps of their changed signatures, every step of a stopped group, 1 step per changed test object and the finding steps. Each group keeps its number.
export const listCutSteps = (model, steps, { classNames, findingSteps, stoppedGroups, modelBefore = null }) => {
  const changedClasses = classNames.map(className => model.findClass(className)).filter(Boolean);
  const changedFiles = new Set(changedClasses.map(theClass => theClass.file));
  const testChangeSteps = listTestChangeSteps(model, modelBefore, steps);
  const stoppedGroupSet = new Set(stoppedGroups);
  const plannedGroups = new Set([...changedClasses.map(getGroupOfTheClass), ...findingSteps.map(step => step.group), ...testChangeSteps.map(step => step.group), ...stoppedGroups]);

  const keptSteps = steps.filter(step => plannedGroups.has(step.group) && (stoppedGroupSet.has(step.group) || isAStepOfTheFiles(step, changedFiles)));
  return {
    steps: sortAndNumberTheSteps([...keptSteps, ...testChangeSteps, ...findingSteps]),
    plannedGroups: [...plannedGroups].sort((first, second) => first - second),
  };
};
