import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { listConsiderations } from "./check/AutonomousReasons.mjs";
import { readNamedReviewItems } from "./check/ReviewItems.mjs";
import { isAText, readDesignModel, readList } from "./model/DesignModel.mjs";
import { readDesignModelOrExit, readOptionsOrExit } from "./command/CommandLine.mjs";
import { carryTheFixedFindings, listUnfinishedGroupsOfThePlanBefore } from "./plan/FixedFindings.mjs";
import { DecidedListStop, checkDecidedListForm, findReachDefects, formatDecidedKeyNotRaisedLine, formatDecidedThroughInterfaceMethodLine, resolveDecidedList, resolveDecidedListOnShapeRuns } from "./plan/DecidedList.mjs";
import { listFindingEntries } from "./plan/FindingList.mjs";
import { buildDecidedReview, readCommitOfThePlan } from "./plan/DecidedReview.mjs";
import { LinesFingerprintsOfTheRun } from "../../review/scripts/review/render/verdicts/LinesFingerprint.mjs";
import { BASE_COMMIT_FILE, DECIDED_REVIEW_FILE, DISPOSITIONS_FILE, FINDINGS_FILE, MODEL_FILE, PLAN_COMMIT_FILE, PLAN_OUTCOMES, copyFileIfPresent, findLastPlan, formatPlanLine, getPlanFolder, listFindingsThatStopThePlan, listQuestionsThatStopThePlan, writeJson, writeOutcome } from "./plan/PlanFolder.mjs";
import { listRoundDispositions } from "./plan/RoundDispositions.mjs";
import { RoundStop, createFinderOfTheRunHoldingTheKey, findTheRoundOfTheRun, readJsonOrStop, readRunFolder, readShapeRunFolders } from "./round/RunFolder.mjs";
import { listDefectLinesOfTheRun, removeFinishStop, writeFinishStop } from "./plan/FinishStop.mjs";

const USAGE = "usage: node finishModel.mjs --model <design-model.json> --results <results folder> [--repo <repository root> [--tree <commit>] [--base <commit>]] [--review <review.md>] [--decided <decided list>] [--shape-review <results>/shape-runs/<n>/review.md]... [--classes <display names>] [--rounds <results>/rounds] [--autonomous]";

const SHAPE_REVIEW_OPTION = "shape-review";

const AUTONOMOUS_SWITCH = "autonomous";

const MIGRATION_WORKFLOW_FILE = "migration.workflow.js";

const SCRIPTS_FOLDER = path.dirname(fileURLToPath(import.meta.url));

const RESULT_PREFIX = "RESULT ";

const DEFECT_PREFIX = "defect\t";

const NO_STEP_PREFIX = "no step\t";

// A question line of the design check does not stop the finish, and the plan ends with the outcome question, so the finish prints each one.
const QUESTION_PREFIX = "question\t";

const DEFECT_EXIT_CODE = 1;

const STOP_EXIT_CODE = 2;

const listOptionArguments = (options, names) => names.filter(name => options[name]).flatMap(name => [`--${name}`, options[name]]);

const listShapeReviewArguments = options => options[SHAPE_REVIEW_OPTION].flatMap(reviewPath => [`--${SHAPE_REVIEW_OPTION}`, reviewPath]);

// A later plan is cut, also where the designer changed no class, so it plans only the groups of its changes, its findings, its stopped writers and the groups that waited for them.
const listCutArguments = (options, plan, paths) => {
  if (plan === 1) return ["--plan", String(plan)];
  const modelBeforePath = path.join(getPlanFolder(paths.results, plan - 1), MODEL_FILE);
  const unfinished = paths.unfinishedGroups.length ? ["--unfinished", paths.unfinishedGroups.join(",")] : [];
  return ["--classes", options.classes || "", "--plan", String(plan), ...unfinished, ...(fs.existsSync(modelBeforePath) ? ["--before", modelBeforePath] : [])];
};

