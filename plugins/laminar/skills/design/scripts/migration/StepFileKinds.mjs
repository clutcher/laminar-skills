import { KINDS, getFileOfTheChild, isAText, readList } from "../model/DesignModel.mjs";
import { isATestFile } from "../model/SourceLanguages.mjs";
import { DEFECT_CODES, createDefect } from "../check/DesignDefect.mjs";
import { listTestChangesAgainstThePlanBefore } from "./CutSteps.mjs";

const MIGRATION_PATH = "migration";

const isMarkedUnchanged = (model, file) => model.findChildOfTheFile(file)?.kind === KINDS.UNCHANGED;

const listRemovedTests = model => readList((model.decisions.tests || {}).removed)
  .map((removedTest, index) => ({ removedTest, path: `decisions.tests.removed[${index}]` }))
  .filter(({ removedTest }) => isAText(removedTest.file));

// A removed test changes its file, so the file must be listed as modified: a file the model marks unchanged, or one it does not list, is changed with no model of the change.
const findRemovedTestDefects = model => listRemovedTests(model).flatMap(({ removedTest, path }) => {
  if (isMarkedUnchanged(model, removedTest.file)) return [createDefect(DEFECT_CODES.STEP_ON_UNCHANGED_FILE, path, `the removed test ${removedTest.test} is in ${removedTest.file}, which the model marks unchanged; list the file as modified`)];
  if (model.findChildOfTheFile(removedTest.file)) return [];
  return [createDefect(DEFECT_CODES.REMOVED_TEST_FILE_UNLISTED, path, `the removed test ${removedTest.test} is in ${removedTest.file}, which the model does not list; list the file as modified`)];
});

// A test step that removes names of decisions.tests against the model of the plan before also changes its file, so a file the model does not list is changed with no model of the change; a model rebuilt from the tree that drops a test object reads the same way, so the fix names both.
const findPlanBeforeRemovalDefects = (model, modelBefore) => listTestChangesAgainstThePlanBefore(model, modelBefore)
  .filter(({ testObject, removed }) => removed.length && !model.findChildOfTheFile(testObject.file))
  .map(({ testObject, removed }) => createDefect(DEFECT_CODES.REMOVED_TEST_FILE_UNLISTED, MIGRATION_PATH, `the test step of ${testObject.testedName} removes ${removed.join(", ")} from ${testObject.file} against the model of the plan before, and the model does not list that file; list the file as modified, or put the tests back in decisions.tests.${testObject.kind} where the change keeps them`));

// A file of a removed test is reported by its removal, so a step on that file gets no second line with the same fix.
const findUnchangedFileStepDefects = (model, steps) => {
  const removedTestFiles = new Set(listRemovedTests(model).map(({ removedTest }) => removedTest.file));
  return steps.flatMap(step => {
    const unchangedFiles = [...new Set(step.files)].filter(file => isMarkedUnchanged(model, file) && !removedTestFiles.has(file));
    if (!unchangedFiles.length) return [];
    return [createDefect(DEFECT_CODES.STEP_ON_UNCHANGED_FILE, MIGRATION_PATH, `step ${step.number} of migration group ${step.group} changes ${unchangedFiles.join(", ")}, which the model marks unchanged; list each such file as modified`)];
  });
};

// The paths the children of the model name: each child file or folder and each oldPath, so the old file of a move and a file under a folder child count as listed.
const listChildPaths = model => model.folders.flatMap(folder => readList(folder.children).flatMap(child => [getFileOfTheChild(folder, child), child.oldPath]))
  .filter(isAText)
  .map(childPath => childPath.replace(/\/+$/, ""));

const isListedByAChild = (childPaths, file) => childPaths.some(childPath => file === childPath || file.startsWith(`${childPath}/`));

// A test file stays outside, because the model states its tests under decisions.tests and lists a test file as a child only where it chooses.
const findUnlistedFileStepDefects = (model, steps) => {
  const childPaths = listChildPaths(model);
  return steps.flatMap(step => {
    const unlistedFiles = [...new Set(step.files)].filter(file => !file.endsWith("/") && !isATestFile(file) && !isListedByAChild(childPaths, file));
    if (!unlistedFiles.length) return [];
    return [createDefect(DEFECT_CODES.STEP_ON_UNLISTED_FILE, MIGRATION_PATH, `step ${step.number} of migration group ${step.group} changes ${unlistedFiles.join(", ")}, which the model does not list; list each such file as modified`)];
  });
};

// A step that changes a file the model keeps or a production file it does not list, or a removed test on a file the model does not list, from decisions.tests.removed or from the diff against the model of the plan before, changes code that the design never shows, so a writer changes it with no model and the design check passes it.
export const findStepFileKindDefects = (model, steps, modelBefore = null) => [...findRemovedTestDefects(model), ...findPlanBeforeRemovalDefects(model, modelBefore), ...findUnchangedFileStepDefects(model, steps), ...findUnlistedFileStepDefects(model, steps)];
