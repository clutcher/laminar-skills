#!/usr/bin/env node
// Builds the fixture of an eval case, and grades a run's review.md against the case's expected.md.
//
//   node grade.mjs --build <dir> <case-dir>     make the fixture in <dir>, print the range or the diff path
//   node grade.mjs <case-dir> <review.md>       print one line per expected result, then a summary; an expected item under ## To consider matches only an item under that heading of the run
//   node grade.mjs <case-dir> <review.md> --usage <usage.json>   also print one line per budget
//   node grade.mjs --judges <case-dir>          print the --judges flag of the case's judges.txt, or nothing; stop with an error where <case-dir> holds no expected.md
//
// Node with no dependencies. It writes only inside <dir> and runs git only there.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { CHECK_WORDS } from "../skills/review/scripts/checks/CheckWords.mjs";

const A_KIND_WORD = "Application|Module|Class|Method|Variable";
const A_NUMBERED_HEAD = new RegExp(`^(\\d+)\\.\\s+(${A_KIND_WORD})\\s+(.+?)\\s*$`);
const A_NAME_WITH_ITS_ENCLOSING = /^`([^`]+)`(?:\s+(?:used bare\s+)?in\s+`([^`]+)`)?$/;
const A_SUB_POINT = /^(\s+)-\s+(.+?)\.?\s*$/;
const A_MUST_NOT_LINE = new RegExp(`^(${A_KIND_WORD})\\s+\`([^\`]+)\`(?:\\s+(?:used bare\\s+)?in\\s+\`([^\`]+)\`)?,\\s*([^,]+?)(?:,\\s*also in\\s+(\`[^,]+\`))?(?:,\\s*because\\s+.+?)?\\.?\\s*$`);
const A_NAMED_ABSTRACTION = new RegExp(`^(${A_KIND_WORD})\\s+\`([^\`]+)\`(?:\\s+(?:used bare\\s+)?in\\s+\`([^\`]+)\`)?$`);
const A_LIMITED_LINE = /^(.+?),\s*([^,]+?),\s*at most\s+(\d+)\s+at\s+(High|Moderate|Low)\s+confidence(?:,\s*because\s+.+?)?\.?\s*$/i;
const AN_ABSTRACTION_SEPARATOR = new RegExp(`\\s+or\\s+(?=(?:${A_KIND_WORD})\\s+\`)`);
const CONFIDENCE_RANKS = Object.freeze({ low: 0, moderate: 1, high: 2 });
const ANY_OTHER_FINDING_LINE = /^Any other finding(?:,\s*except\s+(.+?))?(?:,\s*because\s+.+?)?\.?$/;
const ANY_OTHER_CONSIDERATION_LINE = /^Any other consideration(?:,\s*because\s+.+?)?\.?$/;
const TO_CONSIDER = "To consider";
const A_SECTION_HEAD = /^##\s+(.+?)\s*$/;
const A_LEAD_WORD_SEPARATOR = /,\s*|\s+and\s+/;
const A_LEVEL_POINT = /^(?:Confidence:\s*(High|Moderate|Low)\b|(High|Moderate|Low) confidence)/i;
const AN_ALSO_POINT = /^Also in\s+(.+)$/;
const A_DECLARED_BY_THE_SCHEMA_POINT = /^Declared by the schema:\s+(.+)$/;
const A_CONFIDENCE_BLOCK = "Confidence:";
const AN_ALSO_BLOCK = "Also in:";
const A_LEVEL_WORD = /^(High|Moderate|Low)\b/i;
const A_BACKTICKED_NAME = /`([^`]+)`/g;

const collapsed = given => String(given || "").replace(/\s+/g, " ").trim();

const THE_EXISTING_CODE_MARK = /\s+·\s+existing code$/;

const THE_SHARED_HEAD_LINE = /\s+·\s+line\s+\d+$/;

const headOf = found => ({
  kind: found[2],
  ...namesOf(collapsed(found[3]).replace(THE_EXISTING_CODE_MARK, "").replace(THE_SHARED_HEAD_LINE, "")),
});

function namesOf(rest) {
  const named = A_NAME_WITH_ITS_ENCLOSING.exec(rest);
  if (!named) return { name: rest.replace(/`/g, ""), enclosing: "" };
  return { name: named[1], enclosing: named[2] || "" };
}

