import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readDesignModelOrExit, readOptionsOrExit } from "./command/CommandLine.mjs";
import { DecidedListStop, checkDecidedListForm, resolveDecidedList } from "./plan/DecidedList.mjs";
import { listFindingEntries } from "./plan/FindingList.mjs";
import { BASE_COMMIT_FILE, DISPOSITIONS_FILE, FINDINGS_FILE, MODEL_FILE, PLAN_COMMIT_FILE, PLAN_OUTCOMES, copyFileIfPresent, findLastPlan, formatPlanLine, getPlanFolder, listQuestionsThatStopThePlan, writeJson, writeOutcome } from "./plan/PlanFolder.mjs";
import { listRoundDispositions } from "./plan/RoundDispositions.mjs";
import { RoundStop, readJsonOrStop, readRunFolder } from "./round/RunFolder.mjs";

const USAGE = "usage: node finishModel.mjs --model <design-model.json> --results <results folder> [--repo <repository root> [--tree <commit>] [--base <commit>]] [--review <review.md> [--decided <decided list>]] [--shape-review <results>/shape-runs/<n>/review.md]... [--classes <display names>] [--rounds <results>/rounds]";

const SHAPE_REVIEW_OPTION = "shape-review";

const SCRIPTS_FOLDER = path.dirname(fileURLToPath(import.meta.url));

const RESULT_PREFIX = "RESULT ";

const DEFECT_PREFIX = "defect\t";

const NO_STEP_PREFIX = "no step\t";

const DEFECT_EXIT_CODE = 1;

const STOP_EXIT_CODE = 2;

const listOptionArguments = (options, names) => names.filter(name => options[name]).flatMap(name => [`--${name}`, options[name]]);

const listShapeReviewArguments = options => options[SHAPE_REVIEW_OPTION].flatMap(reviewPath => [`--${SHAPE_REVIEW_OPTION}`, reviewPath]);

// A later plan is cut, also where the designer changed no class, so it plans only the groups of its changes, its findings and its stopped writers.
const listCutArguments = (options, plan, resultsFolder) => {
  if (plan === 1) return [];
  const modelBeforePath = path.join(getPlanFolder(resultsFolder, plan - 1), MODEL_FILE);
  return ["--classes", options.classes || "", "--plan", String(plan), ...(fs.existsSync(modelBeforePath) ? ["--before", modelBeforePath] : [])];
};

// The 3 scripts of the finish command, in that order, each with the options it takes.
const listFinishSteps = (options, paths, plan) => [
  { name: "check", script: "checkDesign.mjs", arguments: [...listOptionArguments(options, ["model", "repo", "tree", "base", "review", "decided"]), ...listShapeReviewArguments(options)] },
  { name: "render", script: "renderDesign.mjs", arguments: [...listOptionArguments(options, ["model", "rounds"]), "--out", paths.design] },
  { name: "migration", script: "planMigration.mjs", arguments: [...listOptionArguments(options, ["model", "repo", "tree"]), ...(paths.findings ? ["--findings", paths.findings] : []), ...listCutArguments(options, plan, paths.results), "--out", paths.migration] },
];

// The scripts exit inside their own code, so each runs as its own process, and its output is read whole.
const runFinishStep = step => {
  const run = spawnSync(process.execPath, [path.join(SCRIPTS_FOLDER, step.script), ...step.arguments], { encoding: "utf8" });
  const lines = run.stdout.split("\n");
  const hasDefect = lines.some(line => line.startsWith(DEFECT_PREFIX));
  const exitCode = run.status ?? DEFECT_EXIT_CODE;
  return { ...run, lines, exitCode: exitCode || (hasDefect ? DEFECT_EXIT_CODE : 0), resultLine: lines.find(line => line.startsWith(RESULT_PREFIX)) };
};

const stopAtTheStep = (step, run) => {
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);
  console.log(`stopped\t${step.name}\t${step.script} exited ${run.exitCode}`);
  console.log(`${RESULT_PREFIX}${JSON.stringify({ stopped: step.name, exit: run.exitCode })}`);
  process.exit(run.exitCode);
};

