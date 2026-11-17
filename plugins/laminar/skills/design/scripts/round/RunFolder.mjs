import fs from "node:fs";
import path from "node:path";
import { readNamedReviewItems } from "../check/ReviewItems.mjs";

export const REVIEW_FILE = "review.md";

export const SARIF_FILE = "review.sarif";

const PREPARE_FILE = "prepare.json";

const SCALE_ORDER = Object.freeze(["application", "module", "class", "method", "variable"]);

export const PLACEMENT_SCALES = new Set(["application", "module"]);

const METHOD_MARK = "#";

// The review prints a variable as `<name> in <enclosing>`, so the enclosing abstraction follows this mark.
const ENCLOSING_MARK = " in ";

export class RoundStop extends Error {}

export const createFindingKey = (displayName, check) => `${displayName}${METHOD_MARK}${METHOD_MARK}${check}`;

export const readJsonOrStop = (filePath, label) => {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new RoundStop(`${label}: cannot read ${filePath}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new RoundStop(`${label}: ${filePath} is no JSON: ${error.message}`);
  }
};

const orderTheScales = scales => SCALE_ORDER.filter(scale => scales.has(scale));

const listJudgedAbstractions = prepare => (Array.isArray(prepare.codeUnderReview) ? prepare.codeUnderReview : [])
  .map(code => ({ displayName: String(code.displayName || ""), scale: String(code.scale || "").toLowerCase(), checks: (code.checks || []).map(check => String(check.id)) }))
  .filter(code => code.displayName);

// SARIF names the places of a result under these keys: a list, then the file and the region of each.
const SARIF_PLACE_KEYS = Object.freeze({ LIST: "locations", PHYSICAL: "physicalLocation", FILE: "artifactLocation" });

const readPlaces = result => (result[SARIF_PLACE_KEYS.LIST] || []).map(sarifPlace => {
  const physical = sarifPlace[SARIF_PLACE_KEYS.PHYSICAL] || {};
  const line = (physical.region || {}).startLine;
  return { file: String((physical[SARIF_PLACE_KEYS.FILE] || {}).uri || ""), line: Number.isFinite(line) ? line : null };
});

// A result the merge combined at 1 line holds every check it combines under rule_ids, its first check under check.
const readChecksOfTheResult = (properties, check) => (Array.isArray(properties.rule_ids) && properties.rule_ids.length ? properties.rule_ids.map(String) : [check]);

const readFinding = (result, index) => {
  const properties = result.properties || {};
  const displayName = String(properties.abstraction || "");
  const check = String(properties.check || result.ruleId || "");
  return {
    index,
    displayName,
    check,
    checks: readChecksOfTheResult(properties, check),
    findingKey: createFindingKey(displayName, check),
    scale: String(properties.scale || "").toLowerCase(),
    places: readPlaces(result),
    testCode: properties.test_code === true,
    toConsider: properties.to_consider === true,
    text: String((result.message || {}).text || ""),
  };
};

const readResultsOfTheSarif = sarif => (sarif.runs || []).flatMap(run => run.results || []);

const SUPPRESSION_STATUSES = Object.freeze({ DECIDED: "accepted", CHANGED_SINCE: "underReview" });

const holdsASuppressionOfTheStatus = (result, status) => (result.suppressions || []).some(suppression => suppression.status === status);

// A result that the decided review file of the design marked carries an accepted suppression, and 1 decided but changed since the decision an underReview one; neither joins an item or enters a count.
const isDecidedByTheDesign = result => holdsASuppressionOfTheStatus(result, SUPPRESSION_STATUSES.DECIDED);

const isDecidedButChangedSince = result => holdsASuppressionOfTheStatus(result, SUPPRESSION_STATUSES.CHANGED_SINCE);

const readFindingsOfTheSarif = results => results.map(readFinding).filter((finding, index) => !isDecidedByTheDesign(results[index]) && !isDecidedButChangedSince(results[index]));

const readPropertiesOfTheDecision = result => ((result.suppressions || []).find(suppression => Object.values(SUPPRESSION_STATUSES).includes(suppression.status)) || {}).properties || {};

// The check of the decision tells which check of a combined result the design decided; a render before it carried that check gives none. The display name of the decision is its key, which differs from the result's own where the decision marked it by the class of its method or by a former name. Only a result decided but changed since carries the lines fingerprint of its lines as this run read them.
const readDecidedFinding = (result, index) => {
  const decision = readPropertiesOfTheDecision(result);
  return {
    ...readFinding(result, index),
    reason: String(decision.reason || ""),
    checkOfTheDecision: String(decision.check || ""),
    displayNameOfTheDecision: String(decision.displayName || ""),
    matchedBy: String(decision.matchedBy || ""),
    linesFingerprintNow: String(decision.linesFingerprintNow || ""),
  };
};

const readDecidedFindingsOfTheSarif = (results, isOfTheGroup) => results
  .map(readDecidedFinding)
  .filter((finding, index) => isOfTheGroup(results[index]));

// The head of an item as the review prints it: the name, and the enclosing abstraction where the display name holds one.
const readHeadOfTheFinding = finding => {
  const { displayName } = finding;
  const enclosingAt = displayName.indexOf(ENCLOSING_MARK);
  const methodAt = displayName.indexOf(METHOD_MARK);
  if (enclosingAt >= 0 && (methodAt < 0 || enclosingAt < methodAt)) {
    return { name: displayName.slice(0, enclosingAt), enclosing: displayName.slice(enclosingAt + ENCLOSING_MARK.length) };
  }
  if (methodAt >= 0) return { name: displayName.slice(methodAt + 1), enclosing: displayName.slice(0, methodAt) };
  return { name: displayName, enclosing: "" };
};

const isTheItemOfTheFinding = (item, finding) => {
  const head = readHeadOfTheFinding(finding);
  const shownEnclosing = head.enclosing && head.enclosing !== head.name && !head.name.startsWith(`${head.enclosing}.`) ? head.enclosing : "";
  return item.scale === finding.scale && item.name === head.name && item.enclosing === shownEnclosing;
};

// review.sarif carries no item number and lists its results in the order of the items of review.md, so each finding joins the first item whose head names it at or after the item of the finding before; 2 checks on 1 class in 2 sections of review.md so keep their 2 numbers.
const joinFindingsToItems = (items, findings) => {
  const findingsOfItemMap = new Map(items.map(item => [item, []]));
  let itemAt = 0;
  for (const finding of findings) {
    const laterAt = items.findIndex((item, at) => at >= itemAt && isTheItemOfTheFinding(item, finding));
    const joinedAt = laterAt >= 0 ? laterAt : items.findIndex(item => isTheItemOfTheFinding(item, finding));
    if (joinedAt < 0) continue;

    findingsOfItemMap.get(items[joinedAt]).push(finding);
    itemAt = joinedAt;
  }
  return items.map(item => ({ number: item.number, findings: findingsOfItemMap.get(item) }));
};

// The finding keys of a run folder, also of the results it set apart; none where its review.sarif cannot be read.
const readFindingKeysOfTheRun = runFolder => {
  try {
    return new Set(readResultsOfTheSarif(JSON.parse(fs.readFileSync(path.join(runFolder, SARIF_FILE), "utf8"))).map(readFinding).map(finding => finding.findingKey));
  } catch {
    return new Set();
  }
};

const listTheRunsBeside = runFolder => {
  const parentFolder = path.dirname(runFolder);
  return fs.readdirSync(parentFolder, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(parentFolder, entry.name))
    .filter(otherRun => otherRun !== runFolder && fs.existsSync(path.join(otherRun, SARIF_FILE)))
    .sort();
};

const ROUND_FOLDER_NAME = /^[1-9]\d*$/;

const readTextIfPresent = filePath => (fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null);

const listRecordedRounds = roundsFolder => (fs.existsSync(roundsFolder)
  ? fs.readdirSync(roundsFolder).filter(name => ROUND_FOLDER_NAME.test(name)).map(Number).sort((first, second) => first - second)
  : []);

// The round of a run folder as the round script counts it in the rounds folder of the results folder: the round whose copy of review.sarif equals that of the run, else the round after the last, because the finish command reads a run before the round script records it; null where the folder holds no round, because then only the caller counts the rounds.
export const findTheRoundOfTheRun = (roundsFolder, runFolder) => {
  const rounds = listRecordedRounds(roundsFolder);
  if (!rounds.length) return null;

  const sarifText = readTextIfPresent(path.join(runFolder, SARIF_FILE));
  const recordedRounds = rounds.filter(round => sarifText !== null && readTextIfPresent(path.join(roundsFolder, String(round), SARIF_FILE)) === sarifText);
  return recordedRounds.length ? recordedRounds.at(-1) : rounds.at(-1) + 1;
};

// The run folder beside the given one whose review.sarif holds a finding key, so a decided list given with the wrong run names the run it belongs to; read only once a key is missing.
export const createFinderOfTheRunHoldingTheKey = givenRunFolder => {
  const runFolder = path.resolve(givenRunFolder);
  let keysOfRunMap = null;
  return (displayName, check) => {
    keysOfRunMap ??= new Map(listTheRunsBeside(runFolder).map(otherRun => [otherRun, readFindingKeysOfTheRun(otherRun)]));
    const findingKey = createFindingKey(displayName, check);
    const holdingRun = [...keysOfRunMap].find(([, findingKeys]) => findingKeys.has(findingKey));
    return holdingRun ? holdingRun[0] : "";
  };
};

export const readRunFolder = (runFolder, hasNoFindings) => {
  const prepare = readJsonOrStop(path.join(runFolder, PREPARE_FILE), "run folder");
  const judgedAbstractions = listJudgedAbstractions(prepare);
  const judgedKeys = new Set(judgedAbstractions.flatMap(code => code.checks.map(check => createFindingKey(code.displayName, check))));
  const scales = orderTheScales(new Set(judgedAbstractions.map(code => code.scale)));

  const sarifPath = path.join(runFolder, SARIF_FILE);
  const reviewPath = path.join(runFolder, REVIEW_FILE);
  if (hasNoFindings) return { runFolder, judgedAbstractions, judgedKeys, scales, findings: [], decidedFindings: [], changedSinceFindings: [], items: [], copiedFiles: [] };
  if (!fs.existsSync(sarifPath)) throw new RoundStop(`run folder: ${runFolder} holds no ${SARIF_FILE}; pass --no-findings where the run kept nothing`);

  const results = readResultsOfTheSarif(readJsonOrStop(sarifPath, "run folder"));
  const findings = readFindingsOfTheSarif(results);
  const reviewText = fs.existsSync(reviewPath) ? fs.readFileSync(reviewPath, "utf8") : "";
  const items = joinFindingsToItems(readNamedReviewItems(reviewText), findings);
  const copiedFiles = [sarifPath, ...(reviewText ? [reviewPath] : [])];
  return {
    runFolder, judgedAbstractions, judgedKeys, scales, findings,
    decidedFindings: readDecidedFindingsOfTheSarif(results, isDecidedByTheDesign),
    changedSinceFindings: readDecidedFindingsOfTheSarif(results, isDecidedButChangedSince),
    items, copiedFiles,
  };
};
