import { formatFileHeadLine } from "../../prepare/formats/ListFileText.mjs";
import { NO_CHANGED_LINE } from "../../prepare/formats/ChangedLinesText.mjs";

export const DRAFT_PAGE_LINES = 200;

const QUOTED_MARK = ">";
const CONTEXT_MARK = " ";
const NO_BELONGING_ANSWERS = "Belonging answers: none";
const NOTHING_TO_CONSIDER = "none";

const countDraftPages = lineCount => Math.max(Math.ceil(lineCount / DRAFT_PAGE_LINES), 1);

const countLines = text => text.replace(/\n$/, "").split("\n").length;

const formatCodeLine = (mark, line, text) => `${mark} ${line}: ${text}`;

const collectShownLines = quotedLines => {
  const shownLinesByFileMap = new Map();
  for (const quoted of quotedLines) {
    if (!shownLinesByFileMap.has(quoted.file)) shownLinesByFileMap.set(quoted.file, new Map());
    const shown = shownLinesByFileMap.get(quoted.file);
    for (const around of quoted.context || []) {
      if (!shown.has(around.line)) shown.set(around.line, { text: around.text, quoted: false, quotedTexts: [] });
    }
    const line = Number(quoted.line) || 0;
    if (!shown.has(line)) shown.set(line, { text: null, quoted: false, quotedTexts: [] });
    const shownLine = shown.get(line);
    if (shownLine.text === quoted.text) shownLine.quoted = true;
    else if (!shownLine.quotedTexts.includes(quoted.text)) shownLine.quotedTexts.push(quoted.text);
  }
  return shownLinesByFileMap;
};

const formatCodeLines = shown => [...shown.entries()]
  .sort(([left], [right]) => left - right)
  .flatMap(([line, shownLine]) => [
    ...(shownLine.text === null ? [] : [formatCodeLine(shownLine.quoted ? QUOTED_MARK : CONTEXT_MARK, line, shownLine.text)]),
    ...shownLine.quotedTexts.map(text => formatCodeLine(QUOTED_MARK, line, text)),
  ]);

const formatFileLine = (file, changedLinesByFileMap) => changedLinesByFileMap && file in changedLinesByFileMap
  ? `File: ${file} · Changed lines: ${changedLinesByFileMap[file]}`
  : `File: ${file}`;

const formatFileBlocks = (quotedLines, changedLinesByFileMap) => [...collectShownLines(quotedLines).entries()]
  .flatMap(([file, shown]) => [formatFileLine(file, changedLinesByFileMap), ...formatCodeLines(shown)]);

export const formatBelongingAnswerLines = belongingAnswers => (belongingAnswers && belongingAnswers.length
  ? ["Belonging answers:", ...belongingAnswers.map(belongingAnswer => `- ${typeof belongingAnswer === "string" ? belongingAnswer : JSON.stringify(belongingAnswer)}`)]
  : [NO_BELONGING_ANSWERS]);

const formatCallerLines = (callers, changedLinesByFileMap) => (callers || []).flatMap(caller => [
  `Caller: application \`${caller.application || ""}\``,
  ...formatFileBlocks([caller], changedLinesByFileMap),
]);

export const formatItemBlock = item => [
  `Item: ${item.id} · \`${item.displayName}\``,
  `Checks: ${(item.checks || []).join(", ")}`,
  `To consider: ${(item.consideredChecks || []).join(", ") || NOTHING_TO_CONSIDER}`,
  `Judge type: ${item.judgeType}`,
  `In change: ${item.inChange ? "yes" : "no"} · changed quoted lines: ${item.changedQuotedLines || NO_CHANGED_LINE}`,
  ...formatBelongingAnswerLines(item.belongingAnswers),
  ...formatFileBlocks(item.quotedLines || [], item.changedLinesByFileMap),
  ...formatCallerLines(item.callers, item.changedLinesByFileMap),
].join("\n");

const formatCalledByTestsLine = calledByTests => (calledByTests || []).length
  ? [`Called by tests: ${calledByTests.map(displayName => `\`${displayName}\``).join(", ")}`]
  : [];

const formatCoveredPathBlock = covered => [
  `Covered path: ${covered.id} · \`${covered.displayName}\``,
  `Test: \`${covered.test}\``,
  ...formatCalledByTestsLine(covered.calledByTests),
  `Check: ${covered.check}`,
  `Judge type: ${covered.judgeType}`,
  `Outcome: ${covered.outcome}`,
  ...formatFileBlocks(covered.quotedLines || []),
].join("\n");

const formatRulesBlock = ([judgeType, text]) => `Rules: ${judgeType}\n${String(text).replace(/\n+$/, "")}`;

const formatBodyBlocks = draftLines => [
  [`Mode: ${draftLines.mode}`, `Target: ${draftLines.target}`].join("\n"),
  ...Object.entries(draftLines.rules || {}).map(formatRulesBlock),
  ...(draftLines.items || []).map(formatItemBlock),
  ...(draftLines.coveredPaths || []).map(formatCoveredPathBlock),
];

const HEAD_LINES = 1;
const BLANK_LINE_AFTER_THE_HEAD = 1;

export const buildDraftLinesText = (draftLines, { draftText, draftLinesFile }) => {
  const body = `${[String(draftText).replace(/\n+$/, ""), ...formatBodyBlocks(draftLines)].join("\n\n")}\n`;
  const total = countLines(body) + HEAD_LINES + BLANK_LINE_AFTER_THE_HEAD;
  return `${formatFileHeadLine("Draft lines", draftLinesFile, total, countDraftPages(total))}\n\n${body}`;
};
