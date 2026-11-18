import fs from "node:fs";
import { readOptionsOrExit } from "./command/CommandLine.mjs";
import { listRefusedAnswers } from "./round/AnswerEvidence.mjs";

const USAGE = "usage: node checkAnswerEvidence.mjs --answers <file of the answers of 1 answer round> --repo <repository root> [--inputs <path>,<path>]";

const INPUT_SEPARATOR = ",";

function printRefusedAnswers() {
  const options = readOptionsOrExit(USAGE, ["answers", "repo", "inputs"], ["answers", "repo"]);
  const answers = JSON.parse(fs.readFileSync(options.answers, "utf8"));
  const inputs = options.inputs ? options.inputs.split(INPUT_SEPARATOR).filter(Boolean) : [];
  console.log(`RESULT ${JSON.stringify({ refused: listRefusedAnswers(answers, { repository: options.repo, inputs }) })}`);
}

printRefusedAnswers();
