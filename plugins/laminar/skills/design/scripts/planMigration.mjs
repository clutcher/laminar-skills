import fs from "node:fs";
import path from "node:path";
import { readBaseCommit, readDesignModelOrExit, readOptionsOrExit, runOrExitOnTreeStop } from "./command/CommandLine.mjs";
import { readCurrentTree } from "./migration/CurrentTree.mjs";
import { findGroupOrderDefects } from "./migration/GroupOrder.mjs";
import { listMigrationSteps } from "./migration/MigrationSteps.mjs";
import { writeMigrationText } from "./migration/MigrationText.mjs";
import { writeMigrationWorkflowFile } from "./migration/MigrationWorkflowFile.mjs";
import { findChangedClassDefects, listRoundSteps } from "./migration/RoundSteps.mjs";

const USAGE = "usage: node planMigration.mjs --model <design-model.json> --out <migration.md|migration.json> [--repo <repository root> [--base <commit>]] [--round <results>/rounds/<n>] [--classes <display names>]";

const DISPOSITIONS_FILE = "dispositions.json";

// The model the code of the round was written from, so each test the designer changed since then gets its step.
const MODEL_FILE = "design-model.json";

const STOP_EXIT_CODE = 2;

const JSON_SUFFIX = ".json";

const describeCurrentTree = currentTree => (currentTree
  ? `Current tree: read from ${currentTree.describe()}`
  : "Current tree: not read, no --repo given, so each rename and move lists the callers that the model names");

const readRoundDispositionsOrExit = roundFolder => {
  const dispositionsPath = path.join(roundFolder, DISPOSITIONS_FILE);
  try {
    return JSON.parse(fs.readFileSync(dispositionsPath, "utf8"));
  } catch (error) {
    console.error(`round: cannot read ${dispositionsPath}: ${error.message}`);
    process.exit(STOP_EXIT_CODE);
  }
};

const splitNames = text => (text ? text.split(",").map(name => name.trim()).filter(Boolean) : []);

// With --round or --classes, the plan holds only the migration groups of the round, and the head line names them.
const planTheRound = (model, steps, options) => {
  const roundFolder = options.round ? path.resolve(options.round) : null;
  const classNames = splitNames(options.classes);
  const round = roundFolder ? path.basename(roundFolder) : "";
  const modelBeforePath = roundFolder ? path.join(roundFolder, MODEL_FILE) : "";
  const modelBefore = modelBeforePath && fs.existsSync(modelBeforePath) ? readDesignModelOrExit(modelBeforePath) : null;
  const { steps: roundSteps, plannedGroups } = listRoundSteps(model, steps, { round, classNames, dispositions: roundFolder ? readRoundDispositionsOrExit(roundFolder) : [], modelBefore });
  const roundWords = round ? `round ${round}` : "the changed classes";
  return { steps: roundSteps, roundLine: `Round: ${roundWords} plans the migration groups ${plannedGroups.join(", ") || "none"}; every other group is left out`, classDefects: findChangedClassDefects(model, classNames) };
};

function planMigration() {
  const options = readOptionsOrExit(USAGE, ["model", "out", "repo", "base", "round", "classes"], ["model", "out"]);
  const model = readDesignModelOrExit(options.model);
  const repositoryRoot = options.repo ? path.resolve(options.repo) : null;

  const currentTree = repositoryRoot ? runOrExitOnTreeStop(() => readCurrentTree(repositoryRoot, readBaseCommit(options))) : null;
  const allSteps = runOrExitOnTreeStop(() => listMigrationSteps(model, currentTree));
  const isARound = Boolean(options.round || options.classes);
  const { steps, roundLine, classDefects } = isARound ? planTheRound(model, allSteps, options) : { steps: allSteps, roundLine: "", classDefects: [] };
  const orderDefects = findGroupOrderDefects(model, steps);
  const defects = [...classDefects, ...orderDefects];
  const outPath = path.resolve(options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outPath.endsWith(JSON_SUFFIX) ? `${JSON.stringify(steps, null, 2)}\n` : writeMigrationText(steps, describeCurrentTree(currentTree), orderDefects, { line: roundLine, defects: classDefects }));
  const workflowFilePath = writeMigrationWorkflowFile(model, steps, { migrationPath: outPath, repositoryRoot, defectCount: defects.length });
  for (const defect of defects) console.log(`defect\t${defect.code}\t${defect.sentence}`);
  console.log(`RESULT ${JSON.stringify({ migration: outPath, steps: steps.length, groups: new Set(steps.map(step => step.group)).size, defects: defects.length, workflowFile: workflowFilePath })}`);
  process.exit(defects.length ? 1 : 0);
}

planMigration();
