import fs from "node:fs";
import path from "node:path";
import { readDesignModelOrExit, readOptionsOrExit } from "./command/CommandLine.mjs";
import { buildShapeRunDecidedReview } from "./plan/DecidedReview.mjs";
import { DECIDED_REVIEW_FILE, createShapeRunReader, writeJson } from "./plan/PlanFolder.mjs";
import { SHAPE_MODEL_FILE } from "./round/RunFolder.mjs";

const USAGE = "usage: node carryShapeDecisions.mjs --run <results>/shape-runs/<n>";

const STOP_EXIT_CODE = 2;

const RUN_FOLDER_NAME = /^[1-9]\d*$/;

const exitWith = message => {
  console.error(message);
  process.exit(STOP_EXIT_CODE);
};

// The folder of a shape run is its number under shape-runs/ of the results folder, so the shape runs before it stand beside it.
const readShapeRunNumberOrExit = runFolder => {
  const runFolderName = path.basename(runFolder);
  if (!RUN_FOLDER_NAME.test(runFolderName)) exitWith(`shape run: ${runFolder} is the folder ${runFolderName}, and the folder of a shape run is its number, as shape-runs/<n>`);
  return Number(runFolderName);
};

// The model the shape run judges is the copy its prepare command saved, which holds the objects of every shape run before it.
const readTheJudgedModelOrExit = runFolder => {
  const shapeModelPath = path.join(runFolder, SHAPE_MODEL_FILE);
  if (!fs.existsSync(shapeModelPath)) exitWith(`shape run: ${runFolder} holds no ${SHAPE_MODEL_FILE}; run the prepare command of the shape run first`);
  return readDesignModelOrExit(shapeModelPath);
};

function carryShapeDecisions() {
  const options = readOptionsOrExit(USAGE, ["run"], ["run"]);
  const runFolder = path.resolve(options.run);
  const run = readShapeRunNumberOrExit(runFolder);
  const model = readTheJudgedModelOrExit(runFolder);
  const resultsFolder = path.dirname(path.dirname(runFolder));
  const decidedReview = buildShapeRunDecidedReview({ model, run, readShapeRun: createShapeRunReader(resultsFolder, "not carried") });
  const decidedReviewPath = path.join(runFolder, DECIDED_REVIEW_FILE);
  writeJson(decidedReviewPath, decidedReview);
  console.log(`RESULT ${JSON.stringify({ decidedReview: decidedReviewPath, decisions: decidedReview.decided.length })}`);
}

carryShapeDecisions();
