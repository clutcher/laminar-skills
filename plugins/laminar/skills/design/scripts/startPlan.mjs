import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readDesignModelOrExit, readOptionsOrExit, runOrExitOnTreeStop } from "./command/CommandLine.mjs";
import { readCurrentTree } from "./migration/CurrentTree.mjs";
import { carryTheModel } from "./plan/CarriedModel.mjs";
import { listUnfinishedGroups, readPlannedGroups } from "./plan/FixedFindings.mjs";
import { BASE_COMMIT_FILE, MODEL_FILE, OUTCOME_FILE, PLAN_COMMIT_FILE, PLAN_OUTCOMES, findLastPlan, formatPlanLine, getPlanFolder, writeJson, writeOutcome } from "./plan/PlanFolder.mjs";
import { StopListStop, checkStopListForm, recordTheStops } from "./plan/StopList.mjs";

const USAGE = "usage: node startPlan.mjs --results <results folder> --repo <repository root> [--base <commit>] [--run <run folder>] [--stop <stop list>] [--autonomous]";

const STOP_EXIT_CODE = 2;

const ENDED_EXIT_CODE = 1;

// The reason of the outcome of a plan that ends before it starts, because a run folder came with no base commit.
const BASE_MISSING = "base-missing";

const exitWith = message => {
  console.error(message);
  process.exit(STOP_EXIT_CODE);
};

