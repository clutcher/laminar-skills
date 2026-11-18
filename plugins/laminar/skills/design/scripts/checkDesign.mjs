import fs from "node:fs";
import path from "node:path";
import { checkDesignModel } from "./check/DesignDefects.mjs";
import { findAutonomousReasonDefects } from "./check/AutonomousReasons.mjs";
import { findDecidedDefects, findShapeDecidedDefects } from "./check/DecidedCheck.mjs";
import { findDecidedNotGivenDefects } from "./check/DecidedNotGiven.mjs";
import { findNameOfThePath } from "./check/DefectNames.mjs";
import { findTakenCodeDefects } from "./check/TakenCode.mjs";
import { listClassesOfTheAbstractions } from "./check/TriedNames.mjs";
import { CHANGES_TRIED, findItemsThatDoNotCloseDefects, findProvenItemDefects, holdsAnItemThatDoesNotClose } from "./check/ItemsThatDoNotClose.mjs";
import { readBaseCommit, readDesignModelOrExit, readOptionsOrExit, readTreeCommit, readWholeNumberOrExit, runOrExitOnTreeStop } from "./command/CommandLine.mjs";
import { DecidedListStop, checkDecidedListForm, findReachDefects, readDecidedEntries, resolveDecidedList, resolveDecidedListOnShapeRuns } from "./plan/DecidedList.mjs";
import { buildDecidedReview, listMethodsThatTakeCode } from "./plan/DecidedReview.mjs";
import { listFindingEntries } from "./plan/FindingList.mjs";
import { DECIDED_REVIEW_FILE, getPlansFolder } from "./plan/PlanFolder.mjs";
import { RoundStop, SHAPE_MODEL_FILE, createFinderOfTheRunHoldingTheKey, findTheRoundOfTheRun, readJsonOrStop, readRunFolder, readShapeRunFolders } from "./round/RunFolder.mjs";
import { LinesFingerprintsOfTheRun } from "../../review/scripts/review/render/verdicts/LinesFingerprint.mjs";

const USAGE = "usage: node checkDesign.mjs --model <design-model.json> [--repo <repository root> [--tree <commit>] [--base <commit>]] [--review <review.md>] [--decided <decided list>] [--shape-review <results>/shape-runs/<n>/review.md]... [--ceiling <shape runs>] [--autonomous]";

const STOP_EXIT_CODE = 2;

const SHAPE_REVIEW_OPTION = "shape-review";

const AUTONOMOUS_SWITCH = "autonomous";

const RUN_FOLDER_NAME = /^[1-9]\d*$/;

const REVIEW_ABSTRACTIONS_FILE = "review-abstractions.json";

const ROUNDS_FOLDER = "rounds";

const MODEL_FILE = "design-model.json";

// A question defect ends the plan with the outcome question and does not stop the finish command, so it counts as no open defect.
const MARKS = Object.freeze({ DEFECT: "defect", RECHECK: "recheck", FOUND_WRONG: "found-wrong", QUESTION: "question" });

const markTheDefect = defect => {
  if (defect.foundWrong) return MARKS.FOUND_WRONG;
  if (defect.question) return MARKS.QUESTION;
  return defect.recheck ? MARKS.RECHECK : MARKS.DEFECT;
};

const NOT_MATCHED_MARK = "not matched";

const formatDefect = defect => [markTheDefect(defect), defect.code, defect.name, defect.sentence].join("\t");

const formatUnmatchedScriptCase = scriptCase => [NOT_MATCHED_MARK, scriptCase.code, scriptCase.name, scriptCase.text].join("\t");

const formatKeyCount = ([keyLabel, count]) => `count\t${keyLabel}\t${count.present}/${count.needed}`;

const exitWith = message => {
  console.error(message);
  process.exit(STOP_EXIT_CODE);
};

const readTextOrExit = (label, textPath) => {
  try {
    return fs.readFileSync(path.resolve(textPath), "utf8");
  } catch (error) {
    return exitWith(`${label}: cannot read ${textPath}: ${error.message}`);
  }
};

