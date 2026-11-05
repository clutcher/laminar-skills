import { isAText } from "../model/DesignModel.mjs";
import { listNamedClasses } from "./GroupOrder.mjs";

const FOLDER_END = "/";

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

// A group waits for each earlier group it touches, because it builds on the code that group writes; groups that touch no earlier group can be written side by side.
export const listMigrationGroups = (model, steps) => {
  const numbers = [...new Set(steps.map(step => step.group))].sort((first, second) => first - second);
  const groups = numbers.map(number => {
    const groupSteps = steps.filter(step => step.group === number);
    const files = listFilesOfTheSteps(groupSteps);
    return { number, steps: groupSteps.map(step => step.number), files, namedFiles: listFilesOfTheNamedClasses(model, files) };
  });
  return groups.map((group, at) => ({
    group: group.number,
    steps: group.steps,
    dependsOn: groups.slice(0, at).filter(earlierGroup => isTouching(group, earlierGroup)).map(earlierGroup => earlierGroup.number),
  }));
};
