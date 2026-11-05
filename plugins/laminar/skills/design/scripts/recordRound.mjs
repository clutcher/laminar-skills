import fs from "node:fs";
import path from "node:path";
import { readDesignModelOrExit, readOptionsOrExit } from "./command/CommandLine.mjs";
import { ROUND_DEFECT_CODES, checkDispositionsForm, createRoundDefect, resolveDispositions } from "./round/Dispositions.mjs";
import { LOOP_WORDS, decideLoopLine, listSendLines } from "./round/LoopLine.mjs";
import { compareTheRound } from "./round/RoundComparison.mjs";
import { createChangedPlaceFinder, listFixCreatedFiles, readHeadCommit } from "./round/RoundGit.mjs";
import { RoundStop, createFindingKey, readJsonOrStop, readRunFolder } from "./round/RunFolder.mjs";
import { findGivenRenameDefects } from "./round/RoundRenames.mjs";
import { writeRoundLines } from "./round/RoundText.mjs";

const USAGE = "usage: node recordRound.mjs --results <results> --run <run folder> [--dispositions <file>] [--model <results>/design-model.json] [--repo <repository>] [--autonomous] [--dollars <measured>] [--round <n>] [--ceiling <rounds>] [--no-findings]";

const STOP_EXIT_CODE = 2;

const ROUNDS_FOLDER = "rounds";

const BASE_COMMIT_FILE = "base-commit.txt";

const HEAD_COMMIT_FILE = "head-commit.txt";

const COUNTS_FILE = "counts.json";

const JUDGED_FILE = "judged.json";

const DISPOSITIONS_FILE = "dispositions.json";

// The design model the code of the round was written from, which the next round reads for the former folder of a moved class.
const MODEL_FILE = "design-model.json";

const ROUND_FOLDER_NAME = /^[1-9]\d*$/;

const NO_FINDINGS_SWITCH = "no-findings";

const exitOnUsage = message => {
  console.error(message ? `${message}\n${USAGE}` : USAGE);
  process.exit(STOP_EXIT_CODE);
};

const readWholeNumberOrExit = (text, optionName) => {
  if (text === undefined) return null;
  if (!/^[1-9]\d*$/.test(text)) exitOnUsage(`--${optionName} takes a whole number above 0, and got ${text}`);
  return Number(text);
};

const readDollarsOrExit = text => {
  if (text === undefined) return null;
  const dollars = Number(text);
  if (!Number.isFinite(dollars) || dollars < 0) exitOnUsage(`--dollars takes a number, and got ${text}`);
  return dollars;
};

const findLastRound = roundsFolder => {
  if (!fs.existsSync(roundsFolder)) return 0;
  const rounds = fs.readdirSync(roundsFolder).filter(name => ROUND_FOLDER_NAME.test(name)).map(Number);
  return rounds.length ? Math.max(...rounds) : 0;
};

const writeJson = (filePath, value) => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

