import fs from "node:fs";
import path from "node:path";
import { readDesignModelOrExit, readOptionsOrExit } from "./command/CommandLine.mjs";
import { writeDesignText } from "./render/DesignText.mjs";

const USAGE = "usage: node renderDesign.mjs --model <design-model.json> --out <design.md> [--rounds <results>/rounds]";

const STOP_EXIT_CODE = 2;

const COUNTS_FILE = "counts.json";

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

function renderDesign() {
  const options = readOptionsOrExit(USAGE, ["model", "out", "rounds"], ["model", "out"]);
  const model = readDesignModelOrExit(options.model);
  const roundCounts = options.rounds ? readRoundCountsOrExit(path.resolve(options.rounds)) : null;

  const outPath = path.resolve(options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, writeDesignText(model, roundCounts));
  console.log(`RESULT ${JSON.stringify({ design: outPath, classes: model.classes.length, questions: (model.decisions.questions || []).length, ...(roundCounts ? { rounds: roundCounts.length } : {}) })}`);
}

renderDesign();
