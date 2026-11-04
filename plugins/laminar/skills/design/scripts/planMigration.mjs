import fs from "node:fs";
import path from "node:path";
import { readBaseCommit, readDesignModelOrExit, readOptionsOrExit, runOrExitOnTreeStop } from "./command/CommandLine.mjs";
import { readCurrentTree } from "./migration/CurrentTree.mjs";
import { findGroupOrderDefects } from "./migration/GroupOrder.mjs";
import { listMigrationSteps } from "./migration/MigrationSteps.mjs";
import { writeMigrationText } from "./migration/MigrationText.mjs";

const USAGE = "usage: node planMigration.mjs --model <design-model.json> --out <migration.md|migration.json> [--repo <repository root> [--base <commit>]]";

const JSON_SUFFIX = ".json";

const describeCurrentTree = currentTree => (currentTree
  ? `Current tree: read from ${currentTree.describe()}`
  : "Current tree: not read, no --repo given, so each rename and move lists the callers that the model names");

function planMigration() {
  const options = readOptionsOrExit(USAGE, ["model", "out", "repo", "base"], ["model", "out"]);
  const model = readDesignModelOrExit(options.model);
  const repositoryRoot = options.repo ? path.resolve(options.repo) : null;

  const currentTree = repositoryRoot ? runOrExitOnTreeStop(() => readCurrentTree(repositoryRoot, readBaseCommit(options))) : null;
  const steps = runOrExitOnTreeStop(() => listMigrationSteps(model, currentTree));
  const orderDefects = findGroupOrderDefects(model, steps);
  const outPath = path.resolve(options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outPath.endsWith(JSON_SUFFIX) ? `${JSON.stringify(steps, null, 2)}\n` : writeMigrationText(steps, describeCurrentTree(currentTree), orderDefects));
  for (const defect of orderDefects) console.log(`defect\t${defect.code}\t${defect.sentence}`);
  console.log(`RESULT ${JSON.stringify({ migration: outPath, steps: steps.length, groups: new Set(steps.map(step => step.group)).size, defects: orderDefects.length })}`);
  process.exit(orderDefects.length ? 1 : 0);
}

planMigration();
