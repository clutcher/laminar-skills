import { formatItem, findLinesOfSharedHeads, formatLeadWords, formatPlaceName, formatSentence, SUB_POINT_INDENT } from "../sections/ItemText.mjs";
import { convertToText } from "../sections/ReturnedValueText.mjs";
import { MATCHED_BY, readDisplayNameOfTheFinding } from "../verdicts/DecidedResults.mjs";
import { readTrackRank } from "../../../checks/CheckWords.mjs";
import { LEFT_OUT_REASONS } from "../../../code/index.mjs";

const LIMITS = [
  "The review judges 3 qualities of the code: simplicity, from how people read the code; correctness, by the errors its design prevents and the paths its tests run; and performance, by the work it wastes.",
  "The review does not find logic errors. A wrong tax formula is written exactly like a correct one, so reading the code cannot tell them apart.",
  "The review does not judge speed. The one performance question it answers is whether the code moves data a known alternative avoids.",
  "The review does not report what a compiler, a linter or a type checker reports, judged against the configuration the repository holds.",
];

const NOTHING_WAS_FOUND = "Nothing was found.";

const formatChangeLine = changeSummary => formatSentence(changeSummary);

const listFilesNoDriverReads = leftOutFiles => leftOutFiles.filter(leftOutFile => leftOutFile.reason === LEFT_OUT_REASONS.NO_LANGUAGE_DRIVER).map(leftOutFile => leftOutFile.path);

const formatNotReadLine = filePaths => `**Not read** · the review cannot read files of this kind: ${filePaths.map(filePath => `\`${filePath}\``).join(", ")}`;

const buildNotReadLines = leftOutFiles => {
  const filePaths = listFilesNoDriverReads(leftOutFiles);
  return filePaths.length ? [formatNotReadLine(filePaths)] : [];
};

const PRODUCTION_CODE = "Production code";

const TEST_CODE = "Test code";

const chooseKindWord = finding => finding.isTest ? TEST_CODE : PRODUCTION_CODE;

const DETECTION = "Correctness · Detection";

const ALREADY_COVERED = "### Already covered";

const UNNAMED = "a place the review could not name";

const NOT_VERIFIED_MARK = " (not verified: the second read did not finish, so this is as its judge wrote it)";

const formatCoveredLine = covered => `- ${formatPlaceName(covered.abstractionPlace) || UNNAMED} by ${formatPlaceName(covered.test) || UNNAMED}${covered.notVerified ? NOT_VERIFIED_MARK : ""}`;

const formatCoveredSection = covered => [ALREADY_COVERED, covered.map(formatCoveredLine).join("\n")];

const comesAfterDetection = track => readTrackRank(track) > readTrackRank(DETECTION);

export const RELATED_TO_A_DECISION = "Related to a decision";

const TRAILING_STOP = /[.!?]+$/;

const formatMoreRelatedWord = count => (count ? ` (and ${count} more related decision(s) in review-evidence.md)` : "");

// The item stays open with its status; the line names the first related decision and asks for a ruling, never for a set-apart.
const formatRelatedLine = related => {
  const { decision } = related[0];
  return `${SUB_POINT_INDENT}- ${RELATED_TO_A_DECISION}: ${decision.check} on ${decision.scale} \`${decision.displayName}\`, ${decision.reason}: ${String(decision.says).trim().replace(TRAILING_STOP, "")}${formatMoreRelatedWord(related.length - 1)}. This item is open; add its key to the reach of that decision, or rule on it apart.`;
};

const NO_RELATED_DECISIONS = Object.freeze({ listRelatedOfTheFindings: () => [] });

const formatOpenItem = (findings, number, options, related) => {
  const relatedOfTheItem = related.listRelatedOfTheFindings(findings);
  const item = formatItem(findings, number, options);
  return relatedOfTheItem.length ? `${item}\n${formatRelatedLine(relatedOfTheItem)}` : item;
};

const buildTrackSections = (items, sharedHeadLines, related) => {
  const sections = [];
  items.forEach((item, order) => {
    const track = item.lead.group;
    const kind = chooseKindWord(item.lead);
    let section = sections[sections.length - 1];
    if (!section || section.track !== track) { section = { track, kind: "", lines: [`## ${track}`] }; sections.push(section); }
    if (kind !== section.kind) { section.lines.push(`### ${kind}`); section.kind = kind; }
    section.lines.push(formatOpenItem(item.findings, order + 1, { sharedHeadLine: sharedHeadLines[order] }, related));
  });
  return sections;
};

const addCoveredPaths = (sections, covered) => {
  if (!covered.length) return sections;
  const detection = sections.find(section => section.track === DETECTION);
  if (detection) { detection.lines.push(...formatCoveredSection(covered)); return sections; }
  const own = { track: DETECTION, lines: [`## ${DETECTION}`, ...formatCoveredSection(covered)] };
  const after = sections.findIndex(section => comesAfterDetection(section.track));
  return after < 0 ? [...sections, own] : [...sections.slice(0, after), own, ...sections.slice(after)];
};

const listUnderHeaders = (items, covered, sharedHeadLines, related) => addCoveredPaths(buildTrackSections(items, sharedHeadLines, related), covered).flatMap(section => section.lines);