const canonicalOf = item => (item.enclosing ? `${item.enclosing}#${item.name}` : item.name);

const leadWordIn = point => collapsed(String(point || "").split(/[.:]/)[0]);

const leadWordOf = item => leadWordIn(item.points[0]);

const A_COMBINED_LEAD_SEPARATOR = " / ";

const sameText = (left, right) => collapsed(left).toLowerCase() === collapsed(right).toLowerCase();

const NAMES_OF_A_CHECK = CHECK_WORDS.flatMap(rule => [rule.lead, rule.check].map(collapsed))
  .sort((left, right) => right.length - left.length);

const endsANameAt = (text, at) => at === text.length || text.startsWith(A_COMBINED_LEAD_SEPARATOR, at);

const checkNameAt = (text, at) => NAMES_OF_A_CHECK.find(name => sameText(text.slice(at, at + name.length), name) && endsANameAt(text, at + name.length));

const checkNamesJoinedIn = word => {
  const text = collapsed(word);
  const named = [];
  for (let at = 0; at < text.length; at += named[named.length - 1].length + A_COMBINED_LEAD_SEPARATOR.length) {
    const name = checkNameAt(text, at);
    if (!name) return null;
    named.push(text.slice(at, at + name.length));
  }
  return named;
};

const leadWordsJoinedIn = word => checkNamesJoinedIn(word) || String(word).split(/\s+\/\s+/).map(collapsed).filter(Boolean);

const isACheckLeadWord = word => (checkNamesJoinedIn(word) || []).length > 0;

const ruleNamedBy = word => CHECK_WORDS.find(rule => [rule.lead, rule.check, rule.id].some(name => sameText(name, word)));

const sameCheck = (expected, held) => {
  const expectedRule = ruleNamedBy(expected);
  const heldRule = ruleNamedBy(held);
  return expectedRule && heldRule ? expectedRule === heldRule : sameText(expected, held);
};

const opensAFinding = (point, order) => !order || isACheckLeadWord(leadWordIn(point));

const findingPointsOf = item => item.points.reduce((findings, point, order) => {
  if (opensAFinding(point, order)) findings.push([]);
  findings[findings.length - 1].push(point);
  return findings;
}, []);

const pointsUnder = (item, lead) => {
  const findings = findingPointsOf(item);
  return findings.find(points => sameLeadWord(lead, leadWordIn(points[0]))) || findings[0] || [];
};

const leadWordsOf = item => [...new Set(findingPointsOf(item).flatMap(points => leadWordsJoinedIn(leadWordIn(points[0]))))];

const holdsTheLeadWord = (raised, lead) => leadWordsOf(raised).some(held => sameLeadWord(lead, held));

const nestedTextUnder = (item, block, lead) => {
  const line = (item.nested[block] || []).find(held => sameLeadWord(lead, leadWordIn(held)));
  return line === undefined ? null : collapsed(line.slice(line.indexOf(":") + 1));
};

const levelOf = (item, lead = leadWordOf(item)) => {
  const nested = nestedTextUnder(item, A_CONFIDENCE_BLOCK, lead);
  if (nested !== null) return A_LEVEL_WORD.test(nested) ? A_LEVEL_WORD.exec(nested)[1].toLowerCase() : "high";
  const point = pointsUnder(item, lead).find(held => A_LEVEL_POINT.test(held));
  if (!point) return "high";
  const found = A_LEVEL_POINT.exec(point);
  return (found[1] || found[2]).toLowerCase();
};

const backtickedNamesIn = text => [...String(text || "").matchAll(A_BACKTICKED_NAME)].map(found => found[1]);

const alsoOf = item => [
  ...item.points.filter(point => AN_ALSO_POINT.test(point)).flatMap(point => backtickedNamesIn(AN_ALSO_POINT.exec(point)[1])),
  ...(item.nested[AN_ALSO_BLOCK] || []).flatMap(backtickedNamesIn),
];

const declaredByTheSchemaOf = item => item.points.filter(point => A_DECLARED_BY_THE_SCHEMA_POINT.test(point))
  .flatMap(point => backtickedNamesIn(A_DECLARED_BY_THE_SCHEMA_POINT.exec(point)[1]));