const readTextIfPresent = filePath => (fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").trim() : "");

const readTheRoundBefore = (roundsFolder, round) => {
  if (round === 1) return { previous: null, judgedBefore: null, headBefore: "", modelBefore: null };

  const folder = path.join(roundsFolder, String(round - 1));
  const judgedAbstractions = readJsonOrStop(path.join(folder, JUDGED_FILE), `round ${round - 1}`);
  const judgedBefore = new Set(judgedAbstractions.flatMap(code => code.checks.map(check => createFindingKey(code.displayName, check))));
  const modelBeforePath = path.join(folder, MODEL_FILE);
  const modelBefore = fs.existsSync(modelBeforePath) ? readDesignModelOrExit(modelBeforePath) : null;
  return { previous: readJsonOrStop(path.join(folder, COUNTS_FILE), `round ${round - 1}`), judgedBefore, headBefore: readTextIfPresent(path.join(folder, HEAD_COMMIT_FILE)), modelBefore };
};

const readFixCreated = (repositoryRoot, round, headBefore) => {
  if (round === 1) return { checked: false, why: "none, first round", files: [] };
  if (!repositoryRoot) return { checked: false, why: "not checked, no --repo", files: [] };
  if (!headBefore) return { checked: false, why: `not checked, round ${round - 1} has no ${HEAD_COMMIT_FILE}`, files: [] };
  return { checked: true, why: "", files: [...listFixCreatedFiles(repositoryRoot, headBefore)] };
};

const readChangedPlaceFinder = (repositoryRoot, resultsFolder) => {
  if (!repositoryRoot) return null;
  const baseCommit = readTextIfPresent(path.join(resultsFolder, BASE_COMMIT_FILE));
  if (!baseCommit) throw new RoundStop(`--repo needs the base commit in ${path.join(resultsFolder, BASE_COMMIT_FILE)}`);
  return createChangedPlaceFinder(repositoryRoot, baseCommit);
};

const addTheDollars = (previous, roundDollars) => {
  const soFarBefore = previous ? previous.dollars.soFar : null;
  if (soFarBefore === null && roundDollars === null) return { round: null, soFar: null };
  return { round: roundDollars, soFar: (soFarBefore || 0) + (roundDollars || 0) };
};

const findItemNumber = (run, finding) => {
  const item = run.items.find(other => other.findings.includes(finding));
  return item ? item.number : null;
};

const listMissingDispositionDefects = (run, readings) => readings
  .filter(reading => !reading.disposition && !reading.carried && reading.counted)
  .map(reading => {
    const itemNumber = findItemNumber(run, reading.finding);
    const itemWords = itemNumber === null ? "a finding that no item of review.md names" : `item ${itemNumber}`;
    return createRoundDefect(ROUND_DEFECT_CODES.DISPOSITION_MISSING, reading.finding.displayName, `${reading.finding.check} of ${itemWords} has no disposition`);
  });

const writeTheRoundFolder = (roundFolder, run, dispositions, result, headCommit, modelPath) => {
  fs.mkdirSync(roundFolder, { recursive: true });
  for (const copiedFile of run.copiedFiles) fs.copyFileSync(copiedFile, path.join(roundFolder, path.basename(copiedFile)));
  if (modelPath) fs.copyFileSync(modelPath, path.join(roundFolder, MODEL_FILE));
  writeJson(path.join(roundFolder, JUDGED_FILE), run.judgedAbstractions);
  writeJson(path.join(roundFolder, DISPOSITIONS_FILE), dispositions);
  writeJson(path.join(roundFolder, COUNTS_FILE), result);
  if (headCommit) fs.writeFileSync(path.join(roundFolder, HEAD_COMMIT_FILE), `${headCommit}\n`);
};

function recordRound() {
  const options = readOptionsOrExit(USAGE, ["results", "run", "dispositions", "model", "repo", "dollars", "round", "ceiling"], ["results", "run"], [], ["autonomous", NO_FINDINGS_SWITCH]);
  const resultsFolder = path.resolve(options.results);
  const roundsFolder = path.join(resultsFolder, ROUNDS_FOLDER);
  const lastRound = findLastRound(roundsFolder);
  const round = readWholeNumberOrExit(options.round, "round") || lastRound + 1;
  if (round > lastRound + 1) exitOnUsage(`--round ${round} skips a round: the last round is ${lastRound}`);
  const ceiling = readWholeNumberOrExit(options.ceiling, "ceiling");
  const roundDollars = readDollarsOrExit(options.dollars);
  const model = options.model ? readDesignModelOrExit(options.model) : null;
  const repositoryRoot = options.repo ? path.resolve(options.repo) : null;

  const { previous, judgedBefore, headBefore, modelBefore } = readTheRoundBefore(roundsFolder, round);
  const run = readRunFolder(path.resolve(options.run), options[NO_FINDINGS_SWITCH]);
  const { dispositions: givenDispositions, renames: givenRenames } = options.dispositions ? checkDispositionsForm(readJsonOrStop(path.resolve(options.dispositions), "dispositions")) : { dispositions: [], renames: [] };
  const headCommit = repositoryRoot ? readHeadCommit(repositoryRoot) : "";
  const fixCreated = readFixCreated(repositoryRoot, round, headBefore);
  const { dispositionOfFindingMap, defects: dispositionDefects } = resolveDispositions(givenDispositions, run.items, { model, autonomous: options.autonomous, findChangedPlace: readChangedPlaceFinder(repositoryRoot, resultsFolder) });

  const renameDefects = findGivenRenameDefects(givenRenames, model, (previous && previous.findingKeys) || []);
  const compared = compareTheRound({ run, dispositionOfFindingMap, previous, judgedBefore, model, modelBefore, round, fixCreatedFiles: fixCreated.checked ? new Set(fixCreated.files) : null, givenRenames });
  const sentBackRoundOfNameMap = new Map(Object.entries((previous && previous.sentBack) || {}));
  const sendLines = listSendLines(round, compared.openChecksBefore, compared.openChecksNow, sentBackRoundOfNameMap);
  const openAfterDesignerNames = [...compared.openChecksNow.keys()].filter(displayName => sentBackRoundOfNameMap.get(displayName) === round - 1);
  const loopLine = decideLoopLine({ round, open: compared.counts.open, ceiling, returnedKeys: compared.returnedKeys, openAfterDesignerNames, comparison: compared.comparison });
  const missingDefects = loopLine.word === LOOP_WORDS.CONTINUE ? listMissingDispositionDefects(run, compared.readings) : [];
  for (const sendLine of sendLines) sentBackRoundOfNameMap.set(sendLine.displayName, round);

  const result = {
    round,
    run: run.runFolder,
    scales: run.scales,
    judgedKeyCount: run.judgedKeys.size,
    counts: compared.counts,
    comparison: compared.comparison,
    fixCreated,
    dollars: addTheDollars(previous, roundDollars),
    notJudgedLines: compared.notJudgedLines,
    defects: [...dispositionDefects, ...renameDefects, ...compared.defects, ...missingDefects],
    sendLines,
    loopLine,
    sentBack: Object.fromEntries(sentBackRoundOfNameMap),
    filesToExclude: compared.filesToExclude,
    findingKeys: compared.findingKeys,
  };
  writeTheRoundFolder(path.join(roundsFolder, String(round)), run, [...dispositionOfFindingMap.values(), ...givenRenames], result, headCommit, options.model ? path.resolve(options.model) : null);
  for (const line of writeRoundLines(result)) console.log(line);
  process.exit(result.defects.length ? 1 : 0);
}

try {
  recordRound();
} catch (error) {
  if (!(error instanceof RoundStop)) throw error;
  console.error(error.message);
  process.exit(STOP_EXIT_CODE);
}
