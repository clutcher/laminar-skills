import { buildQuotedLines } from "./DraftItem.mjs";
import { formatPhrase, SUB_POINT_INDENT } from "../../render/sections/ItemText.mjs";

const THE_ID_MARK = "P";

const THE_HEADING = "## Covered paths";

const readDisplayName = place => (place && place.displayName) || "";

export const numberCoveredPathsAfter = (lastPossibleFindingNumber, givenPaths) => givenPaths.map((covered, order) => ({
  ...covered,
  id: `${THE_ID_MARK}${order + 1}`,
  number: lastPossibleFindingNumber + order + 1,
}));

export const buildDraftLinesOfCoveredPath = (covered, sliceLines) => ({
  id: covered.id,
  number: covered.number,
  displayName: readDisplayName(covered.abstractionPlace),
  test: readDisplayName(covered.test),
  calledByTests: (covered.test && covered.test.calledByTests) || [],
  check: covered.check,
  judgeType: covered.judgeType,
  outcome: covered.outcome || "",
  quotedLines: buildQuotedLines(covered.quotes || [], sliceLines),
});

const buildDraftItem = covered => [
  `${covered.number}. [${covered.id}] \`${readDisplayName(covered.abstractionPlace)}\` by \`${readDisplayName(covered.test)}\``,
  `${SUB_POINT_INDENT}- Outcome: ${formatPhrase(covered.outcome)}`,
].join("\n");

export const buildCoveredPathsDraft = coveredPaths => coveredPaths.length
  ? `\n${THE_HEADING}\n\n${coveredPaths.map(buildDraftItem).join("\n\n")}\n`
  : "";