const findMissingSchemaTypes = (expected, raised) => declaredByTheSchemaOf(expected).filter(name => !declaredByTheSchemaOf(raised).includes(name));

const addPoint = (held, indent, text) => {
  if (held.pointIndent < 0) held.pointIndent = indent;
  if (indent <= held.pointIndent || !held.points.length) { held.points.push(text); return; }
  const under = held.points[held.points.length - 1];
  held.nested[under] = [...(held.nested[under] || []), text];
};

function itemsOf(text) {
  const items = [];
  let held = null;
  let considered = false;
  for (const line of String(text).split(/\r?\n/)) {
    const section = A_SECTION_HEAD.exec(line);
    if (section) { considered = collapsed(section[1]) === TO_CONSIDER; held = null; continue; }
    const head = A_NUMBERED_HEAD.exec(line);
    if (head) { held = { ...headOf(head), considered, points: [], nested: {}, pointIndent: -1 }; items.push(held); continue; }
    const point = A_SUB_POINT.exec(line);
    if (point && held) addPoint(held, point[1].length, collapsed(point[2]));
  }
  return items;
}

const MUST_NOT_APPEAR = "Must not appear";

const beforeSection = (text, heading) => {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex(line => line.trim() === `## ${heading}`);
  return lines.slice(0, start < 0 ? lines.length : start).join("\n");
};

const sectionOf = (text, heading) => {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex(line => line.trim() === `## ${heading}`);
  if (start < 0) return "";
  const after = lines.slice(start + 1).findIndex(line => line.startsWith("## "));
  return lines.slice(start + 1, after < 0 ? lines.length : start + 1 + after).join("\n");
};

const mustNotSectionLinesOf = text => sectionOf(text, MUST_NOT_APPEAR)
  .split(/\r?\n/)
  .map(collapsed)
  .filter(Boolean);

const anyOtherFindingOf = text => {
  const line = mustNotSectionLinesOf(text).find(held => ANY_OTHER_FINDING_LINE.test(held));
  if (!line) return null;
  const exceptions = ANY_OTHER_FINDING_LINE.exec(line)[1];
  return { exceptLeadWords: exceptions ? exceptions.split(A_LEAD_WORD_SEPARATOR).map(collapsed).filter(Boolean) : [] };
};

const isALimitedLine = line => A_LIMITED_LINE.test(line);

const abstractionsNamedIn = (named, line) => named.split(AN_ABSTRACTION_SEPARATOR).map(collapsed).map(given => {
  const found = A_NAMED_ABSTRACTION.exec(given);
  if (!found) { console.error(`the limited line does not name its abstractions as <Kind> \`name\`, joined by or: ${line}`); process.exit(2); }
  return { kind: found[1], name: found[2], enclosing: found[3] || "" };
});

const limitedLinesOf = text => mustNotSectionLinesOf(text)
  .filter(isALimitedLine)
  .map(line => {
    const found = A_LIMITED_LINE.exec(line);
    return { abstractions: abstractionsNamedIn(found[1], line), lead: collapsed(found[2]), most: Number(found[3]), level: found[4].toLowerCase() };
  });

const anyOtherConsiderationOf = text => mustNotSectionLinesOf(text).some(held => ANY_OTHER_CONSIDERATION_LINE.test(held));

const mustNotLinesOf = text => mustNotSectionLinesOf(text)
  .filter(line => !ANY_OTHER_FINDING_LINE.test(line) && !ANY_OTHER_CONSIDERATION_LINE.test(line) && !isALimitedLine(line))
  .map(line => {
    const found = A_MUST_NOT_LINE.exec(line);
    if (!found) { console.error(`the must-not line is not in the form <Kind> \`name\`, <Lead word>[, also in \`reference\`], nor Any other finding[, except <Lead word> and <Lead word>]: ${line}`); process.exit(2); }
    return { kind: found[1], name: found[2], enclosing: found[3] || "", lead: collapsed(found[4]), alsoIn: backtickedNamesIn(found[5]) };
  });

const sameLeadWord = (expected, raised) => leadWordsJoinedIn(raised).some(held => sameCheck(expected, held));

