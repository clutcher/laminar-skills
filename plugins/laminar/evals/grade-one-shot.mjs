#!/usr/bin/env node
// Grades 1 run of a one-shot case of the design evals: what stays open on the change after 1 design, 1 writing pass with its self-check and 1 full review.
//
//   node grade-one-shot.mjs --results <design results folder> [--review <review run folder> --repo <fixture> --range <a>...<b>] [--input-review <stored input review run folder> --expected <expected.md of the planted change>] [--build <build file>] [--usage <usage.json> ...] [--json <out>]
//
// --review, --repo and --range are needed where plan 1 ended ready; a plan that ended in a question or a stop starts no writer and no review.
// --input-review is given for the fix-from-review input: each kept finding of the stored input review is then graded as closed, left, decided again or back, and --expected gives the planted keys that split the kept findings of the closing review.
// It exits with 0 where the run is one shot, 1 where it is not, and 2 on a usage error or a missing file. It writes nothing but --json, and runs git only in --repo.
// Node with no dependencies.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CHECKS_BY_ID_MAP } from "../skills/review/scripts/checks/CheckCatalog.mjs";
import { findCheckWords } from "../skills/review/scripts/checks/CheckWords.mjs";
import { createFindingKey, readRunFolder, RoundStop } from "../skills/design/scripts/round/RunFolder.mjs";

const USAGE = "usage: node grade-one-shot.mjs --results <design results folder> [--review <review run folder> --repo <fixture> --range <a>...<b>] [--input-review <stored input review run folder> --expected <expected.md of the planted change>] [--build <build file>] [--usage <usage.json> ...] [--json <out>]";

const EXIT_CODES = Object.freeze({ ONE_SHOT: 0, NOT_ONE_SHOT: 1, USAGE: 2 });

const SCALES = Object.freeze(["application", "module", "class", "method", "variable"]);

const PLACEMENTS = Object.freeze({
  ON_THE_CHANGE: "on the change",
  NOT_ON_THE_CHANGE: "not on the change",
  NOT_NEW: "not new",
  DECIDED: "decided by the design",
  LEFT: "left with a reason",
});

const STORED_STATES = Object.freeze({ CLOSED: "closed", LEFT: "left", DECIDED: "decided again", BACK: "back" });

// Who left a finding key: the decided list of the calling session, where the object or the entry has decidedBy, or the design by its own reason class.
const LEFT_SOURCES = Object.freeze({ DECIDED_LIST: "by the decided list", DESIGN: "by the design" });

// How a kept finding on the change of a fix-from-review run relates to the stored input review.
const KEY_KINDS = Object.freeze({ PLANTED: "on planted keys", DECIDED_BACK: "decided, back under a new key", OTHER: "other" });

const GROUP_OUTCOMES = Object.freeze({ FINISHED: "finished", STOPPED: "stopped", NOT_STARTED: "not started", NO_ANSWER: "no answer" });

const STOP_WITHOUT_A_REASON = "stopped-without-a-reason";

const BUILD_FAILED = "failed";

const PLAN_READY = "ready";

const KEPT_LEVEL = "warning";

// A result the decided review file of the design marked carries this suppression status, and the grade counts it apart, never as kept on the change.
const ACCEPTED_SUPPRESSION = "accepted";

const NEW_BASELINE_STATE = "new";

const RESULTS_FILES = Object.freeze({
  WRITERS_RETURN: "writers-return.json",
  OUTCOME: path.join("plans", "1", "outcome.json"),
  SELF_CHECK: path.join("plans", "1", "self-check.json"),
  ROUND_COUNTS: path.join("rounds", "1", "counts.json"),
  DESIGN_MODEL: "design-model.json",
  FINDINGS: "findings.json",
  SHAPE_RUNS: "shape-runs",
});

const SARIF_FILE = "review.sarif";
const PREPARE_FILE = "prepare.json";

// The 2 lines of the build file that the harness writes after its test run of the head of the change.
const BUILD_LINE = /^build:\s*(passed|failed)\s*$/m;
const TESTS_LINE = /^tests:\s*(\d+)\s+run,\s*(\d+)\s+failed\s*$/m;

const USAGE_FILE_NAME = /^usage-(.+)\.json$/;

