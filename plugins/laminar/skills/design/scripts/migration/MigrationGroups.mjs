import { isAText } from "../model/DesignModel.mjs";
import { listNamedClasses } from "./GroupOrder.mjs";
import { MIGRATION_STAGES } from "./MigrationSteps.mjs";

const FOLDER_END = "/";

const FIRST_GROUP = 1;

const isAFolder = file => file.endsWith(FOLDER_END);

const listFilesOfTheSteps = steps => new Set(steps.flatMap(step => step.files));

const listFilesOfTheNamedClasses = (model, files) => new Set(model.classes
  .filter(theClass => files.has(theClass.file))
  .flatMap(theClass => listNamedClasses(model, theClass))
  .map(namedClass => namedClass.file)
  .filter(isAText));

const holdsAFileOf = (files, otherFiles) => [...files].some(file => otherFiles.has(file)
  || [...otherFiles].some(otherFile => isAFolder(otherFile) && file.startsWith(otherFile)));

// 2 groups touch where a step of each lists the same file or a file under a folder the other lists, or where a class of one names a class of the other.
const isTouching = (group, otherGroup) => holdsAFileOf(group.files, otherGroup.files) || holdsAFileOf(otherGroup.files, group.files)
  || holdsAFileOf(group.namedFiles, otherGroup.files) || holdsAFileOf(otherGroup.namedFiles, group.files);

// The first class of the model in the group, which names the group where its writer gives no stop of its own; a group with no class, such as a group of tests, takes none.
const findFirstClassOfTheGroup = (model, number) => {
  const theClass = model.classes.find(other => (Number.isFinite(other.group) ? other.group : FIRST_GROUP) === number);
  return theClass ? model.getClassDisplayName(theClass) : null;
};

// A group waits for each earlier group it touches, because it builds on the code that group writes; groups that touch no earlier group can be written side by side.
// The files of a group and of its test steps let the build after the last group give each failing file back to the group whose step lists it.
export const listMigrationGroups = (model, steps) => {
  const numbers = [...new Set(steps.map(step => step.group))].sort((first, second) => first - second);
  const groups = numbers.map(number => {
    const groupSteps = steps.filter(step => step.group === number);
    const files = listFilesOfTheSteps(groupSteps);
    const testGroupSteps = groupSteps.filter(step => step.stage === MIGRATION_STAGES.TESTS);
    return {
      number,
      steps: groupSteps.map(step => step.number),
      testSteps: testGroupSteps.map(step => step.number),
      files,
      testFiles: listFilesOfTheSteps(testGroupSteps),
      namedFiles: listFilesOfTheNamedClasses(model, files),
    };
  });
  return groups.map((group, at) => ({
    group: group.number,
    firstClass: findFirstClassOfTheGroup(model, group.number),
    steps: group.steps,
    testSteps: group.testSteps,
    dependsOn: groups.slice(0, at).filter(earlierGroup => isTouching(group, earlierGroup)).map(earlierGroup => earlierGroup.number),
    files: [...group.files],
    testFiles: [...group.testFiles],
  }));
};
