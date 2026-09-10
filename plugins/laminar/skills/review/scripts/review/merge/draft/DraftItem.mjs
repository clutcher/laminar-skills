import { findJudgeType } from "../../../checks/CheckText.mjs";
import { NO_CHANGED_LINES_TEXT } from "../../prepare/formats/ChangedLinesText.mjs";
import { LINES_OF_CONTEXT } from "../../prepare/abstractions/walks/entryBoundaries/EntryBoundaryCallers.mjs";
import { Scale } from "../../../code/index.mjs";
import { isInTheChange } from "../returns/PossibleFindings.mjs";
import { LISTED_FILE_LINE_NUMBER } from "../lines/LineCheck.mjs";
import { isAConsideration } from "../filing/Considerations.mjs";

export const buildQuotedLines = (quotes, sliceLines) => quotes
  .map(quote => ({
    file: quote.file,
    line: quote.line,
    text: quote.text,
    context: sliceLines.readContextAround(quote.file, quote.line, LINES_OF_CONTEXT),
  }));

const EVERY_FILE_NAMED = "";

const collectPlacesRead = quotedLines => quotedLines.flatMap(quoted => [
  { file: quoted.file, line: Number(quoted.line) || 0 },
  ...quoted.context.map(around => ({ file: quoted.file, line: around.line })),
]).filter(place => place.file);

const collectQuotedPlaces = quotedLines => quotedLines.map(quoted => ({ file: quoted.file, line: Number(quoted.line) || 0 })).filter(place => place.file);

const collectAddedListedFiles = (quotedLines, changedLines) => quotedLines
  .filter(quoted => changedLines.isAdded(quoted.file))
  .map(quoted => ({ file: quoted.file, line: LISTED_FILE_LINE_NUMBER }));

const collectPlacesOfTheItem = (scale, quotedLines, changedLines) => scale === Scale.MODULE.name
  ? [...collectPlacesRead(quotedLines), ...collectAddedListedFiles(quotedLines, changedLines)]
  : collectPlacesRead(quotedLines);

const collectCallerPlaces = callers => (callers || []).flatMap(caller => [
  { file: caller.file, line: caller.line },
  ...(caller.context || []).map(around => ({ file: caller.file, line: around.line })),
]);

const groupLinesByFile = places => places.reduce((linesByFileMap, place) => {
  linesByFileMap.set(place.file, [...(linesByFileMap.get(place.file) || []), place.line]);
  return linesByFileMap;
}, new Map());

const buildChangedLinesByFile = (places, changedLines) => Object.fromEntries([...groupLinesByFile(places)]
  .map(([file, lines]) => [file, changedLines.formatListedInTheFile(file, lines)]));

const collectBelongingAnswers = group => group.possibleFindings.flatMap(possibleFinding => [].concat(possibleFinding.belongingAnswers || [])).filter(Boolean);

export const buildDraftItems = (groups, sliceLines, changedLines = NO_CHANGED_LINES_TEXT) => groups.map((group, order) => {
  const lead = group.possibleFindings[0];
  const quotedLines = buildQuotedLines(group.possibleFindings.flatMap(possibleFinding => possibleFinding.quotes || []), sliceLines);
  const places = [...collectPlacesOfTheItem(group.scale, quotedLines, changedLines), ...collectCallerPlaces(group.callers)];
  return {
    id: group.id,
    number: order + 1,
    file: group.file,
    line: group.line,
    displayName: group.displayName,
    scale: group.scale,
    check: lead.check,
    confidence: lead.confidence || "high",
    summary: lead.summary || lead.sentence || "",
    direction: lead.direction || "",
    checks: [...new Set(group.possibleFindings.map(possibleFinding => possibleFinding.check))],
    consideredChecks: [...new Set(group.possibleFindings.filter(isAConsideration).map(possibleFinding => possibleFinding.check))],
    belongingAnswers: collectBelongingAnswers(group),
    judgeType: findJudgeType(lead.check, group.scale, group.judgeType) || "",
    inChange: isInTheChange(group),
    changedQuotedLines: changedLines.formatListedLines(EVERY_FILE_NAMED, collectQuotedPlaces(quotedLines)),
    changedLines: changedLines.formatListedLines(EVERY_FILE_NAMED, places),
    changedLinesByFileMap: buildChangedLinesByFile(places, changedLines),
    quotedLines,
    ...(group.callers ? { callers: group.callers } : {}),
  };
});