// The classes of a shape run come from review-abstractions.json beside its review.md; a run folder without that file gives no class.
const readShapeClassesOrExit = reviewPath => {
  const abstractionsPath = path.join(path.dirname(path.resolve(reviewPath)), REVIEW_ABSTRACTIONS_FILE);
  if (!fs.existsSync(abstractionsPath)) return [];
  try {
    return listClassesOfTheAbstractions(JSON.parse(readTextOrExit("shape abstractions", abstractionsPath)));
  } catch (error) {
    return exitWith(`shape abstractions: cannot read ${abstractionsPath}: ${error.message}`);
  }
};

// The shape model that the prepare command saved beside review.md; a run folder of an older version holds none.
const readSavedShapeModelOrExit = reviewPath => {
  const shapeModelPath = path.join(path.dirname(path.resolve(reviewPath)), SHAPE_MODEL_FILE);
  return fs.existsSync(shapeModelPath) ? readDesignModelOrExit(shapeModelPath) : null;
};

const readShapeReviewOrExit = reviewPath => {
  const runFolderName = path.basename(path.dirname(path.resolve(reviewPath)));
  if (!RUN_FOLDER_NAME.test(runFolderName)) exitWith(`shape review: ${reviewPath} stands in the folder ${runFolderName}, and the folder of a shape run is its number, as shape-runs/<n>/review.md`);
  const shapeModel = readSavedShapeModelOrExit(reviewPath);
  return { run: Number(runFolderName), text: readTextOrExit("shape review", reviewPath), classes: shapeModel ? shapeModel.classes : readShapeClassesOrExit(reviewPath), shapeModel };
};

// The decided list as the input gives it; its form is checked with the findings it decides.
const readDecidedList = options => {
  if (!options.decided) return [];
  try {
    return readDecidedEntries(JSON.parse(fs.readFileSync(path.resolve(options.decided), "utf8")));
  } catch {
    return [];
  }
};

// The copy of the model that the round script keeps for each round, in the folder rounds/ beside the model, in the order of the rounds.
const readRoundModelsOrExit = modelPath => {
  const roundsFolder = path.join(path.dirname(path.resolve(modelPath)), ROUNDS_FOLDER);
  if (!fs.existsSync(roundsFolder)) return [];
  return fs.readdirSync(roundsFolder)
    .filter(name => RUN_FOLDER_NAME.test(name) && fs.existsSync(path.join(roundsFolder, name, MODEL_FILE)))
    .sort((first, second) => Number(first) - Number(second))
    .map(name => readDesignModelOrExit(path.join(roundsFolder, name, MODEL_FILE)));
};

const asAnOpenDefect = defect => ({ ...defect, recheck: false, foundWrong: false });

// A list whose form is refused gives 1 defect decided-list-malformed per malformed object, for its first problem, and stops the check with exit 2, before the model is checked.
const stopOnTheMalformedList = defects => {
  for (const defect of defects) console.log(formatDefect(asAnOpenDefect(defect)));
  console.log(`RESULT ${JSON.stringify({ defects: defects.length, recheck: 0, foundWrong: 0, keys: 0, stopped: "decided" })}`);
  process.exit(STOP_EXIT_CODE);
};

// The decided list names findings of the run folder that holds review.md, and with no --review the items of the shape runs by their finding key; a list that is refused stops the check. The round of the run is read from the rounds folder beside the model, the results folder.
const findDecidedDefectsOrExit = (model, options) => {
  if (!options.decided) return [];
  try {
    if (!options.review) {
      const { decidedShapeItems, defects } = resolveDecidedListOnShapeRuns(checkDecidedListForm(readJsonOrStop(path.resolve(options.decided), "decided")), readShapeRunFolders(options[SHAPE_REVIEW_OPTION]), model);
      return [...defects, ...findShapeDecidedDefects(model, decidedShapeItems)].map(asAnOpenDefect);
    }
    const run = readRunFolder(path.dirname(path.resolve(options.review)), false);
    const roundOfTheRun = findTheRoundOfTheRun(path.join(path.dirname(path.resolve(options.model)), ROUNDS_FOLDER), run.runFolder);
    const decidedList = checkDecidedListForm(readJsonOrStop(path.resolve(options.decided), "decided"));
    const { decisionOfFindingCheckMap, defects } = resolveDecidedList(decidedList, run, createFinderOfTheRunHoldingTheKey(run.runFolder), roundOfTheRun);
    return [...defects, ...findReachDefects(decidedList, LinesFingerprintsOfTheRun.readFrom(run.runFolder), { run, decisionOfFindingCheckMap, model }), ...findDecidedDefects(model, run, decisionOfFindingCheckMap)].map(asAnOpenDefect);
  } catch (error) {
    if (error instanceof DecidedListStop) return stopOnTheMalformedList(error.defects);
    if (!(error instanceof RoundStop)) throw error;
    return exitWith(error.message);
  }
};