const isTheSameAbstraction = (expected, raised) => expected.kind.toLowerCase() === raised.kind.toLowerCase()
  && canonicalOf(expected) === canonicalOf(raised);

const alsoUnder = (item, lead) => {
  const nested = nestedTextUnder(item, AN_ALSO_BLOCK, lead);
  if (nested !== null) return backtickedNamesIn(nested);
  return pointsUnder(item, lead).filter(point => AN_ALSO_POINT.test(point)).flatMap(point => backtickedNamesIn(AN_ALSO_POINT.exec(point)[1]));
};

const namesItAsASecondPlace = (expected, raised, lead) => alsoUnder(raised, lead).includes(canonicalOf(expected));

const isAMethodOfTheExpectedClass = (expected, raised) => expected.kind.toLowerCase() === "class"
  && raised.kind.toLowerCase() === "method" && raised.enclosing === canonicalOf(expected);

const isRaisedOn = (expected, raised, lead) => isTheSameAbstraction(expected, raised)
  || namesItAsASecondPlace(expected, raised, lead) || isAMethodOfTheExpectedClass(expected, raised);

const sitsInTheSameSection = (expected, raised) => expected.considered === raised.considered;

const matching = (raisedItems, expected) => raisedItems
  .filter(raised => sitsInTheSameSection(expected, raised))
  .filter(raised => holdsTheLeadWord(raised, leadWordOf(expected)) && isRaisedOn(expected, raised, leadWordOf(expected)));

const namesAForbiddenPlace = (mustNot, raised) => !mustNot.alsoIn.length
  || mustNot.alsoIn.some(reference => alsoOf(raised).includes(reference));

const forbidden = (raisedItems, mustNot) => raisedItems
  .filter(raised => holdsTheLeadWord(raised, mustNot.lead))
  .filter(raised => isTheSameAbstraction(mustNot, raised))
  .filter(raised => namesAForbiddenPlace(mustNot, raised));

const allowed = (raisedItems, limited) => raisedItems
  .filter(raised => holdsTheLeadWord(raised, limited.lead))
  .filter(raised => limited.abstractions.some(abstraction => isTheSameAbstraction(abstraction, raised)));

const isAboveTheLevel = (raised, limited) => CONFIDENCE_RANKS[levelOf(raised, limited.lead)] > CONFIDENCE_RANKS[limited.level];

const shorten = given => given.length > 72 ? `${given.slice(0, 69)}...` : given;

const headTextOf = item => shorten(`${item.kind} ${item.name}${item.enclosing ? ` in ${item.enclosing}` : ""}`);

const A_CEILING = "at or under";
const A_FLOOR = "at or over";

const BUDGET_FIELDS = [
  { budget: "wall_seconds", usage: "wall_seconds", bar: A_CEILING },
  { budget: "total_tokens", usage: "total_tokens", bar: A_CEILING },
  { budget: "new_tokens_cold", usage: "new_tokens", bar: A_CEILING, onlyWhenCold: true },
  { budget: "new_tokens_warm", usage: "new_tokens", bar: A_CEILING, onlyWhenWarm: true },
  { budget: "output_tokens", usage: "output_tokens", bar: A_CEILING },
  { budget: "cache_read_share", usage: "cache_read_share", bar: A_FLOOR },
  { budget: "agents", usage: "agents", bar: A_CEILING },
  { budget: "dollars", usage: "dollars", bar: A_CEILING },
];

const appliesTo = (field, cold) => !(field.onlyWhenCold && !cold) && !(field.onlyWhenWarm && cold);

const metBy = (field, measured, allowed) => field.bar === A_CEILING ? measured <= allowed : measured >= allowed;

const OUTSIDE_FILES_SHOWN = 10;

const verdictWordOf = (usage, failures) => {
  const contaminated = (usage.files_opened_outside || 0) > 0;
  const overBudget = failures > (contaminated ? 1 : 0);
  if (contaminated && overBudget) return "contaminated and over budget";
  if (contaminated) return "contaminated";
  return overBudget ? "over budget" : "within budget";
};