const resolveCommit = (repositoryRoot, name) => {
  const result = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${name}^{commit}`], { cwd: repositoryRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
};

const readModelTextOrExit = modelPath => {
  try {
    return JSON.parse(fs.readFileSync(modelPath, "utf8"));
  } catch (error) {
    return exitWith(`model: cannot read ${modelPath}: ${error.message}`);
  }
};

const readStopListOrExit = stopPath => {
  try {
    return checkStopListForm(JSON.parse(fs.readFileSync(path.resolve(stopPath), "utf8")));
  } catch (error) {
    if (error instanceof StopListStop) return exitWith(error.message);
    return exitWith(`stop: cannot read ${stopPath}: ${error.message}`);
  }
};

// A results folder of 0.72.0 holds a model and no plans/ folder: its model is plan 1, which this call copies before it starts plan 2.
const keepTheFirstPlan = (resultsFolder, modelPath) => {
  if (!fs.existsSync(modelPath) || findLastPlan(resultsFolder) > 0) return;
  const firstPlanFolder = getPlanFolder(resultsFolder, 1);
  fs.mkdirSync(firstPlanFolder, { recursive: true });
  fs.copyFileSync(modelPath, path.join(firstPlanFolder, MODEL_FILE));
  const baseCommitPath = path.join(resultsFolder, BASE_COMMIT_FILE);
  if (fs.existsSync(baseCommitPath)) fs.copyFileSync(baseCommitPath, path.join(firstPlanFolder, BASE_COMMIT_FILE));
  writeJson(path.join(firstPlanFolder, OUTCOME_FILE), { plan: 1, outcome: PLAN_OUTCOMES.READY, questions: [], stop: null });
};

// A plan folder with no outcome is the plan in progress, so a second start of the same plan keeps its number and carries nothing again.
const choosePlan = resultsFolder => {
  const lastPlan = findLastPlan(resultsFolder);
  const isInProgress = lastPlan > 0 && !fs.existsSync(path.join(getPlanFolder(resultsFolder, lastPlan), OUTCOME_FILE));
  return isInProgress ? { plan: lastPlan, isNew: false } : { plan: lastPlan + 1, isNew: true };
};

const endThePlan = (resultsFolder, plan, stop) => {
  writeOutcome(resultsFolder, plan, { word: PLAN_OUTCOMES.STOP, stop });
  console.log(formatPlanLine(plan, PLAN_OUTCOMES.STOP, resultsFolder));
  process.exit(ENDED_EXIT_CODE);
};

const resolveTheBaseOrEnd = (options, repositoryRoot, headCommit, resultsFolder, plan) => {
  if (!options.base && !options.run) return headCommit;

  const baseCommit = options.base ? resolveCommit(repositoryRoot, options.base) : null;
  if (baseCommit) return baseCommit;
  const says = options.base ? `git cannot resolve the base ${options.base} in ${repositoryRoot}` : "a run folder needs the base commit, and the input gives no base";
  if (options.autonomous) endThePlan(resultsFolder, plan, { reason: BASE_MISSING, at: "base", says });
  return exitWith(`base: ${says}`);
};

const writeTheCommits = (resultsFolder, planFolder, baseCommit, headCommit) => {
  for (const folder of [resultsFolder, planFolder]) {
    fs.writeFileSync(path.join(folder, BASE_COMMIT_FILE), `${baseCommit}\n`);
    fs.writeFileSync(path.join(folder, PLAN_COMMIT_FILE), `${headCommit}\n`);
  }
};

function startPlan() {
  const options = readOptionsOrExit(USAGE, ["results", "repo", "base", "run", "stop"], ["results", "repo"], [], ["autonomous"]);
  const resultsFolder = path.resolve(options.results);
  const repositoryRoot = path.resolve(options.repo);
  const modelPath = path.join(resultsFolder, MODEL_FILE);
  fs.mkdirSync(resultsFolder, { recursive: true });

  const headCommit = resolveCommit(repositoryRoot, "HEAD");
  if (!headCommit) exitWith(`repo: git cannot read the head of ${repositoryRoot}`);
  keepTheFirstPlan(resultsFolder, modelPath);
  const { plan, isNew } = choosePlan(resultsFolder);
  const baseCommit = resolveTheBaseOrEnd(options, repositoryRoot, headCommit, resultsFolder, plan);
  const planFolder = getPlanFolder(resultsFolder, plan);
  fs.mkdirSync(planFolder, { recursive: true });
  writeTheCommits(resultsFolder, planFolder, baseCommit, headCommit);
  console.log(`plan: ${plan}`);
  console.log(`base commit: ${baseCommit}`);
  console.log(`plan commit: ${headCommit}`);

  const hasModel = fs.existsSync(modelPath);
  if (options.stop && !hasModel) exitWith(`stop: ${modelPath} holds no model, so no writer of an earlier plan can have stopped`);
  if (!hasModel) {
    console.log(`RESULT ${JSON.stringify({ plan, later: false })}`);
    return;
  }

  const model = readDesignModelOrExit(modelPath);
  let given = readModelTextOrExit(modelPath);
  let counts = null;
  const stopList = options.stop ? readStopListOrExit(options.stop) : [];
  if (isNew) {
    const unfinishedGroups = listUnfinishedGroups(model, stopList.map(stopped => ({ group: stopped.group })), readPlannedGroups(getPlanFolder(resultsFolder, plan - 1)));
    ({ model: given, counts } = runOrExitOnTreeStop(() => carryTheModel(given, readCurrentTree(repositoryRoot, headCommit), unfinishedGroups)));
    console.log(`carried: ${Object.entries(counts).map(([key, count]) => `${key} ${count}`).join(" · ")}`);
  }
  const { stops, secondStops } = options.stop ? recordTheStops(given.decisions || {}, stopList, plan - 1) : { stops: (given.decisions || {}).stops, secondStops: [] };
  if (stops) given = { ...given, decisions: { ...given.decisions, stops } };
  writeJson(modelPath, given);
  for (const stop of secondStops) console.log(["second stop", stop.at, `plans ${stop.earlierPlan} and ${stop.plan}`, stop.says].join("\t"));
  console.log(`RESULT ${JSON.stringify({ plan, later: true, carried: counts, stops: options.stop ? stops.length : null, secondStops: secondStops.length })}`);
  if (secondStops.length && options.autonomous) endThePlan(resultsFolder, plan, { reason: secondStops[0].reason, at: secondStops[0].at, says: secondStops[0].says });
}

startPlan();