// The 3 scripts of the finish command, in that order, each with the options it takes.
const listFinishSteps = (options, paths, plan) => [
  { name: "check", script: "checkDesign.mjs", arguments: [...listOptionArguments(options, ["model", "repo", "tree", "base", "review", "decided"]), ...listShapeReviewArguments(options), ...(options[AUTONOMOUS_SWITCH] ? [`--${AUTONOMOUS_SWITCH}`] : [])] },
  { name: "render", script: "renderDesign.mjs", arguments: [...listOptionArguments(options, ["model", "rounds", "review", "repo", "tree"]), ...listShapeReviewArguments(options), "--out", paths.design] },
  { name: "migration", script: "planMigration.mjs", arguments: [...listOptionArguments(options, ["model", "repo", "tree"]), ...(paths.findings ? ["--findings", paths.findings, ...listOptionArguments(options, ["review"])] : []), ...listCutArguments(options, plan, paths), "--out", paths.migration] },
];

// The scripts exit inside their own code, so each runs as its own process, and its output is read whole.
const runFinishStep = step => {
  const run = spawnSync(process.execPath, [path.join(SCRIPTS_FOLDER, step.script), ...step.arguments], { encoding: "utf8" });
  const lines = run.stdout.split("\n");
  const hasDefect = lines.some(line => line.startsWith(DEFECT_PREFIX));
  const exitCode = run.status ?? DEFECT_EXIT_CODE;
  return { ...run, lines, exitCode: exitCode || (hasDefect ? DEFECT_EXIT_CODE : 0), resultLine: lines.find(line => line.startsWith(RESULT_PREFIX)) };
};

// The finish stop keeps what the step said in the plan folder, so a calling session tells a design defect from a crash.
const stopAtTheStep = (step, run, plan, planFolder) => {
  const says = `${step.script} exited ${run.exitCode}`;
  writeFinishStop(planFolder, { plan, at: step.name, says, exit: run.exitCode, lines: listDefectLinesOfTheRun(run) });
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);
  console.log(`stopped\t${step.name}\t${says}`);
  console.log(`${RESULT_PREFIX}${JSON.stringify({ stopped: step.name, exit: run.exitCode })}`);
  process.exit(run.exitCode);
};

const exitWith = message => {
  console.error(message);
  process.exit(STOP_EXIT_CODE);
};

const NO_DECIDED_LIST = Object.freeze({ round: null, decided: [] });

const ROUNDS_FOLDER = "rounds";

// A decided list that names a key no finding of the run holds, a round that is not the round of the run, or a reach key the run cannot guard, was written for another run or cannot be applied, so the finish stops before it writes findings.json or a plan folder; a list whose form is refused stops with exit 2.
const stopOnTheDecidedDefects = (defects, exitCode = DEFECT_EXIT_CODE) => {
  for (const defect of defects) console.log(`${DEFECT_PREFIX}${defect.code}\t${defect.name}\t${defect.sentence}`);
  console.log(`stopped\tdecided\tthe decided list holds ${defects.length} defect(s)`);
  console.log(`${RESULT_PREFIX}${JSON.stringify({ stopped: "decided", exit: exitCode })}`);
  process.exit(exitCode);
};

const createDecidedThroughEntry = shapeItem => ({ run: shapeItem.shapeRun, number: shapeItem.number, displayName: shapeItem.displayName, check: shapeItem.check, decidedThrough: shapeItem.decidedThrough });

// With no --review, the decided list decides items of the shape runs by their finding key, and the design check checks that the model carries each decision; the finish reads the keys that no shape run raised and the items decided through their interface method, which it prints and lists in outcome.json.
const readTheShapeDecisionsOrExit = (options, model) => {
  try {
    const { decidedShapeItems, decidedKeysNotRaised, defects } = resolveDecidedListOnShapeRuns(checkDecidedListForm(readJsonOrStop(path.resolve(options.decided), "decided")), readShapeRunFolders(options[SHAPE_REVIEW_OPTION]), model);
    if (defects.length) stopOnTheDecidedDefects(defects);
    return { decidedKeysNotRaised, decidedThroughInterfaceMethod: decidedShapeItems.filter(shapeItem => shapeItem.decidedThrough).map(createDecidedThroughEntry) };
  } catch (error) {
    if (error instanceof DecidedListStop) return stopOnTheDecidedDefects(error.defects, STOP_EXIT_CODE);
    if (!(error instanceof RoundStop)) throw error;
    return exitWith(error.message);
  }
};

