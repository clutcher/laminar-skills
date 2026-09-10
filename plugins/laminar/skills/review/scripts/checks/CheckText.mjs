import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHECK_WORDS, findCheckWords } from "./CheckWords.mjs";
import { JUDGE_TYPE_BY_DESIGN_CHECK_MAP } from "./JudgeType.mjs";

const REVIEW_AGENTS_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "agents", "review");

const TRACK_FOLDERS = Object.freeze(["simplicity", "design", "correctness", "performance"]);

const JUDGE_OF_A_TRACK_PATTERN = /^judge-([a-z]+)-(.+)$/;

const RULES_HEADING_PATTERN = /^## .* rules$/;

const JUDGE_TYPE_BY_SCALE_MAP = Object.freeze({
  VARIABLE: "judge-simplicity-variable",
  METHOD: "judge-simplicity-method",
  CLASS: "judge-simplicity-class",
  MODULE: "judge-simplicity-module",
});

const JUDGE_TYPE_BY_TRACK_PREFIX_MAP = Object.freeze({
  CP: "judge-correctness-prevention",
  P: "judge-performance-abstraction",
});

const THE_IO_PATHS_JUDGE = "judge-performance-io-paths";

const THE_TEST_PLAN_JUDGE = "judge-correctness-test-plan";

const THE_ENTRY_BOUNDARY_JUDGE = "judge-design-entry-boundary";

const THE_VALIDATE_AT_THE_BOUNDARY_JUDGE = "judge-correctness-validate-at-the-boundary";

const JUDGE_TYPE_BY_CHECK_MAP = Object.freeze({
  ...JUDGE_TYPE_BY_DESIGN_CHECK_MAP,
  S1: "judge-simplicity-decision",
  CD2: "judge-correctness-simplicity-test-method",
  CD4: THE_TEST_PLAN_JUDGE,
  CD5: THE_TEST_PLAN_JUDGE,
  CD6: THE_TEST_PLAN_JUDGE,
  CD7: THE_TEST_PLAN_JUDGE,
  P1: THE_IO_PATHS_JUDGE,
  CP6: THE_VALIDATE_AT_THE_BOUNDARY_JUDGE,
});

const CHECKS_BY_JUDGE_TYPE_MAP = Object.freeze({
  [JUDGE_TYPE_BY_SCALE_MAP.VARIABLE]: ["S2"],
  [JUDGE_TYPE_BY_SCALE_MAP.METHOD]: ["S2", "S5", "S6"],
  [JUDGE_TYPE_BY_SCALE_MAP.CLASS]: ["S2", "S5"],
  [JUDGE_TYPE_BY_SCALE_MAP.MODULE]: ["S2", "S5"],
  "judge-simplicity-comment": ["S2", "S5"],
  "judge-correctness-simplicity-test-method": ["S2", "S4", "S5", "CD2"],
  "judge-performance-abstraction": ["P2", "P3", "P4"],
  [THE_IO_PATHS_JUDGE]: ["P1", "P2"],
  [THE_ENTRY_BOUNDARY_JUDGE]: ["S1", "CP1", "D3"],
});

const LIST_HEADING_PREFIX = "### ";

const RULE_PREFIX = "- ";

const readId = check => String(check || "").trim().toUpperCase();

const readTrackPrefix = id => id.replace(/\d+$/, "");

export const findJudgeType = (check, scale, given) => {
  if (given) return given;
  const id = readId(check);
  if (JUDGE_TYPE_BY_CHECK_MAP[id]) return JUDGE_TYPE_BY_CHECK_MAP[id];
  if (id.startsWith("S")) return JUDGE_TYPE_BY_SCALE_MAP[String(scale || "").toUpperCase()] || JUDGE_TYPE_BY_SCALE_MAP.METHOD;
  return JUDGE_TYPE_BY_TRACK_PREFIX_MAP[readTrackPrefix(id)];
};

export const findAgentFile = role => {
  const [, track, rest] = JUDGE_OF_A_TRACK_PATTERN.exec(role) || [];
  return TRACK_FOLDERS.includes(track)
    ? path.join(REVIEW_AGENTS_FOLDER, track, `judge-${rest}.md`)
    : path.join(REVIEW_AGENTS_FOLDER, `${role}.md`);
};

const readBody = judgeType => {
  try { return fs.readFileSync(findAgentFile(judgeType), "utf8"); }
  catch { return ""; }
};

const findHeadingLines = lines => {
  const headings = [];
  let fenced = false;
  lines.forEach((line, at) => {
    if (line.startsWith("```")) fenced = !fenced;
    else if (!fenced && line.startsWith("## ")) headings.push(at);
  });
  return headings;
};

const findRulesSection = text => {
  const lines = text.split(/\r?\n/);
  const headings = findHeadingLines(lines);
  const start = headings.find(at => RULES_HEADING_PATTERN.test(lines[at]));
  if (start === undefined) return "";
  const end = headings.find(at => at > start);
  return lines.slice(start, end === undefined ? lines.length : end).join("\n").trim();
};

const isAnsweredBy = (checkWords, judgeType) => CHECKS_BY_JUDGE_TYPE_MAP[judgeType]
  ? CHECKS_BY_JUDGE_TYPE_MAP[judgeType].includes(checkWords.id)
  : findJudgeType(checkWords.id) === judgeType;

const listCheckNames = judgeType => CHECK_WORDS.filter(checkWords => isAnsweredBy(checkWords, judgeType)).map(checkWords => checkWords.check);

const collectRaisedCheckNames = checks => new Set(checks.map(findCheckWords).filter(Boolean).map(checkWords => checkWords.check));

const readNamesOpeningRule = line => line.slice(RULE_PREFIX.length).split(/[:,]/)[0].split(" and ");

const findChecksNamedByRule = (line, checkNames) => {
  if (!line.startsWith(RULE_PREFIX)) return [];
  const named = readNamesOpeningRule(line);
  return named.every(name => checkNames.includes(name)) ? named : [];
};

const splitIntoLists = lines => lines.reduce((lists, line) => {
  if (line.startsWith(LIST_HEADING_PREFIX)) lists.push([line]);
  else lists[lists.length - 1].push(line);
  return lists;
}, [[]]);

const holdsARule = list => list.some(line => line.startsWith(RULE_PREFIX));

const removeEmptyLists = lines => {
  const [opening, ...lists] = splitIntoLists(lines);
  return [opening, ...lists.filter(holdsARule)].flat();
};

const selectRulesOfRaisedChecks = (section, judgeType, checks) => {
  const checkNames = listCheckNames(judgeType);
  const raised = collectRaisedCheckNames(checks);
  const keptLines = section.split("\n").filter(line => {
    const named = findChecksNamedByRule(line, checkNames);
    return named.length === 0 || named.some(name => raised.has(name));
  });
  return removeEmptyLists(keptLines).join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

export const readCheckRulesOfTheBody = (body, judgeType, checks) => {
  const section = findRulesSection(body);
  if (!checks) return section;
  return selectRulesOfRaisedChecks(section, judgeType, checks);
};

export const readCheckRules = (judgeType, checks) => (judgeType ? readCheckRulesOfTheBody(readBody(judgeType), judgeType, checks) : "");