// An item of expected.md names its abstraction in its head, and its check by the lead of its first point; the planted defects end at the level 1 lines.
const PLANTED_ITEM_HEAD = /^\d+\.\s+(?:Application|Module|Class|Method|Variable)\s+`([^`]+)`/;
const PLANTED_CHECK_POINT = /^\s+-\s+(.+?)\s*$/;
const LEVEL_1_HEAD = "## Level 1";

const RENAME_STATUS = /^R\d*$/;

const HUNK_HEAD = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
const NEW_FILE_HEAD = /^\+\+\+ b\/(.+)$/;

class UsageStop extends Error {}

const readOptions = argv => {
  const options = { usage: [] };
  const valueKeys = new Map([["--results", "results"], ["--review", "review"], ["--repo", "repo"], ["--range", "range"], ["--input-review", "inputReview"], ["--expected", "expected"], ["--build", "build"], ["--json", "json"]]);
  for (let at = 0; at < argv.length; at++) {
    const name = argv[at];
    const value = argv[at + 1];
    if (!value || value.startsWith("--")) throw new UsageStop(`${name} needs a value`);
    if (name === "--usage") options.usage.push(value);
    else if (valueKeys.has(name)) options[valueKeys.get(name)] = value;
    else throw new UsageStop(`unknown option ${name}`);
    at++;
  }
  if (!options.results) throw new UsageStop("--results is needed");
  if (options.inputReview && !options.expected) throw new UsageStop("--input-review needs --expected, the expected.md of the planted change");

  return options;
};

const readJson = (filePath, label) => {
  if (!fs.existsSync(filePath)) throw new UsageStop(`${label}: ${filePath} is missing`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new UsageStop(`${label}: ${filePath} is no JSON: ${error.message}`);
  }
};

const readJsonIfPresent = filePath => (fs.existsSync(filePath) ? readJson(filePath, path.basename(filePath)) : null);

const runGit = (repository, args) => {
  const answered = spawnSync("git", args, { cwd: repository, encoding: "utf8", maxBuffer: 1 << 26 });
  if (answered.status !== 0) throw new UsageStop(`git ${args.join(" ")} failed in ${repository}: ${String(answered.stderr).trim()}`);
  return answered.stdout;
};

// The files of the range with their status, and per file the line spans of the new side that the change added or changed.
const readChangeOfTheRange = (repository, range) => {
  const statusOfFileMap = new Map();
  for (const line of runGit(repository, ["diff", "--name-status", "--no-renames", range]).split("\n").filter(Boolean)) {
    const [status, filePath] = line.split("\t");
    statusOfFileMap.set(filePath, status);
  }

  const changedSpansOfFileMap = new Map();
  let spans = null;
  for (const line of runGit(repository, ["diff", "-U0", "--no-renames", range]).split("\n")) {
    const newFile = NEW_FILE_HEAD.exec(line);
    if (newFile) {
      spans = [];
      changedSpansOfFileMap.set(newFile[1], spans);
      continue;
    }
    const hunk = HUNK_HEAD.exec(line);
    if (hunk && spans) spans.push(readSpanOfTheHunk(hunk));
  }
  return { statusOfFileMap, changedSpansOfFileMap };
};

// The new path of each file that git reports renamed in the range, by its old path.
const readRenamedPathOfFileMap = (repository, range) => {
  const renamedPathOfFileMap = new Map();
  for (const line of runGit(repository, ["diff", "--name-status", "-M", range]).split("\n").filter(Boolean)) {
    const [status, oldPath, newPath] = line.split("\t");
    if (RENAME_STATUS.test(status)) renamedPathOfFileMap.set(oldPath, newPath);
  }
  return renamedPathOfFileMap;
};

const readSpanOfTheHunk = hunk => {
  const from = Number(hunk[1]);
  const lineCount = hunk[2] === undefined ? 1 : Number(hunk[2]);
  return { from, to: from + lineCount - 1 };
};

const readFindingsOfTheSarif = sarifPath => {
  const sarif = readJson(sarifPath, "review");
  return (sarif.runs || []).flatMap(run => run.results || []).map(readFinding);
};

const readFinding = result => {
  const properties = result.properties || {};
  const location = ((result.locations || [])[0] || {}).physicalLocation || {};
  const displayName = String(properties.abstraction || "");
  const check = String(properties.check || result.ruleId || "");
  return {
    displayName,
    check,
    findingKey: createFindingKey(displayName, check),
    scale: String(properties.scale || "").toLowerCase(),
    kept: result.level === KEPT_LEVEL && properties.to_consider !== true,
    testCode: properties.test_code === true,
    baselineState: result.baselineState || NEW_BASELINE_STATE,
    decided: (result.suppressions || []).some(suppression => suppression.status === ACCEPTED_SUPPRESSION),
    file: String((location.artifactLocation || {}).uri || ""),
    line: Number.isFinite((location.region || {}).startLine) ? location.region.startLine : null,
    track: CHECKS_BY_ID_MAP[check] ? CHECKS_BY_ID_MAP[check].track : "UNKNOWN",
  };
};

const holdsAChangedFile = (folder, change) => [...change.statusOfFileMap.keys()].some(filePath => filePath.startsWith(`${folder}/`));

const isInAChangedSpan = (finding, change) => (change.changedSpansOfFileMap.get(finding.file) || []).some(span => finding.line >= span.from && finding.line <= span.to);

// A finding stands on the change where its file is added, its start line falls in a changed span, its class stands in a changed file, its folder holds a changed file, or it judges the application of a change.
const isOnTheChange = (finding, change) => {
  if (finding.scale === "application") return change.statusOfFileMap.size > 0;
  if (finding.scale === "module") return holdsAChangedFile(finding.file, change) || change.statusOfFileMap.has(finding.file);

  const status = change.statusOfFileMap.get(finding.file);
  if (status === "A") return true;
  if (finding.scale === "class") return Boolean(status);

  return finding.line !== null && isInAChangedSpan(finding, change);
};

const placeTheFinding = (finding, change, leftSourceOfKeyMap) => {
  if (finding.decided) return PLACEMENTS.DECIDED;
  if (finding.baselineState !== NEW_BASELINE_STATE) return PLACEMENTS.NOT_NEW;
  if (leftSourceOfKeyMap.has(finding.findingKey)) return PLACEMENTS.LEFT;

  return isOnTheChange(finding, change) ? PLACEMENTS.ON_THE_CHANGE : PLACEMENTS.NOT_ON_THE_CHANGE;
};

const createScaleCounts = () => Object.fromEntries(SCALES.map(scale => [scale, 0]));

const countTheKeptFindings = keptOnTheChange => {
  const byScale = createScaleCounts();
  const byTrack = {};
  let testCode = 0;
  for (const finding of keptOnTheChange) {
    byScale[finding.scale] = (byScale[finding.scale] || 0) + 1;
    byTrack[finding.track] = (byTrack[finding.track] || 0) + 1;
    if (finding.testCode) testCode++;
  }
  return { total: keptOnTheChange.length, byScale, testCode, byTrack };
};

const countThePlacements = findings => {
  const countOfPlacementMap = {};
  for (const finding of findings) countOfPlacementMap[finding.placement] = (countOfPlacementMap[finding.placement] || 0) + 1;
  return countOfPlacementMap;
};

const gradeTheReview = (options, leftSourceOfKeyMap) => {
  const change = readChangeOfTheRange(options.repo, options.range);
  const findings = readFindingsOfTheSarif(path.join(options.review, SARIF_FILE)).map(finding => ({ ...finding, placement: placeTheFinding(finding, change, leftSourceOfKeyMap) }));
  const onTheChange = findings.filter(finding => finding.placement === PLACEMENTS.ON_THE_CHANGE);
  const keptOnTheChange = onTheChange.filter(finding => finding.kept);
  return {
    run: options.review,
    findings,
    kept: countTheKeptFindings(keptOnTheChange),
    keptOnTheChange,
    toConsiderOnTheChange: onTheChange.length - keptOnTheChange.length,
    apart: countThePlacements(findings.filter(finding => finding.placement !== PLACEMENTS.ON_THE_CHANGE)),
  };
};

const readStopReason = group => (group.stop && group.stop.reason ? group.stop.reason : STOP_WITHOUT_A_REASON);

const hasAFailedBuild = group => Boolean(group.build) && group.build.result === BUILD_FAILED;

const isAStop = group => group.outcome !== GROUP_OUTCOMES.FINISHED || hasAFailedBuild(group);

const describeSelfCheck = (group, selfCheckOfGroupMap) => {
  const selfCheck = selfCheckOfGroupMap.get(group.group) || group.selfCheck || {};
  if (selfCheck.notRun) return { notRun: selfCheck.notRun };

  return {
    kept: Array.isArray(selfCheck.kept) ? selfCheck.kept.length : 0,
    fixed: Number(selfCheck.fixed) || 0,
    recorded: selfCheck.recorded || {},
    needsModelChange: Array.isArray(selfCheck.needsModelChange) ? selfCheck.needsModelChange.length : 0,
  };
};

const gradeTheWriters = results => {
  const writersReturn = readJsonIfPresent(path.join(results, RESULTS_FILES.WRITERS_RETURN));
  if (!writersReturn) return { ran: false, groups: [], counts: {}, stopsByReason: {}, stops: 0, buildFailed: 0, filled: 0 };

  const selfCheckList = readJsonIfPresent(path.join(results, RESULTS_FILES.SELF_CHECK)) || [];
  const selfCheckOfGroupMap = new Map(selfCheckList.map(selfCheck => [selfCheck.group, selfCheck]));
  const groups = (writersReturn.groups || []).map(group => ({
    group: group.group,
    outcome: group.outcome,
    stop: group.outcome === GROUP_OUTCOMES.FINISHED ? null : readStopReason(group),
    buildFailed: hasAFailedBuild(group),
    filled: Array.isArray(group.filled) ? group.filled.length : 0,
    selfCheck: describeSelfCheck(group, selfCheckOfGroupMap),
  }));
  return {
    ran: true,
    groups,
    counts: countTheOutcomes(groups),
    stopsByReason: countTheStopReasons(groups),
    stops: (writersReturn.groups || []).filter(isAStop).length,
    buildFailed: groups.filter(group => group.buildFailed).length,
    filled: groups.reduce((sum, group) => sum + group.filled, 0),
  };
};

const countTheOutcomes = groups => {
  const counts = Object.fromEntries(Object.values(GROUP_OUTCOMES).map(outcome => [outcome, 0]));
  for (const group of groups) counts[group.outcome] = (counts[group.outcome] || 0) + 1;
  return counts;
};

const countTheStopReasons = groups => {
  const countOfReasonMap = {};
  for (const group of groups.filter(other => other.stop)) countOfReasonMap[group.stop] = (countOfReasonMap[group.stop] || 0) + 1;
  return countOfReasonMap;
};

const gradeTheBuild = buildFile => {
  if (!buildFile) return { result: "not run", testsRun: 0, testsFailed: 0 };
  if (!fs.existsSync(buildFile)) throw new UsageStop(`build: ${buildFile} is missing`);

  const text = fs.readFileSync(buildFile, "utf8");
  const build = BUILD_LINE.exec(text);
  const tests = TESTS_LINE.exec(text);
  if (!build || !tests) throw new UsageStop(`build: ${buildFile} holds no line "build: passed|failed" and no line "tests: <n> run, <n> failed"`);

  return { result: build[1], testsRun: Number(tests[1]), testsFailed: Number(tests[2]) };
};

const isAPassingBuild = build => build.result === "passed" && build.testsRun > 0 && build.testsFailed === 0;

const countTheShapeRuns = results => {
  const shapeRuns = path.join(results, RESULTS_FILES.SHAPE_RUNS);
  if (!fs.existsSync(shapeRuns)) return 0;

  return fs.readdirSync(shapeRuns, { withFileTypes: true }).filter(entry => entry.isDirectory()).length;
};

const readTheRoundLine = results => {
  const counts = readJsonIfPresent(path.join(results, RESULTS_FILES.ROUND_COUNTS));
  if (!counts) return null;

  const loopLine = counts.loopLine || {};
  return { open: (counts.counts || {}).open, loop: [loopLine.word, loopLine.code].filter(Boolean).join(" ") };
};

const readTheCost = usageFiles => {
  const parts = usageFiles.map(usageFile => {
    const usage = readJson(usageFile, "usage");
    const named = USAGE_FILE_NAME.exec(path.basename(usageFile));
    return { part: named ? named[1] : path.basename(usageFile), dollars: Number(usage.dollars) || 0, agents: Number(usage.agents) || 0, newTokens: Number(usage.new_tokens) || 0 };
  });
  return {
    parts,
    dollars: parts.reduce((sum, part) => sum + part.dollars, 0),
    agents: parts.reduce((sum, part) => sum + part.agents, 0),
    newTokens: parts.reduce((sum, part) => sum + part.newTokens, 0),
  };
};

const readLeftSource = left => (left.decidedBy ? LEFT_SOURCES.DECIDED_LIST : LEFT_SOURCES.DESIGN);

// A key that both the decided list and the design leave counts as left by the decided list.
const addTheLeftKey = (leftSourceOfKeyMap, findingKey, source) => {
  if (leftSourceOfKeyMap.get(findingKey) === LEFT_SOURCES.DECIDED_LIST) return;

  leftSourceOfKeyMap.set(findingKey, source);
};

// The finding keys of the stored input review that the design leaves on purpose, each with who left it: an object of decisions.findings with a reason class, or an entry of findings.json with one.
const readLeftSourceOfKeyMap = (results, inputRun) => {
  const leftSourceOfKeyMap = new Map();
  const model = readJsonIfPresent(path.join(results, RESULTS_FILES.DESIGN_MODEL));
  const leftObjects = ((model && model.decisions && model.decisions.findings) || []).filter(object => object.run === undefined && object.reason);
  for (const item of inputRun.items) {
    for (const object of leftObjects.filter(left => left.number === item.number)) {
      for (const finding of item.findings.filter(other => object.check === undefined || other.check === object.check)) addTheLeftKey(leftSourceOfKeyMap, finding.findingKey, readLeftSource(object));
    }
  }

  const entries = readJsonIfPresent(path.join(results, RESULTS_FILES.FINDINGS)) || [];
  for (const entry of entries.filter(other => other.reason)) addTheLeftKey(leftSourceOfKeyMap, createFindingKey(entry.displayName, entry.check), readLeftSource(entry));
  return leftSourceOfKeyMap;
};

const countTheLeftSources = sources => Object.fromEntries(Object.values(LEFT_SOURCES).map(source => [source, sources.filter(other => other === source).length]));

const readThePlantedKeys = expectedFile => {
  if (!fs.existsSync(expectedFile)) throw new UsageStop(`expected: ${expectedFile} is missing`);

  const plantedKeys = new Set();
  let displayName = "";
  for (const line of fs.readFileSync(expectedFile, "utf8").split("\n")) {
    if (line.startsWith(LEVEL_1_HEAD)) break;
    const head = PLANTED_ITEM_HEAD.exec(line);
    if (head) {
      displayName = head[1];
      continue;
    }
    const point = PLANTED_CHECK_POINT.exec(line);
    if (point && displayName) {
      const checkWords = findCheckWords(point[1]);
      plantedKeys.add(createFindingKey(displayName, checkWords ? checkWords.id : point[1]));
      displayName = "";
    }
  }
  return plantedKeys;
};

const findTheDecidedFinding = (finding, backSearch) => backSearch.decidedFindings.find(decided => decided.check === finding.check
  && (decided.file === finding.file || backSearch.renamedPathOfFileMap.get(decided.file) === finding.file));

// A kept finding on the change is decided, back under a new key, where its key is no planted key and it has the check and the file, or the renamed file, of a stored finding the decided list left.
const markTheKeyKind = (finding, backSearch) => {
  if (backSearch.plantedKeys.has(finding.findingKey)) return { ...finding, keyKind: KEY_KINDS.PLANTED };

  const decidedFinding = findTheDecidedFinding(finding, backSearch);
  return decidedFinding ? { ...finding, keyKind: KEY_KINDS.DECIDED_BACK, decidedFinding } : { ...finding, keyKind: KEY_KINDS.OTHER };
};

const markTheKeyKinds = (review, backSearch) => ({ ...review, keptOnTheChange: review.keptOnTheChange.map(finding => markTheKeyKind(finding, backSearch)) });

const countTheKeyKinds = keptOnTheChange => Object.fromEntries(Object.values(KEY_KINDS).map(keyKind => [keyKind, keptOnTheChange.filter(finding => finding.keyKind === keyKind).length]));

const readStoredKeptFindings = inputRun => readFindingsOfTheSarif(path.join(inputRun.runFolder, SARIF_FILE)).filter(finding => finding.kept);

const readKeptKeys = review => new Set(review.findings.filter(finding => finding.kept && !finding.decided).map(finding => finding.findingKey));

const readJudgedKeys = reviewFolder => {
  const prepare = readJsonIfPresent(path.join(reviewFolder, PREPARE_FILE));
  if (!prepare) return null;

  return new Set((prepare.codeUnderReview || []).flatMap(code => (code.checks || []).map(check => createFindingKey(String(code.displayName || ""), String(check.id)))));
};

const readDecidedKeys = review => new Set(review.findings.filter(finding => finding.decided).map(finding => finding.findingKey));

// A stored finding the closing review marks decided again is the decision carried, before it counts as left.
const decideTheStoredState = (finding, leftSourceOfKeyMap, keptKeys, decidedKeys) => {
  if (decidedKeys.has(finding.findingKey)) return STORED_STATES.DECIDED;
  if (leftSourceOfKeyMap.has(finding.findingKey)) return STORED_STATES.LEFT;

  return keptKeys.has(finding.findingKey) ? STORED_STATES.BACK : STORED_STATES.CLOSED;
};

const gradeTheStoredFindings = (storedKept, leftSourceOfKeyMap, review) => {
  const keptKeys = review ? readKeptKeys(review) : new Set();
  const decidedKeys = review ? readDecidedKeys(review) : new Set();
  const judgedKeys = review ? readJudgedKeys(review.run) : null;
  const findings = storedKept.map(finding => ({
    displayName: finding.displayName,
    check: finding.check,
    scale: finding.scale,
    state: decideTheStoredState(finding, leftSourceOfKeyMap, keptKeys, decidedKeys),
    judgedAgain: judgedKeys ? judgedKeys.has(finding.findingKey) : null,
  }));
  const counts = Object.fromEntries(Object.values(STORED_STATES).map(state => [state, findings.filter(finding => finding.state === state).length]));
  const leftBySource = countTheLeftSources(storedKept.filter((finding, index) => findings[index].state === STORED_STATES.LEFT).map(finding => leftSourceOfKeyMap.get(finding.findingKey)));
  return {
    counts,
    leftBySource,
    closingLeftBySource: review ? countTheLeftSources(review.findings.filter(finding => finding.placement === PLACEMENTS.LEFT).map(finding => leftSourceOfKeyMap.get(finding.findingKey))) : null,
    keptByKey: review ? countTheKeyKinds(review.keptOnTheChange) : null,
    findings,
  };
};

const readTheBackSearch = (options, storedKept, leftSourceOfKeyMap) => ({
  plantedKeys: readThePlantedKeys(options.expected),
  decidedFindings: storedKept.filter(finding => leftSourceOfKeyMap.get(finding.findingKey) === LEFT_SOURCES.DECIDED_LIST),
  renamedPathOfFileMap: readRenamedPathOfFileMap(options.repo, options.range),
});

const decideNothingOpen = grade => grade.planOutcome === PLAN_READY
  && grade.writers.ran && grade.writers.groups.length > 0 && grade.writers.stops === 0
  && isAPassingBuild(grade.build)
  && grade.review !== null && grade.review.kept.total === 0
  && (!grade.stored || grade.stored.counts[STORED_STATES.BACK] === 0);

const gradeTheRun = options => {
  const outcome = readJson(path.join(options.results, RESULTS_FILES.OUTCOME), "plan");
  const planOutcome = String(outcome.outcome || "");
  const needsTheReview = planOutcome === PLAN_READY;
  if (needsTheReview && (!options.review || !options.repo || !options.range)) throw new UsageStop("plan 1 ended ready, so --review, --repo and --range are needed");

  const inputRun = options.inputReview ? readRunFolder(path.resolve(options.inputReview), false) : null;
  const leftSourceOfKeyMap = inputRun ? readLeftSourceOfKeyMap(options.results, inputRun) : new Map();
  const storedKept = inputRun ? readStoredKeptFindings(inputRun) : [];
  const closingReview = options.review ? gradeTheReview(options, leftSourceOfKeyMap) : null;
  const review = closingReview && inputRun ? markTheKeyKinds(closingReview, readTheBackSearch(options, storedKept, leftSourceOfKeyMap)) : closingReview;
  const grade = {
    input: inputRun ? "fix-from-review" : "feature",
    planOutcome,
    shapeRuns: countTheShapeRuns(options.results),
    writers: gradeTheWriters(options.results),
    build: gradeTheBuild(options.build),
    review,
    stored: inputRun ? gradeTheStoredFindings(storedKept, leftSourceOfKeyMap, review) : null,
    olderRule: readTheRoundLine(options.results),
    cost: readTheCost(options.usage),
  };
  grade.oneShot = decideNothingOpen(grade);
  grade.roundsNeeded = grade.oneShot ? "1" : "at least 2";
  return grade;
};

const formatDollars = dollars => `$${dollars.toFixed(2)}`;

const formatCount = (name, count) => `${name} ${count}`;

const formatCounts = (countMap, formatTheEntry = formatCount) => {
  const entries = Object.entries(countMap).filter(([, count]) => count > 0);
  return entries.length ? entries.map(([name, count]) => formatTheEntry(name, count)).join(" · ") : "none";
};

const formatTheLeftSources = countOfSourceMap => Object.values(LEFT_SOURCES).map(source => formatCount(source, countOfSourceMap[source])).join(" · ");

const formatTheStoredCounts = stored => `closed ${stored.counts.closed} · left ${stored.counts.left} (${formatTheLeftSources(stored.leftBySource)}) · decided again ${stored.counts[STORED_STATES.DECIDED]} · back ${stored.counts.back}`;

const formatTheApartCounts = (apart, closingLeftBySource) => {
  if (!closingLeftBySource) return formatCounts(apart);

  return formatCounts(apart, (name, count) => (name === PLACEMENTS.LEFT ? `${formatCount(name, count)} (${formatTheLeftSources(closingLeftBySource)})` : formatCount(name, count)));
};

const formatTheBuildWord = build => (build.result === "not run" ? "not run" : (isAPassingBuild(build) ? "passed" : "failed"));

const writeTheGradeLine = grade => {
  const kept = grade.review ? grade.review.kept : { total: 0, byScale: createScaleCounts(), testCode: 0 };
  const scales = SCALES.map(scale => `${scale} ${kept.byScale[scale] || 0}`).join(" · ");
  const stored = grade.stored ? ` · stored findings: ${formatTheStoredCounts(grade.stored)}` : "";
  const toConsider = grade.review ? grade.review.toConsiderOnTheChange : 0;
  return `one shot: ${grade.oneShot ? "yes" : "no"} · kept on the change ${kept.total} (${scales}; test code ${kept.testCode}) · to consider ${toConsider} · stops ${grade.writers.stops} · build ${formatTheBuildWord(grade.build)} · rounds ${grade.roundsNeeded} · ${formatDollars(grade.cost.dollars)}${stored}`;
};

const writeTheWriterLines = writers => {
  if (!writers.ran) return ["writers: not run"];

  const counts = writers.counts;
  const lines = [
    `writers: groups ${writers.groups.length} · finished ${counts.finished} · stopped ${counts.stopped} · not started ${counts["not started"]} · no answer ${counts["no answer"]} · build failed ${writers.buildFailed} · filled ${writers.filled}`,
    `  stops by reason: ${formatCounts(writers.stopsByReason)}`,
  ];
  for (const group of writers.groups) {
    const selfCheck = group.selfCheck.notRun ? `self-check not run: ${group.selfCheck.notRun}` : `self-check kept ${group.selfCheck.kept} · fixed ${group.selfCheck.fixed} · recorded ${formatCounts(group.selfCheck.recorded)} · needs a model change ${group.selfCheck.needsModelChange}`;
    lines.push(`  group ${group.group} ${group.outcome}${group.stop ? ` (${group.stop})` : ""}${group.buildFailed ? " · build failed" : ""} · filled ${group.filled} · ${selfCheck}`);
  }
  return lines;
};

const describeTheDecidedFinding = finding => (finding.decidedFinding ? ` (${KEY_KINDS.DECIDED_BACK}; stored key ${finding.decidedFinding.check} ${finding.decidedFinding.displayName})` : "");

const writeTheReviewLines = (review, stored) => {
  if (!review) return ["review: not run"];

  const lines = [
    `kept on the change: ${SCALES.map(scale => `${scale} ${review.kept.byScale[scale] || 0}`).join(" · ")}; test code ${review.kept.testCode}`,
    `  by track: ${formatCounts(review.kept.byTrack)}`,
  ];
  if (stored) lines.push(`  by key: ${Object.values(KEY_KINDS).map(keyKind => formatCount(keyKind, stored.keptByKey[keyKind])).join(" · ")}`);
  for (const finding of review.keptOnTheChange) lines.push(`  ${finding.scale} ${finding.check} ${finding.displayName} ${finding.file}${finding.line ? `:${finding.line}` : ""}${finding.testCode ? " (test code)" : ""}${describeTheDecidedFinding(finding)}`);
  lines.push(`to consider on the change: ${review.toConsiderOnTheChange}`);
  lines.push(`apart, not graded: ${formatTheApartCounts(review.apart, stored && stored.closingLeftBySource)}`);
  return lines;
};

const writeTheStoredLines = stored => {
  if (!stored) return [];

  const lines = [`stored findings: ${formatTheStoredCounts(stored)}`];
  for (const finding of stored.findings) lines.push(`  ${finding.state} ${finding.scale} ${finding.check} ${finding.displayName}${finding.judgedAgain === false ? " (its key was not judged again)" : ""}`);
  return lines;
};

const writeTheCostLine = cost => {
  if (!cost.parts.length) return "cost: no usage file";

  const parts = cost.parts.map(part => `${part.part} ${formatDollars(part.dollars)}`).join(" · ");
  return `cost: ${parts} · total ${formatDollars(cost.dollars)} · agents ${cost.agents} · new tokens ${cost.newTokens}`;
};

const writeTheGradeBlock = grade => [
  `one-shot grade · input ${grade.input}${grade.review ? ` · review ${grade.review.run}` : ""}`,
  `plan 1: ${grade.planOutcome} · shape runs ${grade.shapeRuns}`,
  ...writeTheWriterLines(grade.writers),
  `build: ${grade.build.result} · tests run ${grade.build.testsRun} · failed ${grade.build.testsFailed}`,
  ...writeTheReviewLines(grade.review, grade.stored),
  ...writeTheStoredLines(grade.stored),
  `older rule: ${grade.olderRule ? `round 1 open ${grade.olderRule.open} · loop ${grade.olderRule.loop}` : "no round recorded"}`,
  `rounds needed: ${grade.roundsNeeded}`,
  writeTheCostLine(grade.cost),
  writeTheGradeLine(grade),
];

const writeTheJson = (grade, jsonFile) => {
  const review = grade.review ? { run: grade.review.run, kept: grade.review.kept, toConsiderOnTheChange: grade.review.toConsiderOnTheChange, apart: grade.review.apart } : null;
  const graded = { ...grade, review, gradeLine: writeTheGradeLine(grade) };
  fs.writeFileSync(jsonFile, `${JSON.stringify(graded, null, 2)}\n`);
};

const gradeFromTheCommandLine = () => {
  try {
    const options = readOptions(process.argv.slice(2));
    const grade = gradeTheRun(options);
    for (const line of writeTheGradeBlock(grade)) console.log(line);
    if (options.json) writeTheJson(grade, options.json);
    return grade.oneShot ? EXIT_CODES.ONE_SHOT : EXIT_CODES.NOT_ONE_SHOT;
  } catch (error) {
    if (!(error instanceof UsageStop) && !(error instanceof RoundStop)) throw error;
    console.error(`${error.message}\n${USAGE}`);
    return EXIT_CODES.USAGE;
  }
};

process.exit(gradeFromTheCommandLine());