// An object that carries the decidedBy of the decided list or of a decision of the input run is checked against the list, so it needs the list or the run folder; a list that is refused has already stopped the check.
const findDecidedNotGivenDefectsOrExit = (model, options) => {
  if (!options.decided && !options.review) return [];
  try {
    const decidedList = options.decided ? checkDecidedListForm(readJsonOrStop(path.resolve(options.decided), "decided")) : NO_DECIDED_LIST;
    const inputRun = options.review ? readRunFolder(path.dirname(path.resolve(options.review)), false) : null;
    const roundOfTheRun = inputRun ? findTheRoundOfTheRun(path.join(path.dirname(path.resolve(options.model)), ROUNDS_FOLDER), inputRun.runFolder) : null;
    const decisionOfFindingCheckMap = inputRun ? resolveDecidedList(decidedList, inputRun, undefined, roundOfTheRun).decisionOfFindingCheckMap : new Map();
    return findDecidedNotGivenDefects(model, decidedList.decided, { inputRun, decisionOfFindingCheckMap, shapeRuns: readShapeRunFolders(options[SHAPE_REVIEW_OPTION]) }).map(asAnOpenDefect);
  } catch (error) {
    if (!(error instanceof RoundStop)) throw error;
    return exitWith(error.message);
  }
};

const SHAPE_RUNS_FOLDER = "shape-runs";

const NO_DECIDED_LIST = Object.freeze({ round: null, decided: [] });

// The decisions of every ready plan of the results folder, from each decided review file under plans/.
const readTheDecisionsOfThePlans = resultsFolder => {
  const plansFolder = getPlansFolder(resultsFolder);
  if (!fs.existsSync(plansFolder)) return [];
  return fs.readdirSync(plansFolder)
    .filter(name => RUN_FOLDER_NAME.test(name))
    .map(name => path.join(plansFolder, name, DECIDED_REVIEW_FILE))
    .filter(filePath => fs.existsSync(filePath))
    .flatMap(filePath => readJsonOrStop(filePath, "decided review").decided || []);
};

// A shape run that cannot be read gives no decision.
const readShapeRunIfPresent = (resultsFolder, run) => {
  try {
    return readRunFolder(path.join(resultsFolder, SHAPE_RUNS_FOLDER, String(run)), false);
  } catch (error) {
    if (!(error instanceof RoundStop)) throw error;
    return null;
  }
};

// The decisions a created method may take code from, as the finish command exports them: of the run folder of --review with its decided list, of its shape runs, and of every ready plan of the results folder beside the model.
const listDecisionsToTakeCodeFrom = (model, options) => {
  const resultsFolder = path.dirname(path.resolve(options.model));
  const run = options.review ? readRunFolder(path.dirname(path.resolve(options.review)), false) : null;
  const decidedList = options.decided ? checkDecidedListForm(readJsonOrStop(path.resolve(options.decided), "decided")) : NO_DECIDED_LIST;
  const resolved = run ? resolveDecidedList(decidedList, run, createFinderOfTheRunHoldingTheKey(run.runFolder), findTheRoundOfTheRun(path.join(resultsFolder, ROUNDS_FOLDER), run.runFolder)) : null;
  const decisionsOfThePlans = readTheDecisionsOfThePlans(resultsFolder);
  const { decidedReview } = buildDecidedReview({
    model,
    modelBefore: null,
    plan: 0,
    inputRun: run,
    entries: run ? listFindingEntries(model, run, resolved.decisionOfFindingMap, resolved.decisionOfFindingCheckMap) : [],
    readShapeRun: number => readShapeRunIfPresent(resultsFolder, number),
    baseCommit: "",
    planCommit: "",
    earlier: decisionsOfThePlans.length ? { model, decided: decisionsOfThePlans } : null,
    linesFingerprints: run ? LinesFingerprintsOfTheRun.readFrom(run.runFolder) : null,
    refreshed: resolved ? resolved.refreshed : [],
    decisionOfFindingCheckMap: resolved ? resolved.decisionOfFindingCheckMap : new Map(),
  });
  return decidedReview.decided;
};

