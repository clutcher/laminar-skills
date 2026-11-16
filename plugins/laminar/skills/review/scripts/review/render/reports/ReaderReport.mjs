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

const buildTrackSections = (items, sharedHeadLines) => {
  const sections = [];
  items.forEach((item, order) => {
    const track = item.lead.group;
    const kind = chooseKindWord(item.lead);
    let section = sections[sections.length - 1];
    if (!section || section.track !== track) { section = { track, kind: "", lines: [`## ${track}`] }; sections.push(section); }
    if (kind !== section.kind) { section.lines.push(`### ${kind}`); section.kind = kind; }
    section.lines.push(formatItem(item.findings, order + 1, { sharedHeadLine: sharedHeadLines[order] }));
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

const listUnderHeaders = (items, covered, sharedHeadLines) => addCoveredPaths(buildTrackSections(items, sharedHeadLines), covered).flatMap(section => section.lines);

const buildFindingSections = (items, covered, sharedHeadLines) => items.length
  ? listUnderHeaders(items, covered, sharedHeadLines)
  : ["## Findings", NOTHING_WAS_FOUND, ...listUnderHeaders([], covered, sharedHeadLines)];

export const TO_CONSIDER = "To consider";

const buildConsiderationSection = (considerations, firstNumber, sharedHeadLines) => considerations.length
  ? [`## ${TO_CONSIDER}`, ...considerations.map((item, order) => formatItem(item.findings, firstNumber + order, { sharedHeadLine: sharedHeadLines[order] }))]
  : [];

export const DECIDED_BY_THE_DESIGN = "Decided by the design";

const NO_DECIDED_RESULT = "No result matched a decision of the design.";

const formatScaleWord = finding => {
  const scale = String(finding.scale || (finding.abstraction || {}).scale || "").toLowerCase();
  return scale.charAt(0).toUpperCase() + scale.slice(1);
};

export const RAISED_AT_CLASS_SCALE = "decided at method scale, raised at class scale";

const formatMatchedByWord = mark => {
  if (mark.matchedBy === MATCHED_BY.FORMER_NAME) return ` · matched by its former name \`${readDisplayNameOfTheFinding(mark.finding)}\``;
  return mark.matchedBy === MATCHED_BY.CLASS_OF_THE_METHOD ? ` · ${RAISED_AT_CLASS_SCALE} on \`${mark.decision.displayName}\`` : "";
};

const formatPlanWord = decision => (decision.plan === null ? "" : ` in plan ${decision.plan}`);

// The decision of the design stands beside what the judge said this run, so a result that names another defect under the same check shows.
export const formatDecidedLine = mark => {
  const { finding, decision } = mark;
  const head = `- ${formatLeadWords(finding)} · ${formatScaleWord(finding)} \`${readDisplayNameOfTheFinding(finding)}\` (${decision.check}) · ${decision.reason}, decided by ${decision.decidedBy}${formatPlanWord(decision)}: ${decision.says}${formatMatchedByWord(mark)}`;
  const summary = formatSentence(convertToText(finding.summary || finding.sentence || finding.consider));
  return summary ? `${head}\n${SUB_POINT_INDENT}- ${summary}` : head;
};

const formatDecidedBody = decided => {
  if (decided.notAppliedReason) return `No decision of the design applied: ${decided.notAppliedReason}.`;
  return decided.decided.length ? decided.decided.map(formatDecidedLine).join("\n") : NO_DECIDED_RESULT;
};

const buildDecidedSection = decided => (decided ? [`## ${DECIDED_BY_THE_DESIGN}`, formatDecidedBody(decided)] : []);

export function buildReaderReport({ banner, scopeLine, acrossApplicationsLine, changeSummary, settled, covered, leftOutFiles = [], decided = null }) {
  const considerations = settled.considerations || [];
  const sharedHeadLines = findLinesOfSharedHeads([...settled.items, ...considerations].map(item => item.findings));
  return [
    banner,
    ...(scopeLine ? [scopeLine] : []),
    ...buildNotReadLines(leftOutFiles),
    ...(acrossApplicationsLine ? [acrossApplicationsLine] : []),
    formatChangeLine(changeSummary),
    ...buildFindingSections(settled.items, covered || [], sharedHeadLines),
    ...buildConsiderationSection(considerations, settled.items.length + 1, sharedHeadLines.slice(settled.items.length)),
    ...buildDecidedSection(decided),
    "## Limits",
    LIMITS.join("\n"),
  ].join("\n\n") + "\n";
}