const exitWith = message => {
  console.error(message);
  process.exit(STOP_EXIT_CODE);
};

// The run folder of --review with the decisions of the decided list, read once before the 3 scripts, because findings.json and the dispositions of the round both rest on them.
const readTheRunOrExit = options => {
  if (!options.review) {
    if (options.decided) exitWith(`--decided needs --review, the review.md of the run folder whose findings it decides\n${USAGE}`);
    return null;
  }
  try {
    const run = readRunFolder(path.dirname(path.resolve(options.review)), false);
    const decidedList = options.decided ? checkDecidedListForm(readJsonOrStop(path.resolve(options.decided), "decided")) : [];
    return { run, decisionOfFindingMap: resolveDecidedList(decidedList, run).decisionOfFindingMap };
  } catch (error) {
    if (!(error instanceof DecidedListStop || error instanceof RoundStop)) throw error;
    return exitWith(error.message);
  }
};

const readNoStepKeys = migrationLines => new Set(migrationLines
  .filter(line => line.startsWith(NO_STEP_PREFIX))
  .map(line => line.split("\t"))
  .map(columns => `${columns[1]}\t${columns[2]}`));

// The plan folder keeps the model, the findings and the commits of the plan, the dispositions of the round of its run folder and its outcome, so 2 plans compare by their files.
const writeThePlanFolder = (resultsFolder, plan, model, paths, roundInput) => {
  const planFolder = getPlanFolder(resultsFolder, plan);
  fs.mkdirSync(planFolder, { recursive: true });
  copyFileIfPresent(path.resolve(paths.model), planFolder);
  if (paths.findings) copyFileIfPresent(paths.findings, planFolder);
  for (const commitFile of [BASE_COMMIT_FILE, PLAN_COMMIT_FILE]) copyFileIfPresent(path.join(path.dirname(path.resolve(paths.model)), commitFile), planFolder);
  if (roundInput) writeJson(path.join(planFolder, DISPOSITIONS_FILE), listRoundDispositions(model, roundInput.run, roundInput));
  const questions = listQuestionsThatStopThePlan(model);
  const outcomeWord = questions.length ? PLAN_OUTCOMES.QUESTION : PLAN_OUTCOMES.READY;
  writeOutcome(resultsFolder, plan, { word: outcomeWord, questions });
  return outcomeWord;
};

function finishModel() {
  const options = readOptionsOrExit(USAGE, ["model", "repo", "tree", "base", "review", "decided", "results", "rounds", "classes"], ["model", "results"], [SHAPE_REVIEW_OPTION]);
  const resultsFolder = path.resolve(options.results);
  const model = readDesignModelOrExit(options.model);
  const plan = Math.max(findLastPlan(resultsFolder), 1);
  const runInput = readTheRunOrExit(options);
  const paths = { model: options.model, results: resultsFolder, design: path.join(resultsFolder, "design.md"), migration: path.join(resultsFolder, "migration.md"), findings: runInput ? path.join(resultsFolder, FINDINGS_FILE) : null };
  if (runInput) writeJson(paths.findings, listFindingEntries(model, runInput.run, runInput.decisionOfFindingMap));

  const steps = listFinishSteps(options, paths, plan);
  let migrationLines = [];
  for (const step of steps) {
    const run = runFinishStep(step);
    if (run.exitCode) stopAtTheStep(step, run);
    console.log(`${step.name}\t${run.resultLine}`);
    if (step.name === "migration") migrationLines = run.lines;
  }
  const roundInput = runInput ? { ...runInput, noStepKeys: readNoStepKeys(migrationLines) } : null;
  const outcomeWord = writeThePlanFolder(resultsFolder, plan, model, paths, roundInput);
  console.log(`${RESULT_PREFIX}${JSON.stringify({ steps: steps.length, design: paths.design, migration: paths.migration, plan, outcome: outcomeWord, ...(paths.findings ? { findings: paths.findings } : {}) })}`);
  console.log(formatPlanLine(plan, outcomeWord, resultsFolder));
}

finishModel();
