import fs from "node:fs";
import path from "node:path";
import { checkDesignModel } from "./check/DesignDefects.mjs";
import { findAutonomousReasonDefects } from "./check/AutonomousReasons.mjs";
import { findDecidedDefects } from "./check/DecidedCheck.mjs";
import { findNameOfThePath } from "./check/DefectNames.mjs";
import { readBaseCommit, readDesignModelOrExit, readOptionsOrExit, readTreeCommit, runOrExitOnTreeStop } from "./command/CommandLine.mjs";
import { DecidedListStop, checkDecidedListForm, resolveDecidedList } from "./plan/DecidedList.mjs";
import { RoundStop, readJsonOrStop, readRunFolder } from "./round/RunFolder.mjs";

const USAGE = "usage: node checkDesign.mjs --model <design-model.json> [--repo <repository root> [--tree <commit>] [--base <commit>]] [--review <review.md> [--decided <decided list>]] [--shape-review <results>/shape-runs/<n>/review.md]... [--autonomous]";

const STOP_EXIT_CODE = 2;

const SHAPE_REVIEW_OPTION = "shape-review";

const AUTONOMOUS_SWITCH = "autonomous";

const RUN_FOLDER_NAME = /^[1-9]\d*$/;

const MARKS = Object.freeze({ DEFECT: "defect", RECHECK: "recheck", FOUND_WRONG: "found-wrong" });

const markTheDefect = defect => {
  if (defect.foundWrong) return MARKS.FOUND_WRONG;
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

const readShapeReviewOrExit = reviewPath => {
  const runFolderName = path.basename(path.dirname(path.resolve(reviewPath)));
  if (!RUN_FOLDER_NAME.test(runFolderName)) exitWith(`shape review: ${reviewPath} stands in the folder ${runFolderName}, and the folder of a shape run is its number, as shape-runs/<n>/review.md`);
  return { run: Number(runFolderName), text: readTextOrExit("shape review", reviewPath) };
};

// The decided list names findings of the run folder that holds review.md, so it needs --review; a list that is refused stops the check.
const findDecidedDefectsOrExit = (model, options) => {
  if (!options.decided) return [];
  if (!options.review) exitWith(`--decided needs --review, the review.md of the run folder whose findings it decides\n${USAGE}`);
  try {
    const run = readRunFolder(path.dirname(path.resolve(options.review)), false);
    const { decisionOfFindingMap, defects } = resolveDecidedList(checkDecidedListForm(readJsonOrStop(path.resolve(options.decided), "decided")), run);
    return [...defects, ...findDecidedDefects(model, run, decisionOfFindingMap)].map(defect => ({ ...defect, recheck: false, foundWrong: false }));
  } catch (error) {
    if (!(error instanceof DecidedListStop || error instanceof RoundStop)) throw error;
    return exitWith(error.message);
  }
};

function checkDesign() {
  const options = readOptionsOrExit(USAGE, ["model", "repo", "tree", "base", "review", "decided"], ["model"], [SHAPE_REVIEW_OPTION], [AUTONOMOUS_SWITCH]);
  const model = readDesignModelOrExit(options.model);
  const reviewText = options.review ? readTextOrExit("review", options.review) : null;
  const shapeReviews = options[SHAPE_REVIEW_OPTION].map(readShapeReviewOrExit);
  const decidedDefects = findDecidedDefectsOrExit(model, options);

  const repositoryRoot = options.repo ? path.resolve(options.repo) : null;
  const commits = repositoryRoot ? { treeCommit: readTreeCommit(options), baseCommit: readBaseCommit(options) } : undefined;
  const result = runOrExitOnTreeStop(() => checkDesignModel(model, repositoryRoot, reviewText, shapeReviews, commits));
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