// The run folder of --review with the decisions of the decided list, read once before the 3 scripts, because findings.json and the dispositions of the round both rest on them.
const readTheRunOrExit = (options, model) => {
  if (!options.review) return null;
  try {
    const runFolder = path.dirname(path.resolve(options.review));
    const run = readRunFolder(runFolder, false);
    const decidedList = options.decided ? checkDecidedListForm(readJsonOrStop(path.resolve(options.decided), "decided")) : NO_DECIDED_LIST;
    const roundOfTheRun = findTheRoundOfTheRun(path.join(path.resolve(options.results), ROUNDS_FOLDER), runFolder);
    const { decisionOfFindingMap, decisionOfFindingCheckMap, refreshed, notRefreshedLines, defects } = resolveDecidedList(decidedList, run, createFinderOfTheRunHoldingTheKey(runFolder), roundOfTheRun);
    const allDefects = [...defects, ...findReachDefects(decidedList, LinesFingerprintsOfTheRun.readFrom(runFolder), { run, decisionOfFindingCheckMap, model })];
    if (allDefects.length) stopOnTheDecidedDefects(allDefects);
    return { run, decisionOfFindingMap, decisionOfFindingCheckMap, refreshed, notRefreshedLines };
  } catch (error) {
    if (error instanceof DecidedListStop) return stopOnTheDecidedDefects(error.defects, STOP_EXIT_CODE);
    if (!(error instanceof RoundStop)) throw error;
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

const SHAPE_RUNS_FOLDER = "shape-runs";

// A shape run that cannot be read gives no decision, and the finish command names it.
const createShapeRunReader = resultsFolder => {
  const runOfNumberMap = new Map();
  return run => {
    if (!runOfNumberMap.has(run)) {
      try {
        runOfNumberMap.set(run, readRunFolder(path.join(resultsFolder, SHAPE_RUNS_FOLDER, String(run)), false));
      } catch (error) {
        if (!(error instanceof RoundStop)) throw error;
        console.log(`not exported: shape run ${run}: ${error.message}`);
        runOfNumberMap.set(run, null);
      }
    }
    return runOfNumberMap.get(run);
  };
};

const readModelOfThePlanIfPresent = (resultsFolder, plan) => {
  const modelPath = path.join(getPlanFolder(resultsFolder, plan), MODEL_FILE);
  return plan >= 1 && fs.existsSync(modelPath) ? readDesignModel(modelPath) : null;
};

// The export is cumulative, so the latest earlier ready plan with a decided review file holds every earlier decision.
const findTheEarlierExport = (resultsFolder, plan) => {
  for (let earlierPlan = plan - 1; earlierPlan >= 1; earlierPlan -= 1) {
    const exportPath = path.join(getPlanFolder(resultsFolder, earlierPlan), DECIDED_REVIEW_FILE);
    if (fs.existsSync(exportPath)) return { model: readModelOfThePlanIfPresent(resultsFolder, earlierPlan), decided: readJsonOrStop(exportPath, "decided review").decided || [] };
  }
  return null;
};

const writeTheDecidedReview = (resultsFolder, plan, model, roundInput) => {
  const planFolder = getPlanFolder(resultsFolder, plan);
  const { decidedReview, droppedLines } = buildDecidedReview({
    model,
    modelBefore: readModelOfThePlanIfPresent(resultsFolder, plan - 1),
    plan,
    inputRun: roundInput ? roundInput.run : null,
    entries: roundInput ? roundInput.entries : [],
    readShapeRun: createShapeRunReader(resultsFolder),
    baseCommit: readCommitOfThePlan(planFolder, BASE_COMMIT_FILE),
    planCommit: readCommitOfThePlan(planFolder, PLAN_COMMIT_FILE),
    earlier: findTheEarlierExport(resultsFolder, plan),
    linesFingerprints: roundInput ? LinesFingerprintsOfTheRun.readFrom(roundInput.run.runFolder) : null,
    refreshed: roundInput ? roundInput.refreshed : [],
    decisionOfFindingCheckMap: roundInput ? roundInput.decisionOfFindingCheckMap : new Map(),
  });
  writeJson(path.join(planFolder, DECIDED_REVIEW_FILE), decidedReview);
  for (const line of droppedLines) console.log(line);
};

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
  const openAfterCeiling = listFindingsThatStopThePlan(model);
  const outcomeWord = questions.length || openAfterCeiling.length ? PLAN_OUTCOMES.QUESTION : PLAN_OUTCOMES.READY;
  writeOutcome(resultsFolder, plan, { word: outcomeWord, questions, considerations: paths.considerations, openAfterCeiling, referencesRead: readList(model.decisions.referencesRead), decidedKeysNotRaised: paths.shapeDecisions?.decidedKeysNotRaised, decidedThroughInterfaceMethod: paths.shapeDecisions?.decidedThroughInterfaceMethod });
  if (outcomeWord === PLAN_OUTCOMES.READY) writeTheDecidedReview(resultsFolder, plan, model, roundInput);
  return outcomeWord;
};

function finishModel() {
  const options = readOptionsOrExit(USAGE, ["model", "repo", "tree", "base", "review", "decided", "results", "rounds", "classes"], ["model", "results"], [SHAPE_REVIEW_OPTION], [AUTONOMOUS_SWITCH]);
  const resultsFolder = path.resolve(options.results);
  const model = readDesignModelOrExit(options.model);
  const plan = Math.max(findLastPlan(resultsFolder), 1);
  const runInput = readTheRunOrExit(options, model);
  const shapeDecisions = !options.review && options.decided ? readTheShapeDecisionsOrExit(options, model) : null;
  // The groups that waited on a stopped group are planned again also with no run folder, because the writer workflow plans only the groups of the migration.
  const unfinishedGroups = listUnfinishedGroupsOfThePlanBefore(model, resultsFolder, plan);
  const entries = runInput ? carryTheFixedFindings(model, resultsFolder, plan, listFindingEntries(model, runInput.run, runInput.decisionOfFindingMap, runInput.decisionOfFindingCheckMap)) : [];
  // An item to consider left as a question to the author is passed on as a consideration, never as a question of the plan, because items to consider on existing code stand in most changes.
  const reviewText = readTextIfGiven(options.review);
  const considerations = [
    ...listConsiderations(model, reviewText, readShapeReviews(options), (number, check) => findFindingOfTheItem(runInput, number, check)),
    ...listConsiderationsOfTheEntries(entries, reviewText),
  ];
  const paths = { model: options.model, results: resultsFolder, design: path.join(resultsFolder, "design.md"), migration: path.join(resultsFolder, "migration.md"), findings: runInput ? path.join(resultsFolder, FINDINGS_FILE) : null, unfinishedGroups, considerations, shapeDecisions };
  if (runInput) writeJson(paths.findings, entries);

  const steps = listFinishSteps(options, paths, plan);
  let migrationLines = [];
  for (const step of steps) {
    const run = runFinishStep(step);
    if (run.exitCode) stopAtTheStep(step, run, plan, getPlanFolder(resultsFolder, plan));
    for (const line of run.lines.filter(line => line.startsWith(QUESTION_PREFIX))) console.log(line);
    console.log(`${step.name}\t${run.resultLine}`);
    if (step.name === "migration") migrationLines = run.lines;
  }
  const roundInput = runInput ? { ...runInput, entries, noStepKeys: readNoStepKeys(migrationLines) } : null;
  for (const line of runInput ? runInput.notRefreshedLines : []) console.log(line);
  for (const decidedKey of shapeDecisions ? shapeDecisions.decidedKeysNotRaised : []) console.log(formatDecidedKeyNotRaisedLine(decidedKey));
  for (const entry of shapeDecisions ? shapeDecisions.decidedThroughInterfaceMethod : []) console.log(formatDecidedThroughInterfaceMethodLine(entry));
  const outcomeWord = writeThePlanFolder(resultsFolder, plan, model, paths, roundInput);
  removeFinishStop(getPlanFolder(resultsFolder, plan));
  console.log(`${RESULT_PREFIX}${JSON.stringify({ steps: steps.length, design: paths.design, migration: paths.migration, plan, outcome: outcomeWord, ...(paths.findings ? { findings: paths.findings } : {}), ...(shapeDecisions ? { decidedKeysNotRaised: shapeDecisions.decidedKeysNotRaised.length, decidedThroughInterfaceMethod: shapeDecisions.decidedThroughInterfaceMethod.length } : {}) })}`);
  console.log(formatPlanLine(plan, outcomeWord, resultsFolder));
}

finishModel();
