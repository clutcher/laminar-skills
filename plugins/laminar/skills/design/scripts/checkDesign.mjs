import fs from "node:fs";
import path from "node:path";
import { checkDesignModel } from "./check/DesignDefects.mjs";
import { readBaseCommit, readDesignModelOrExit, readOptionsOrExit, runOrExitOnTreeStop } from "./command/CommandLine.mjs";

const USAGE = "usage: node checkDesign.mjs --model <design-model.json> [--repo <repository root> [--base <commit>]] [--review <review.md>] [--shape-review <results>/shape-runs/<n>/review.md]...";

const STOP_EXIT_CODE = 2;

const SHAPE_REVIEW_OPTION = "shape-review";

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

const readTextOrExit = (label, textPath) => {
  try {
    return fs.readFileSync(path.resolve(textPath), "utf8");
  } catch (error) {
    console.error(`${label}: cannot read ${textPath}: ${error.message}`);
    process.exit(STOP_EXIT_CODE);
  }
};

const readShapeReviewOrExit = reviewPath => {
  const runFolderName = path.basename(path.dirname(path.resolve(reviewPath)));
  if (!RUN_FOLDER_NAME.test(runFolderName)) {
    console.error(`shape review: ${reviewPath} stands in the folder ${runFolderName}, and the folder of a shape run is its number, as shape-runs/<n>/review.md`);
    process.exit(STOP_EXIT_CODE);
  }
  return { run: Number(runFolderName), text: readTextOrExit("shape review", reviewPath) };
};

function checkDesign() {
  const options = readOptionsOrExit(USAGE, ["model", "repo", "base", "review"], ["model"], [SHAPE_REVIEW_OPTION]);
  const model = readDesignModelOrExit(options.model);
  const reviewText = options.review ? readTextOrExit("review", options.review) : null;
  const shapeReviews = options[SHAPE_REVIEW_OPTION].map(readShapeReviewOrExit);

  const repositoryRoot = options.repo ? path.resolve(options.repo) : null;
  const result = runOrExitOnTreeStop(() => checkDesignModel(model, repositoryRoot, reviewText, shapeReviews, repositoryRoot ? readBaseCommit(options) : null));
  for (const headLine of result.headLines) console.log(headLine);
  for (const defect of result.defects) console.log(formatDefect(defect));
  for (const scriptCase of result.unmatchedScriptCases) console.log(formatUnmatchedScriptCase(scriptCase));
  for (const keyCount of result.keyCountMap) console.log(formatKeyCount(keyCount));

  const countOf = mark => result.defects.filter(defect => markTheDefect(defect) === mark).length;
  const openCount = countOf(MARKS.DEFECT) + countOf(MARKS.RECHECK);
  console.log(`RESULT ${JSON.stringify({ defects: countOf(MARKS.DEFECT), recheck: countOf(MARKS.RECHECK), foundWrong: countOf(MARKS.FOUND_WRONG), keys: result.keyCountMap.size })}`);
  process.exit(openCount ? 1 : 0);
}

checkDesign();
