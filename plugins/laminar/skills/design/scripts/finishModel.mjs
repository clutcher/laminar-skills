import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { listConsiderations } from "./check/AutonomousReasons.mjs";
import { readNamedReviewItems } from "./check/ReviewItems.mjs";
import { isAText } from "./model/DesignModel.mjs";
import { readDesignModelOrExit, readOptionsOrExit } from "./command/CommandLine.mjs";
import { carryTheFixedFindings, listUnfinishedGroupsOfThePlanBefore } from "./plan/FixedFindings.mjs";
import { DecidedListStop, checkDecidedListForm, resolveDecidedList } from "./plan/DecidedList.mjs";
import { listFindingEntries } from "./plan/FindingList.mjs";
import { BASE_COMMIT_FILE, DISPOSITIONS_FILE, FINDINGS_FILE, MODEL_FILE, PLAN_COMMIT_FILE, PLAN_OUTCOMES, copyFileIfPresent, findLastPlan, formatPlanLine, getPlanFolder, listQuestionsThatStopThePlan, writeJson, writeOutcome } from "./plan/PlanFolder.mjs";
import { listRoundDispositions } from "./plan/RoundDispositions.mjs";
import { RoundStop, readJsonOrStop, readRunFolder } from "./round/RunFolder.mjs";

const USAGE = "usage: node finishModel.mjs --model <design-model.json> --results <results folder> [--repo <repository root> [--tree <commit>] [--base <commit>]] [--review <review.md> [--decided <decided list>]] [--shape-review <results>/shape-runs/<n>/review.md]... [--classes <display names>] [--rounds <results>/rounds] [--autonomous]";

const SHAPE_REVIEW_OPTION = "shape-review";

const AUTONOMOUS_SWITCH = "autonomous";

const MIGRATION_WORKFLOW_FILE = "migration.workflow.js";

const SCRIPTS_FOLDER = path.dirname(fileURLToPath(import.meta.url));

const RESULT_PREFIX = "RESULT ";

const DEFECT_PREFIX = "defect\t";

const NO_STEP_PREFIX = "no step\t";

const DEFECT_EXIT_CODE = 1;

const STOP_EXIT_CODE = 2;

const listOptionArguments = (options, names) => names.filter(name => options[name]).flatMap(name => [`--${name}`, options[name]]);

const listShapeReviewArguments = options => options[SHAPE_REVIEW_OPTION].flatMap(reviewPath => [`--${SHAPE_REVIEW_OPTION}`, reviewPath]);

// A later plan is cut, also where the designer changed no class, so it plans only the groups of its changes, its findings, its stopped writers and the groups that waited for them.
const listCutArguments = (options, plan, paths) => {
  if (plan === 1) return [];
  const modelBeforePath = path.join(getPlanFolder(paths.results, plan - 1), MODEL_FILE);
  const unfinished = paths.unfinishedGroups.length ? ["--unfinished", paths.unfinishedGroups.join(",")] : [];
  return ["--classes", options.classes || "", "--plan", String(plan), ...unfinished, ...(fs.existsSync(modelBeforePath) ? ["--before", modelBeforePath] : [])];
};

