import { KINDS, isAText, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createDefect } from "../check/DesignDefect.mjs";

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

// A file of a removed test is reported by its removal, so a step on that file gets no second line with the same fix.
const findUnchangedFileStepDefects = (model, steps) => {
  const removedTestFiles = new Set(listRemovedTests(model).map(({ removedTest }) => removedTest.file));
  return steps.flatMap(step => {
    const unchangedFiles = [...new Set(step.files)].filter(file => isMarkedUnchanged(model, file) && !removedTestFiles.has(file));
    if (!unchangedFiles.length) return [];
    return [createDefect(DEFECT_CODES.STEP_ON_UNCHANGED_FILE, MIGRATION_PATH, `step ${step.number} of migration group ${step.group} changes ${unchangedFiles.join(", ")}, which the model marks unchanged; list each such file as modified`)];
  });
};

// A step that changes a file the model keeps, or a removed test on a file the model does not list, changes code that the design never shows, so a writer changes it with no model and the design check passes it.
export const findStepFileKindDefects = (model, steps) => [...findRemovedTestDefects(model), ...findUnchangedFileStepDefects(model, steps)];