function gradeContamination(usage) {
  const opened = usage.files_opened_outside || 0;
  if (!opened) {
    console.log("PASS  files_opened_outside — 0, no agent opened a file outside the run folder and the target");
    return 0;
  }
  console.log(`CONTAMINATED  files_opened_outside — ${opened} file(s) outside the run folder and the target were opened`);
  for (const given of (usage.opened_outside || []).slice(0, OUTSIDE_FILES_SHOWN)) console.log(`  ${given}`);
  return 1;
}

function gradeBudget(caseDir, usageFile) {
  const budget = JSON.parse(fs.readFileSync(path.join(caseDir, "budget.json"), "utf8"));
  const usage = JSON.parse(fs.readFileSync(usageFile, "utf8"));
  const cold = usage.cold !== false;
  let failures = gradeContamination(usage);
  for (const field of BUDGET_FIELDS) {
    if (!appliesTo(field, cold) || budget[field.budget] === undefined) continue;
    const allowed = budget[field.budget];
    const measured = usage[field.usage];
    if (measured === undefined) { failures++; console.log(`FAIL  ${field.budget} — the usage file states no ${field.usage}`); continue; }
    if (!metBy(field, measured, allowed)) { failures++; console.log(`FAIL  ${field.budget} — ${measured}, ${field.bar} ${allowed} was asked for`); continue; }
    console.log(`PASS  ${field.budget} — ${measured}, ${field.bar} ${allowed}`);
  }
  console.log(`${verdictWordOf(usage, failures)} on a ${cold ? "cold" : "warm"} run of ${path.basename(caseDir)}`);
  return failures ? 1 : 0;
}

const SECTION_WORDS = Object.freeze({ finding: "no finding raised", consideration: `nothing raised under ${TO_CONSIDER}` });

function gradeExpected(expected, raisedItems) {
  const head = `${headTextOf(expected)}, ${leadWordOf(expected)}`;
  const found = matching(raisedItems, expected);
  if (!found.length) { console.log(`FAIL  ${head} — ${expected.considered ? SECTION_WORDS.consideration : SECTION_WORDS.finding}`); return 1; }
  const raised = found[0];
  const lead = leadWordOf(expected);
  if (expected.considered) return gradeExpectedConsideration(expected, raised, head);
  const wanted = expected.points.find(point => A_LEVEL_POINT.test(point)) ? levelOf(expected) : "";
  if (wanted && levelOf(raised, lead) !== wanted) {
    console.log(`FAIL  ${head} — raised at confidence ${levelOf(raised, lead)}, expected ${wanted}`);
    return 1;
  }
  const missingPlaces = alsoOf(expected).filter(reference => !alsoOf(raised).includes(reference));
  if (missingPlaces.length) {
    console.log(`FAIL  ${head} — raised, but it names no second place ${missingPlaces.join(", ")}`);
    return 1;
  }
  const missingSchemaTypes = findMissingSchemaTypes(expected, raised);
  if (missingSchemaTypes.length) {
    console.log(`FAIL  ${head} — raised, but it names no schema type ${missingSchemaTypes.join(", ")} as the one that declares it`);
    return 1;
  }
  const places = alsoOf(expected).length ? `, also in ${alsoOf(expected).join(", ")}` : "";
  const schemaTypes = declaredByTheSchemaOf(expected).length ? `, declared by the schema ${declaredByTheSchemaOf(expected).join(", ")}` : "";
  console.log(`PASS  ${head} — raised at confidence ${levelOf(raised, lead)}${places}${schemaTypes}`);
  return 0;
}

function gradeExpectedConsideration(expected, raised, head) {
  const missingPlaces = alsoOf(expected).filter(reference => !alsoOf(raised).includes(reference));
  if (missingPlaces.length) {
    console.log(`FAIL  ${head} — raised under ${TO_CONSIDER}, but it names no second place ${missingPlaces.join(", ")}`);
    return 1;
  }
  const missingSchemaTypes = findMissingSchemaTypes(expected, raised);
  if (missingSchemaTypes.length) {
    console.log(`FAIL  ${head} — raised under ${TO_CONSIDER}, but it names no schema type ${missingSchemaTypes.join(", ")} as the one that declares it`);
    return 1;
  }
  console.log(`PASS  ${head} — raised under ${TO_CONSIDER}`);
  return 0;
}