// The 3 scripts of the finish command, in that order, each with the options it takes.
const listFinishSteps = (options, paths, plan) => [
  { name: "check", script: "checkDesign.mjs", arguments: [...listOptionArguments(options, ["model", "repo", "tree", "base", "review", "decided"]), ...listShapeReviewArguments(options), ...(options[AUTONOMOUS_SWITCH] ? [`--${AUTONOMOUS_SWITCH}`] : [])] },
  { name: "render", script: "renderDesign.mjs", arguments: [...listOptionArguments(options, ["model", "rounds", "review"]), ...listShapeReviewArguments(options), "--out", paths.design] },
  { name: "migration", script: "planMigration.mjs", arguments: [...listOptionArguments(options, ["model", "repo", "tree"]), ...(paths.findings ? ["--findings", paths.findings] : []), ...listCutArguments(options, plan, paths), "--out", paths.migration] },
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

// The first finding of the run on 1 item, and on its check where the object names one.
const findFindingOfTheItem = (runInput, number, check) => {
  const item = runInput ? runInput.run.items.find(other => other.number === number) : null;
  if (!item) return null;
  return item.findings.find(finding => !check || finding.check === check) || null;
};

// An entry of findings.json on an item to consider at the method or variable scale gets no step and no object of decisions.findings, so the plan passes it on with the summary of its item in review.md.
const listConsiderationsOfTheEntries = (entries, reviewText) => {
  const summaryOfItemMap = new Map((reviewText === null ? [] : readNamedReviewItems(reviewText)).map(item => [item.number, item.summary || ""]));
  const considerationOfKeyMap = new Map(entries
    .filter(entry => entry.toConsider && !isAText(entry.reason))
    .map(entry => [`${entry.number}\t${entry.check}`, { number: entry.number, displayName: entry.displayName, check: entry.check, says: summaryOfItemMap.get(entry.number) || "" }]));
  return [...considerationOfKeyMap.values()];
};

const readTextIfGiven = textPath => (textPath ? fs.readFileSync(path.resolve(textPath), "utf8") : null);

// The shape runs of --shape-review, each by the number of its folder, as the design check reads them.
const readShapeReviews = options => options[SHAPE_REVIEW_OPTION].map(reviewPath => ({ run: Number(path.basename(path.dirname(path.resolve(reviewPath)))), text: readTextIfGiven(reviewPath) }));

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
  copyFileIfPresent(path.join(paths.results, MIGRATION_WORKFLOW_FILE), planFolder);
  if (roundInput) writeJson(path.join(planFolder, DISPOSITIONS_FILE), listRoundDispositions(model, roundInput.run, roundInput));
  const questions = listQuestionsThatStopThePlan(model);
  const outcomeWord = questions.length ? PLAN_OUTCOMES.QUESTION : PLAN_OUTCOMES.READY;
  writeOutcome(resultsFolder, plan, { word: outcomeWord, questions, considerations: paths.considerations });
  return outcomeWord;
};

function finishModel() {
  const options = readOptionsOrExit(USAGE, ["model", "repo", "tree", "base", "review", "decided", "results", "rounds", "classes"], ["model", "results"], [SHAPE_REVIEW_OPTION], [AUTONOMOUS_SWITCH]);
  const resultsFolder = path.resolve(options.results);
  const model = readDesignModelOrExit(options.model);
  const plan = Math.max(findLastPlan(resultsFolder), 1);
  const runInput = readTheRunOrExit(options);
  // The groups that waited on a stopped group are planned again also with no run folder, because the writer workflow plans only the groups of the migration.
  const unfinishedGroups = listUnfinishedGroupsOfThePlanBefore(model, resultsFolder, plan);
  const entries = runInput ? carryTheFixedFindings(model, resultsFolder, plan, listFindingEntries(model, runInput.run, runInput.decisionOfFindingMap)) : [];
  // An item to consider left as a question to the author is passed on as a consideration, never as a question of the plan, because items to consider on existing code stand in most changes.
  const reviewText = readTextIfGiven(options.review);
  const considerations = [
    ...listConsiderations(model, reviewText, readShapeReviews(options), (number, check) => findFindingOfTheItem(runInput, number, check)),
    ...listConsiderationsOfTheEntries(entries, reviewText),
  ];
  const paths = { model: options.model, results: resultsFolder, design: path.join(resultsFolder, "design.md"), migration: path.join(resultsFolder, "migration.md"), findings: runInput ? path.join(resultsFolder, FINDINGS_FILE) : null, unfinishedGroups, considerations };
  if (runInput) writeJson(paths.findings, entries);

  const steps = listFinishSteps(options, paths, plan);
  let migrationLines = [];
  for (const step of steps) {
    const run = runFinishStep(step);
    if (run.exitCode) stopAtTheStep(step, run);
    console.log(`${step.name}\t${run.resultLine}`);
    if (step.name === "migration") migrationLines = run.lines;
  }
  const roundInput = runInput ? { ...runInput, entries, noStepKeys: readNoStepKeys(migrationLines) } : null;
  const outcomeWord = writeThePlanFolder(resultsFolder, plan, model, paths, roundInput);
  console.log(`${RESULT_PREFIX}${JSON.stringify({ steps: steps.length, design: paths.design, migration: paths.migration, plan, outcome: outcomeWord, ...(paths.findings ? { findings: paths.findings } : {}) })}`);
  console.log(formatPlanLine(plan, outcomeWord, resultsFolder));
}

finishModel();
