import fs from "node:fs";
import path from "node:path";
import { listFindingsToConsider } from "./check/AutonomousReasons.mjs";
import { readDesignModelOrExit, readOptionsOrExit } from "./command/CommandLine.mjs";
import { writeDesignText } from "./render/DesignText.mjs";

const USAGE = "usage: node renderDesign.mjs --model <design-model.json> --out <design.md> [--rounds <results>/rounds] [--review <run folder>/review.md] [--shape-review <results>/shape-runs/<n>/review.md]...";

const STOP_EXIT_CODE = 2;

const COUNTS_FILE = "counts.json";

const SHAPE_REVIEW_OPTION = "shape-review";

const ROUND_FOLDER_NAME = /^[1-9]\d*$/;

// The records of the round script, 1 per numbered folder, in the order of the rounds; a missing folder is a run with no round yet.
const readRoundCountsOrExit = roundsFolder => {
  if (!fs.existsSync(roundsFolder)) return [];
  const rounds = fs.readdirSync(roundsFolder).filter(name => ROUND_FOLDER_NAME.test(name)).map(Number).sort((first, second) => first - second);
  return rounds.map(round => {
    const countsPath = path.join(roundsFolder, String(round), COUNTS_FILE);
    try {
      return JSON.parse(fs.readFileSync(countsPath, "utf8"));
    } catch (error) {
      console.error(`rounds: cannot read ${countsPath}: ${error.message}`);
      process.exit(STOP_EXIT_CODE);
    }
  });
};

const readTextOrExit = (label, textPath) => {
  try {
    return fs.readFileSync(path.resolve(textPath), "utf8");
  } catch (error) {
    console.error(`${label}: cannot read ${textPath}: ${error.message}`);
    return process.exit(STOP_EXIT_CODE);
  }
};

// The objects of decisions.findings whose item stands under the items to consider of the run folder or of a shape run, which the render keeps apart.
const readFindingsToConsiderOrExit = (model, options) => {
  const reviewText = options.review ? readTextOrExit("review", options.review) : null;
  const shapeReviews = options[SHAPE_REVIEW_OPTION].map(reviewPath => ({ run: Number(path.basename(path.dirname(path.resolve(reviewPath)))), text: readTextOrExit("shape review", reviewPath) }));
  return new Set(listFindingsToConsider(model, reviewText, shapeReviews).map(({ finding }) => finding));
};

function renderDesign() {
  const options = readOptionsOrExit(USAGE, ["model", "out", "rounds", "review"], ["model", "out"], [SHAPE_REVIEW_OPTION]);
  const model = readDesignModelOrExit(options.model);
  const roundCounts = options.rounds ? readRoundCountsOrExit(path.resolve(options.rounds)) : null;

  const outPath = path.resolve(options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, writeDesignText(model, roundCounts, readFindingsToConsiderOrExit(model, options)));
  console.log(`RESULT ${JSON.stringify({ design: outPath, classes: model.classes.length, questions: (model.decisions.questions || []).length, ...(roundCounts ? { rounds: roundCounts.length } : {}) })}`);
}

renderDesign();