const buildFindingSections = (items, covered, sharedHeadLines, related) => items.length
  ? listUnderHeaders(items, covered, sharedHeadLines, related)
  : ["## Findings", NOTHING_WAS_FOUND, ...listUnderHeaders([], covered, sharedHeadLines, related)];

export const TO_CONSIDER = "To consider";

const buildConsiderationSection = (considerations, firstNumber, sharedHeadLines, related) => considerations.length
  ? [`## ${TO_CONSIDER}`, ...considerations.map((item, order) => formatOpenItem(item.findings, firstNumber + order, { sharedHeadLine: sharedHeadLines[order] }, related))]
  : [];

export const DECIDED_BY_THE_DESIGN = "Decided by the design";

const NO_DECIDED_RESULT = "No result matched a decision of the design.";

const NO_RESULT_STAYS_DECIDED = "Every result a decision of the design matched changed since the decision.";

const formatScaleWord = finding => {
  const scale = String(finding.scale || (finding.abstraction || {}).scale || "").toLowerCase();
  return scale.charAt(0).toUpperCase() + scale.slice(1);
};

export const RAISED_AT_CLASS_SCALE = "decided at method scale, raised at class scale";

// A decision the reach of a ruling gave names the key of that ruling, so the reader sees that nobody raised this key when the person ruled.
const formatReachWord = decision => (decision.reachOf ? ` · decided by the reach of \`${decision.reachOf}\`` : "");

const formatMatchedByWord = mark => {
  if (mark.matchedBy === MATCHED_BY.FORMER_NAME) return ` · matched by its former name \`${readDisplayNameOfTheFinding(mark.finding)}\``;
  return mark.matchedBy === MATCHED_BY.CLASS_OF_THE_METHOD ? ` · ${RAISED_AT_CLASS_SCALE} on \`${mark.decision.displayName}\`` : "";
};

const formatPlanWord = decision => (decision.plan === null ? "" : ` in plan ${decision.plan}`);

const formatDecidedHead = mark => {
  const { finding, decision } = mark;
  return `- ${formatLeadWords(finding)} · ${formatScaleWord(finding)} \`${readDisplayNameOfTheFinding(finding)}\` (${decision.check}) · ${decision.reason}, decided by ${decision.decidedBy}${formatPlanWord(decision)}: ${decision.says}${formatMatchedByWord(mark)}${formatReachWord(decision)}`;
};

const addTheSummary = (head, finding) => {
  const summary = formatSentence(convertToText(finding.summary || finding.sentence || finding.consider));
  return summary ? `${head}\n${SUB_POINT_INDENT}- ${summary}` : head;
};

// The decision of the design stands beside what the judge said this run, so a result that names another defect under the same check shows.
export const formatDecidedLine = mark => addTheSummary(formatDecidedHead(mark), mark.finding);

export const DECIDED_BUT_CHANGED_SINCE = "Decided, but changed since the decision";

export const formatChangedSinceWords = decision => `the ${decision.scale} changed since the decision`;

// The plan whose writers wrote the lines, where its self-check gives them; the result stays changed since, because nobody ruled on the written lines.
const formatWrittenByWords = mark => (mark.writtenByPlan === null || mark.writtenByPlan === undefined ? "" : `: changed by the writers of plan ${mark.writtenByPlan}`);

export const formatChangedSinceLine = mark => addTheSummary(`${formatDecidedHead(mark)} · ${formatChangedSinceWords(mark.decision)}${formatWrittenByWords(mark)}`, mark.finding);

const formatDecidedBody = decided => {
  if (decided.notAppliedReason) return `No decision of the design applied: ${decided.notAppliedReason}.`;
  if (decided.decided.length) return decided.decided.map(formatDecidedLine).join("\n");
  return decided.changedSince.length ? NO_RESULT_STAYS_DECIDED : NO_DECIDED_RESULT;
};

const buildDecidedSection = decided => (decided ? [`## ${DECIDED_BY_THE_DESIGN}`, formatDecidedBody(decided)] : []);

const buildChangedSinceSection = decided => (decided && decided.changedSince.length ? [`## ${DECIDED_BUT_CHANGED_SINCE}`, decided.changedSince.map(formatChangedSinceLine).join("\n")] : []);

export function buildReaderReport({ banner, scopeLine, acrossApplicationsLine, changeSummary, settled, covered, leftOutFiles = [], decided = null, related = null }) {
  const considerations = settled.considerations || [];
  const sharedHeadLines = findLinesOfSharedHeads([...settled.items, ...considerations].map(item => item.findings));
  return [
    banner,
    ...(scopeLine ? [scopeLine] : []),
    ...buildNotReadLines(leftOutFiles),
    ...(acrossApplicationsLine ? [acrossApplicationsLine] : []),
    formatChangeLine(changeSummary),
    ...buildFindingSections(settled.items, covered || [], sharedHeadLines, related || NO_RELATED_DECISIONS),
    ...buildConsiderationSection(considerations, settled.items.length + 1, sharedHeadLines.slice(settled.items.length), related || NO_RELATED_DECISIONS),
    ...buildDecidedSection(decided),
    ...buildChangedSinceSection(decided),
    "## Limits",
    LIMITS.join("\n"),
  ].join("\n\n") + "\n";
}
