import { estimateCostTotals } from "../../../review/scripts/review/prepare/agents/CostPlan.mjs";
import { readList } from "../model/DesignModel.mjs";
import { getGroupOfTheClass } from "../plan/FindingList.mjs";
import { MIGRATION_STAGES } from "./MigrationSteps.mjs";

export const SELF_CHECK_JUDGES = Object.freeze(["simplicity-decision", "simplicity-method", "simplicity-variable", "correctness-simplicity-test-method"]);

// Fitted on measured self-check runs.
const DECISION_CALLS_PER_NAMED_METHOD = 0.5;

const VARIABLE_CALLS_PER_NAMED_METHOD = 1;

const HELPER_METHOD_CALLS_PER_TEST = 1;

const NO_SCREENS = Object.freeze({ presence: [], ioRules: [] });

// Measured on the self-checks of 9 groups of 4 one-shot runs: the judge, refuter and verifier calls per planned judge call, the 3 helper calls of each group, and the answer round, which runs only where a judge call keeps a finding, as a mean over the groups with planned judge calls. The constants are fixed dollars of the models of those runs, so they do not follow a change of the models in cost-plan.json.
const DOLLARS_PER_PLANNED_JUDGE_CALL = 0.0135;

const HELPER_DOLLARS = 0.1;

const ANSWER_ROUND_DOLLARS = 0.23;

const estimateDollars = judgeCalls => judgeCalls * DOLLARS_PER_PLANNED_JUDGE_CALL + HELPER_DOLLARS + (judgeCalls > 0 ? ANSWER_ROUND_DOLLARS : 0);

const listWrittenFilesOfTheGroup = (steps, group) => new Set(steps
  .filter(step => step.group === group && step.stage !== MIGRATION_STAGES.TESTS)
  .flatMap(step => step.files));

// A class counts where a step of the group writes its file, so a class of an unchanged file, which holds no group, counts nowhere.
const countNamedMethodsOfTheGroup = (model, steps, group) => {
  const writtenFiles = listWrittenFilesOfTheGroup(steps, group);
  return model.classes
    .filter(theClass => getGroupOfTheClass(theClass) === group && writtenFiles.has(theClass.file))
    .reduce((count, theClass) => count + readList(theClass.methods).filter(method => !method.unchanged).length, 0);
};

// The test step that writes a test list says so in its first words, and a step that updates tests says updates.
const WRITES_TESTS_LEAD = "writes the ";

const findGroupThatWritesTheTests = (steps, testFile) => {
  const writeStep = steps.find(step => step.stage === MIGRATION_STAGES.TESTS && step.says.startsWith(WRITES_TESTS_LEAD) && step.files.includes(testFile));
  return writeStep ? writeStep.group : null;
};

// The tests of decisions.tests that the group writes, by the test step that writes each list.
const countTestsOfTheGroup = (model, steps, group) => {
  const tests = model.decisions.tests || {};
  return [...readList(tests.unit), ...readList(tests.integration)]
    .filter(written => findGroupThatWritesTheTests(steps, written.file) === group)
    .reduce((count, written) => count + readList(written.tests).length, 0);
};

const listEstimatedJudgeCalls = callsByJudgeType => Object.entries(callsByJudgeType)
  .flatMap(([judgeType, count]) => Array.from({ length: Math.round(count) }, () => ({ judgeType, checks: [] })));

// The self-check share of 1 migration group before its code exists, derived from the named methods and the tests that the model gives the group, as the shape run derives its variable line.
export const estimateSelfCheckCost = (model, steps, group) => {
  const namedMethods = countNamedMethodsOfTheGroup(model, steps, group);
  const tests = countTestsOfTheGroup(model, steps, group);
  const { upTo } = estimateCostTotals(listEstimatedJudgeCalls({
    "judge-simplicity-method": namedMethods + tests * HELPER_METHOD_CALLS_PER_TEST,
    "judge-simplicity-decision": namedMethods * DECISION_CALLS_PER_NAMED_METHOD,
    "judge-simplicity-variable": namedMethods * VARIABLE_CALLS_PER_NAMED_METHOD,
    "judge-correctness-simplicity-test-method": tests,
  }), NO_SCREENS);
  return { judgeCalls: upTo.judgeCalls, dollars: Number(estimateDollars(upTo.judgeCalls).toFixed(2)) };
};

export const formatSelfCheckCostLine = cost => `Self-check: judge calls about ${cost.judgeCalls} · dollars about $${cost.dollars.toFixed(2)}`;