function gradeAnyOtherConsideration(consideredItems, expectedItems) {
  const others = consideredItems.filter(raised => !leadWordsOf(raised).every(lead => isExpectedUnder(raised, lead, expectedItems)));
  if (!others.length) { console.log(`PASS  Any other consideration — none raised`); return { graded: 1, failures: 0 }; }
  for (const other of others) console.log(`FAIL  ${headTextOf(other)}, ${leadWordsOf(other).join(", ")} — raised under ${TO_CONSIDER}, and the case allows no other`);
  return { graded: others.length, failures: others.length };
}

function gradeMustNot(mustNot, raisedItems) {
  const head = `${headTextOf(mustNot)}, ${mustNot.lead}${mustNot.alsoIn.length ? `, also in ${mustNot.alsoIn.join(", ")}` : ""}`;
  const found = forbidden(raisedItems, mustNot);
  if (found.length) { console.log(`FAIL  ${head} — ${found.length} forbidden finding(s) raised`); return 1; }
  console.log(`PASS  ${head} — no forbidden finding raised`);
  return 0;
}

function gradeLimited(limited, raisedItems) {
  const head = `${limited.abstractions.map(headTextOf).join(" or ")}, ${limited.lead}, at most ${limited.most} at ${limited.level} confidence`;
  const found = allowed(raisedItems, limited);
  if (found.length > limited.most) { console.log(`FAIL  ${head} — ${found.length} finding(s) raised`); return 1; }
  const tooHigh = found.find(raised => isAboveTheLevel(raised, limited));
  if (tooHigh) { console.log(`FAIL  ${head} — raised at confidence ${levelOf(tooHigh, limited.lead)}`); return 1; }
  console.log(`PASS  ${head} — ${found.length} finding(s) raised`);
  return 0;
}

const isAllowedUnder = (raised, lead, limitedLines) => limitedLines
  .some(limited => sameLeadWord(limited.lead, lead) && allowed([raised], limited).length);

const isExpectedUnder = (raised, lead, expectedItems) => expectedItems
  .some(expected => sitsInTheSameSection(expected, raised) && sameLeadWord(leadWordOf(expected), lead) && isRaisedOn(expected, raised, lead));

const isForbiddenUnder = (raised, lead, mustNot) => mustNot
  .some(line => sameLeadWord(line.lead, lead) && forbidden([raised], line).length);

const isExceptedUnder = (lead, anyOther) => anyOther.exceptLeadWords.some(excepted => sameLeadWord(excepted, lead));

const unaccountedLeadWordsOf = (raised, anyOther, expectedItems, mustNot, limitedLines) => leadWordsOf(raised)
  .filter(lead => !isExpectedUnder(raised, lead, expectedItems) && !isForbiddenUnder(raised, lead, mustNot)
    && !isAllowedUnder(raised, lead, limitedLines) && !isExceptedUnder(lead, anyOther));

function gradeAnyOtherFinding(anyOther, raisedItems, expectedItems, mustNot, limitedLines) {
  const others = raisedItems
    .map(raised => ({ raised, leads: unaccountedLeadWordsOf(raised, anyOther, expectedItems, mustNot, limitedLines) }))
    .filter(other => other.leads.length);
  const exceptions = anyOther.exceptLeadWords.length ? `, except ${anyOther.exceptLeadWords.join(", ")}` : "";
  if (!others.length) { console.log(`PASS  Any other finding${exceptions} — none raised`); return { graded: 1, failures: 0 }; }
  for (const other of others) console.log(`FAIL  ${headTextOf(other.raised)}, ${other.leads.join(", ")} — raised, and the case allows no other finding`);
  return { graded: others.length, failures: others.length };
}

const JUDGES_FILE = "judges.txt";

const EXPECTED_FILE = "expected.md";
const TASK_FILE = "task.md";

const A_JUDGE_TYPE_PREFIX = /^(?:laminar-review-)?(?:judge-)?/;

const judgeTypesOf = caseDir => {
  const file = path.join(caseDir, JUDGES_FILE);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8").split(",").map(collapsed).filter(Boolean).map(given => given.replace(A_JUDGE_TYPE_PREFIX, ""));
};

