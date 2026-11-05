import fs from "node:fs";
import path from "node:path";
import { readDesignModelOrExit, readOptionsOrExit, readTreeCommit, runOrExitOnTreeStop } from "./command/CommandLine.mjs";
import { readCurrentTree } from "./migration/CurrentTree.mjs";
import { findChangedClassDefects, listCutSteps, listStoppedGroups, sortAndNumberTheSteps } from "./migration/CutSteps.mjs";
import { listFindingSteps } from "./migration/FindingSteps.mjs";
import { findGroupOrderDefects } from "./migration/GroupOrder.mjs";
import { listMigrationSteps } from "./migration/MigrationSteps.mjs";
import { writeMigrationText } from "./migration/MigrationText.mjs";
import { writeMigrationWorkflowFile } from "./migration/MigrationWorkflowFile.mjs";

const USAGE = "usage: node planMigration.mjs --model <design-model.json> --out <migration.md|migration.json> [--repo <repository root> [--tree <commit>]] [--findings <findings.json>] [--classes <display names>] [--plan <n>] [--before <design-model.json of the plan before>]";

const STOP_EXIT_CODE = 2;

const JSON_SUFFIX = ".json";

const PLAN_NUMBER = /^[1-9]\d*$/;

const exitWith = message => {
  console.error(message);
  process.exit(STOP_EXIT_CODE);
};

const describeCurrentTree = currentTree => (currentTree
  ? `Current tree: read from ${currentTree.describe()}`
  : "Current tree: not read, no --repo given, so each rename and move lists the callers that the model names");

const readFindingEntriesOrExit = findingsPath => {
  if (!findingsPath) return [];
  let given;
  try {
    given = JSON.parse(fs.readFileSync(path.resolve(findingsPath), "utf8"));
  } catch (error) {
    return exitWith(`findings: cannot read ${findingsPath}: ${error.message}`);
  }
  if (!Array.isArray(given)) exitWith(`findings: ${findingsPath} holds no JSON list`);
  return given;
};

const readPlanNumberOrExit = text => {
  if (text === undefined) return null;
  if (!PLAN_NUMBER.test(text)) exitWith(`--plan takes a whole number above 0, and got ${text}`);
  return Number(text);
};

const splitNames = text => (text ? text.split(",").map(name => name.trim()).filter(Boolean) : []);

// A later plan is cut by --classes, also an empty one: it holds only the groups of the changed classes, the finding steps and the stopped writers, and the head line names them.
const cutThePlan = (model, allSteps, findingSteps, options) => {
  const classNames = splitNames(options.classes);
  const modelBefore = options.before ? readDesignModelOrExit(options.before) : null;
  const stoppedGroups = listStoppedGroups(model, readPlanNumberOrExit(options.plan));
  const { steps, plannedGroups } = listCutSteps(model, allSteps, { classNames, findingSteps, stoppedGroups, modelBefore });
  return { steps, cutLine: `Planned groups: ${plannedGroups.join(", ") || "none"}; every other group is left out`, classDefects: findChangedClassDefects(model, classNames) };
};

function planMigration() {
  const options = readOptionsOrExit(USAGE, ["model", "out", "repo", "tree", "findings", "classes", "plan", "before"], ["model", "out"]);
  const model = readDesignModelOrExit(options.model);
  const repositoryRoot = options.repo ? path.resolve(options.repo) : null;
  const entries = readFindingEntriesOrExit(options.findings);

  const currentTree = repositoryRoot ? runOrExitOnTreeStop(() => readCurrentTree(repositoryRoot, readTreeCommit(options))) : null;
  const allSteps = runOrExitOnTreeStop(() => listMigrationSteps(model, currentTree));
  const { findingSteps, noStepLines, defects: findingDefects } = listFindingSteps(model, allSteps, entries);
  const isCut = options.classes !== undefined;
  const { steps, cutLine, classDefects } = isCut ? cutThePlan(model, allSteps, findingSteps, options) : { steps: sortAndNumberTheSteps([...allSteps, ...findingSteps]), cutLine: "", classDefects: [] };
  const orderDefects = findGroupOrderDefects(model, steps);
  const planDefects = [...classDefects, ...findingDefects];
  const defects = [...planDefects, ...orderDefects];
  const outPath = path.resolve(options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outPath.endsWith(JSON_SUFFIX) ? `${JSON.stringify(steps, null, 2)}\n` : writeMigrationText(steps, describeCurrentTree(currentTree), orderDefects, { line: cutLine, defects: planDefects }, noStepLines));
  const workflowFilePath = writeMigrationWorkflowFile(model, steps, { migrationPath: outPath, repositoryRoot, defectCount: defects.length });
  for (const defect of defects) console.log(`defect\t${defect.code}\t${defect.sentence}`);
  for (const line of noStepLines) console.log(["no step", line.number, line.check, line.displayName, line.why].join("\t"));
  console.log(`RESULT ${JSON.stringify({ migration: outPath, steps: steps.length, groups: new Set(steps.map(step => step.group)).size, defects: defects.length, findingSteps: findingSteps.length, noSteps: noStepLines.length, workflowFile: workflowFilePath })}`);
  process.exit(defects.length ? 1 : 0);
}

planMigration();
