import fs from "node:fs";
import path from "node:path";
import { writeJson } from "./PlanFolder.mjs";

export const FINISH_STOP_FILE = "finish-stop.json";

const OPEN_DEFECT_LINE = /^(defect|recheck)\t/;

// The open defects a step prints, then its stop message, which a script that stops on its input writes only to the error output.
export const listDefectLinesOfTheRun = run => [
  ...run.stdout.split("\n").filter(line => OPEN_DEFECT_LINE.test(line)),
  ...run.stderr.split("\n").filter(line => line.trim()),
];

export const writeFinishStop = (planFolder, finishStop) => {
  fs.mkdirSync(planFolder, { recursive: true });
  writeJson(path.join(planFolder, FINISH_STOP_FILE), finishStop);
};

// A finish that passes leaves only the plan outcome, so a plan folder never shows both files.
export const removeFinishStop = planFolder => fs.rmSync(path.join(planFolder, FINISH_STOP_FILE), { force: true });
