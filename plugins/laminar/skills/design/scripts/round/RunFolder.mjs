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

const readFinding = (result, index) => {
  const properties = result.properties || {};
  const displayName = String(properties.abstraction || "");
  const check = String(properties.check || result.ruleId || "");
  return {
    index,
    displayName,
    check,
    findingKey: createFindingKey(displayName, check),
    scale: String(properties.scale || "").toLowerCase(),
    places: readPlaces(result),
    testCode: properties.test_code === true,
    text: String((result.message || {}).text || ""),
  };
};

const readFindingsOfTheSarif = sarif => (sarif.runs || []).flatMap(run => run.results || []).map(readFinding);

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

// Each finding of review.sarif joins the first item of review.md whose head names it, because review.sarif carries no item number.
const joinFindingsToItems = (items, findings) => items.map(item => ({
  number: item.number,
  findings: findings.filter(finding => isTheItemOfTheFinding(item, finding) && items.find(other => isTheItemOfTheFinding(other, finding)) === item),
}));

export const readRunFolder = (runFolder, hasNoFindings) => {
  const prepare = readJsonOrStop(path.join(runFolder, PREPARE_FILE), "run folder");
  const judgedAbstractions = listJudgedAbstractions(prepare);
  const judgedKeys = new Set(judgedAbstractions.flatMap(code => code.checks.map(check => createFindingKey(code.displayName, check))));
  const scales = orderTheScales(new Set(judgedAbstractions.map(code => code.scale)));

  const sarifPath = path.join(runFolder, SARIF_FILE);
  const reviewPath = path.join(runFolder, REVIEW_FILE);
  if (hasNoFindings) return { runFolder, judgedAbstractions, judgedKeys, scales, findings: [], items: [], copiedFiles: [] };
  if (!fs.existsSync(sarifPath)) throw new RoundStop(`run folder: ${runFolder} holds no ${SARIF_FILE}; pass --no-findings where the run kept nothing`);

  const findings = readFindingsOfTheSarif(readJsonOrStop(sarifPath, "run folder"));
  const reviewText = fs.existsSync(reviewPath) ? fs.readFileSync(reviewPath, "utf8") : "";
  const items = joinFindingsToItems(readNamedReviewItems(reviewText), findings);
  const copiedFiles = [sarifPath, ...(reviewText ? [reviewPath] : [])];
  return { runFolder, judgedAbstractions, judgedKeys, scales, findings, items, copiedFiles };
};