const SIMPLICITY_JUDGE_BY_KIND = Object.freeze({
  variable: ["simplicity-variable"],
  method: ["simplicity-method", "simplicity-comment", "correctness-simplicity-test-method"],
  class: ["simplicity-class", "simplicity-comment"],
  module: ["simplicity-module"],
  system: ["simplicity-module"],
});

const JUDGES_BY_CHECK = Object.freeze({
  S1: () => ["simplicity-decision", "design-entry-boundary"],
  S2: kind => SIMPLICITY_JUDGE_BY_KIND[kind] || [],
  S4: () => ["correctness-simplicity-test-method"],
  S5: kind => SIMPLICITY_JUDGE_BY_KIND[kind] || [],
  S6: () => ["simplicity-method"],
  D1: () => ["design-over-extraction"],
  D2: () => ["design-scoped-parameters"],
  D3: () => ["design-leaked-details", "design-entry-boundary"],
  D4: () => ["design-missing-boundary"],
  CP1: () => ["correctness-prevention", "design-entry-boundary"],
  CP3: () => ["correctness-prevention"],
  CP4: () => ["correctness-prevention"],
  CP5: () => ["correctness-prevention"],
  CP6: () => ["correctness-validate-at-the-boundary"],
  CP7: () => ["correctness-prevention"],
  CD2: () => ["correctness-simplicity-test-method"],
  CD4: () => ["correctness-test-plan"],
  CD5: () => ["correctness-test-plan"],
  CD6: () => ["correctness-test-plan"],
  CD7: () => ["correctness-test-plan"],
  P1: () => ["performance-io-paths"],
  P2: () => ["performance-abstraction", "performance-io-paths"],
  P3: () => ["performance-abstraction"],
  P4: () => ["performance-abstraction"],
});

const A_FILE_NAME = /\.[A-Za-z0-9]+$/;

const SCRIPT_FINDINGS_ON_A_TEST_FILE_NAME = Object.freeze(["simplicity-module"]);

const judgesThatAnswer = expected => {
  const rule = ruleNamedBy(leadWordOf(expected));
  const judges = rule && JUDGES_BY_CHECK[rule.id];
  if (!judges) return [];
  const onAFileName = expected.kind.toLowerCase() === "class" && A_FILE_NAME.test(expected.name || "");
  return [...judges(expected.kind.toLowerCase()), ...(onAFileName ? SCRIPT_FINDINGS_ON_A_TEST_FILE_NAME : [])];
};

function warnOnUnansweredChecks(expectedItems, judgeTypes) {
  if (!judgeTypes) return;
  for (const expected of expectedItems) {
    if (judgesThatAnswer(expected).some(judge => judgeTypes.includes(judge))) continue;
    console.log(`WARN  ${headTextOf(expected)}, ${leadWordOf(expected)} — no judge type in ${JUDGES_FILE} answers this check`);
  }
}

const anyOtherReachOf = judgeTypes => (judgeTypes ? `only the judge types in ${JUDGES_FILE}: ${judgeTypes.join(", ")}` : "every judge type, because the case has no judges.txt");

function grade(caseDir, reviewFile) {
  const expectation = fs.readFileSync(path.join(caseDir, EXPECTED_FILE), "utf8");
  const everyRaisedItem = itemsOf(fs.readFileSync(reviewFile, "utf8"));
  const raisedItems = everyRaisedItem.filter(raised => !raised.considered);
  const consideredItems = everyRaisedItem.filter(raised => raised.considered);
  const expectedItems = itemsOf(beforeSection(expectation, MUST_NOT_APPEAR));
  const mustNot = mustNotLinesOf(expectation);
  const limitedLines = limitedLinesOf(expectation);
  const judgeTypes = judgeTypesOf(caseDir);
  warnOnUnansweredChecks(expectedItems, judgeTypes);
  let failures = 0;
  for (const expected of expectedItems) failures += gradeExpected(expected, everyRaisedItem);
  for (const line of mustNot) failures += gradeMustNot(line, raisedItems);
  for (const limited of limitedLines) failures += gradeLimited(limited, raisedItems);
  let graded = expectedItems.length + mustNot.length + limitedLines.length;
  const anyOther = anyOtherFindingOf(expectation);
  if (anyOther) {
    const other = gradeAnyOtherFinding(anyOther, raisedItems, expectedItems, mustNot, limitedLines);
    graded += other.graded;
    failures += other.failures;
    console.log(`NOTE  Any other finding was graded over ${anyOtherReachOf(judgeTypes)}`);
  }
  if (anyOtherConsiderationOf(expectation)) {
    const other = gradeAnyOtherConsideration(consideredItems, expectedItems);
    graded += other.graded;
    failures += other.failures;
  }
  console.log(`${graded - failures}/${graded} graded results passed in ${path.basename(caseDir)}, ${raisedItems.length} finding(s) and ${consideredItems.length} item(s) to consider in the run`);
  return failures ? 1 : 0;
}

