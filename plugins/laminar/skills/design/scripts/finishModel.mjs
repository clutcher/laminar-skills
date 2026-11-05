import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readOptionsOrExit } from "./command/CommandLine.mjs";

const USAGE = "usage: node finishModel.mjs --model <design-model.json> --results <results folder> [--repo <repository root> [--base <commit>]] [--review <review.md>] [--shape-review <results>/shape-runs/<n>/review.md]... [--rounds <results>/rounds]";

const SHAPE_REVIEW_OPTION = "shape-review";

const SCRIPTS_FOLDER = path.dirname(fileURLToPath(import.meta.url));

const RESULT_PREFIX = "RESULT ";

const DEFECT_PREFIX = "defect\t";

const DEFECT_EXIT_CODE = 1;

const listOptionArguments = (options, names) => names.filter(name => options[name]).flatMap(name => [`--${name}`, options[name]]);

const listShapeReviewArguments = options => options[SHAPE_REVIEW_OPTION].flatMap(reviewPath => [`--${SHAPE_REVIEW_OPTION}`, reviewPath]);

// The 3 scripts of steps 7, 8 and 10 of SKILL.md, in that order, each with the options it takes.
const listFinishSteps = (options, designPath, migrationPath) => [
  { name: "check", script: "checkDesign.mjs", arguments: [...listOptionArguments(options, ["model", "repo", "base", "review"]), ...listShapeReviewArguments(options)] },
  { name: "render", script: "renderDesign.mjs", arguments: [...listOptionArguments(options, ["model", "rounds"]), "--out", designPath] },
  { name: "migration", script: "planMigration.mjs", arguments: [...listOptionArguments(options, ["model", "repo", "base"]), "--out", migrationPath] },
];

// The scripts exit inside their own code, so each runs as its own process, and its output is read whole.
const runFinishStep = step => {
  const run = spawnSync(process.execPath, [path.join(SCRIPTS_FOLDER, step.script), ...step.arguments], { encoding: "utf8" });
  const lines = run.stdout.split("\n");
  const hasDefect = lines.some(line => line.startsWith(DEFECT_PREFIX));
  const exitCode = run.status ?? DEFECT_EXIT_CODE;
  return { ...run, exitCode: exitCode || (hasDefect ? DEFECT_EXIT_CODE : 0), resultLine: lines.find(line => line.startsWith(RESULT_PREFIX)) };
};

const stopAtTheStep = (step, run) => {
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);
  console.log(`stopped\t${step.name}\t${step.script} exited ${run.exitCode}`);
  console.log(`${RESULT_PREFIX}${JSON.stringify({ stopped: step.name, exit: run.exitCode })}`);
  process.exit(run.exitCode);
};

function finishModel() {
  const options = readOptionsOrExit(USAGE, ["model", "repo", "base", "review", "results", "rounds"], ["model", "results"], [SHAPE_REVIEW_OPTION]);
  const resultsFolder = path.resolve(options.results);
  const designPath = path.join(resultsFolder, "design.md");
  const migrationPath = path.join(resultsFolder, "migration.md");

  const steps = listFinishSteps(options, designPath, migrationPath);
  for (const step of steps) {
    const run = runFinishStep(step);
    if (run.exitCode) stopAtTheStep(step, run);
    console.log(`${step.name}\t${run.resultLine}`);
  }
  console.log(`${RESULT_PREFIX}${JSON.stringify({ steps: steps.length, design: designPath, migration: migrationPath })}`);
}

finishModel();