// Read only where the model holds the key doesNotClose or a shape run can hold a proven item, the 3rd shape run on, so a shorter loop is checked as before.
const findItemsThatDoNotCloseDefectsOrExit = (model, options) => {
  if (!holdsAnItemThatDoesNotClose(model) && options[SHAPE_REVIEW_OPTION].length <= CHANGES_TRIED) return [];
  try {
    const shapeRuns = readShapeRunFolders(options[SHAPE_REVIEW_OPTION]);
    return [...findItemsThatDoNotCloseDefects(model, shapeRuns), ...findProvenItemDefects(model, shapeRuns)].map(defect => ({ ...defect, name: findNameOfThePath(model, defect.path) || defect.path, foundWrong: false }));
  } catch (error) {
    if (!(error instanceof RoundStop)) throw error;
    return exitWith(error.message);
  }
};

// Read only where the model holds the key takesCodeFrom, so a model without it is checked as before; a malformed decided list has already stopped the check.
const findTakenCodeDefectsOrExit = (model, options) => {
  if (!listMethodsThatTakeCode(model).length) return [];
  try {
    return findTakenCodeDefects(model, listDecisionsToTakeCodeFrom(model, options)).map(defect => ({ ...defect, name: findNameOfThePath(model, defect.path) || defect.path, foundWrong: false }));
  } catch (error) {
    if (!(error instanceof RoundStop)) throw error;
    return exitWith(error.message);
  }
};

function checkDesign() {
  const options = readOptionsOrExit(USAGE, ["model", "repo", "tree", "base", "review", "decided", "ceiling"], ["model"], [SHAPE_REVIEW_OPTION], [AUTONOMOUS_SWITCH]);
  const ceiling = readWholeNumberOrExit(USAGE, options.ceiling, "ceiling");
  const model = readDesignModelOrExit(options.model);
  const reviewText = options.review ? readTextOrExit("review", options.review) : null;
  const shapeReviews = options[SHAPE_REVIEW_OPTION].map(readShapeReviewOrExit);
  const decidedDefects = [...findDecidedDefectsOrExit(model, options), ...findDecidedNotGivenDefectsOrExit(model, options), ...findTakenCodeDefectsOrExit(model, options), ...findItemsThatDoNotCloseDefectsOrExit(model, options)];

  const repositoryRoot = options.repo ? path.resolve(options.repo) : null;
  const commits = repositoryRoot ? { treeCommit: readTreeCommit(options), baseCommit: readBaseCommit(options) } : undefined;
  const result = runOrExitOnTreeStop(() => checkDesignModel(model, repositoryRoot, reviewText, shapeReviews, commits, readRoundModelsOrExit(options.model), readDecidedList(options), ceiling));
  const autonomousDefects = options[AUTONOMOUS_SWITCH] ? findAutonomousReasonDefects(model, reviewText, shapeReviews).map(defect => ({ ...defect, name: findNameOfThePath(model, defect.path) || defect.path, foundWrong: false })) : [];
  const defects = [...result.defects, ...decidedDefects, ...autonomousDefects];
  for (const headLine of result.headLines) console.log(headLine);
  for (const defect of defects) console.log(formatDefect(defect));
  for (const scriptCase of result.unmatchedScriptCases) console.log(formatUnmatchedScriptCase(scriptCase));
  for (const keyCount of result.keyCountMap) console.log(formatKeyCount(keyCount));

  const countOf = mark => defects.filter(defect => markTheDefect(defect) === mark).length;
  const openCount = countOf(MARKS.DEFECT) + countOf(MARKS.RECHECK);
  console.log(`RESULT ${JSON.stringify({ defects: countOf(MARKS.DEFECT), recheck: countOf(MARKS.RECHECK), foundWrong: countOf(MARKS.FOUND_WRONG), keys: result.keyCountMap.size })}`);
  process.exit(openCount ? 1 : 0);
}

checkDesign();