function nearestExistingFolderOf(dir) {
  let folder = dir;
  while (!fs.existsSync(folder)) folder = path.dirname(folder);
  return folder;
}

function isInsideAGitWorkingTree(dir) {
  const answered = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: nearestExistingFolderOf(dir), encoding: "utf8" });
  return answered.status === 0 && answered.stdout.trim() === "true";
}

function reasonNotToBuildInto(dir) {
  if (fs.existsSync(dir) && !fs.statSync(dir).isDirectory()) return `${dir} is a file, not a folder`;
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) return `${dir} is not empty`;
  if (isInsideAGitWorkingTree(dir)) return `${dir} is inside a git working tree, and the fixture is a git repository of its own`;
  return "";
}

function build(dir, caseDir) {
  const refused = reasonNotToBuildInto(dir);
  if (refused) {
    console.error(`no fixture was built: ${refused}. Give a new folder or an empty one outside every git working tree.`);
    return 2;
  }
  const changeDiff = path.join(caseDir, "change.diff");
  const baseDiff = path.join(caseDir, "base.diff");
  fs.mkdirSync(dir, { recursive: true });
  const git = (...args) => execFileSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
  git("init", "--quiet", "--initial-branch=main");
  if (!fs.existsSync(baseDiff)) {
    const copied = path.join(dir, "change.diff");
    fs.copyFileSync(changeDiff, copied);
    console.log(path.resolve(copied));
    return 0;
  }
  git("apply", path.resolve(baseDiff));
  git("add", "-A");
  git("commit", "--quiet", "-m", "the base state");
  git("checkout", "--quiet", "-b", "change");
  if (!fs.existsSync(changeDiff)) {
    console.log(path.join(caseDir, TASK_FILE));
    return 0;
  }
  git("apply", path.resolve(changeDiff));
  git("add", "-A");
  git("commit", "--quiet", "-m", "the change under review");
  console.log("main...change");
  return 0;
}

const argv = process.argv.slice(2);
if (argv[0] === "--build") {
  if (argv.length !== 3) { console.error("usage: node grade.mjs --build <dir> <case-dir>"); process.exit(2); }
  process.exit(build(path.resolve(argv[1]), path.resolve(argv[2])));
}
if (argv[0] === "--judges") {
  if (argv.length !== 2) { console.error("usage: node grade.mjs --judges <case-dir>"); process.exit(2); }
  const caseDir = path.resolve(argv[1]);
  if (!fs.existsSync(path.join(caseDir, EXPECTED_FILE))) { console.error(`no eval case at ${caseDir}: it holds no ${EXPECTED_FILE}`); process.exit(2); }
  const judgeTypes = judgeTypesOf(caseDir);
  if (judgeTypes && judgeTypes.length) console.log(`--judges ${judgeTypes.join(",")}`);
  process.exit(0);
}
const usageAt = argv.indexOf("--usage");
const usageFile = usageAt >= 0 ? argv[usageAt + 1] : "";
const graded = usageAt >= 0 ? argv.slice(0, usageAt) : argv;
if (graded.length !== 2 || (usageAt >= 0 && !usageFile)) { console.error("usage: node grade.mjs <case-dir> <review.md> [--usage <usage.json>]"); process.exit(2); }
const caseDir = path.resolve(graded[0]);
const failedResults = grade(caseDir, path.resolve(graded[1]));
const failedBudget = usageFile ? gradeBudget(caseDir, path.resolve(usageFile)) : 0;
process.exit(failedResults || failedBudget);
