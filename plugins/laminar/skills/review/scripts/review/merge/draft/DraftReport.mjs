import { formatItem, findLinesOfSharedHeads } from "../../render/sections/ItemText.mjs";

const NOTHING_WAS_FOUND = "Nothing was found.";

const HEAD = "# The draft list";

const copyTheGroupChangeToItsPossibleFindings = group => group.possibleFindings.map(possibleFinding => ({ ...possibleFinding, inChange: group.inChange }));

export function buildDraftReport(groups) {
  if (!groups.length) return `${HEAD}\n\n## Findings\n\n${NOTHING_WAS_FOUND}\n`;
  const findingsOfEveryItem = groups.map(copyTheGroupChangeToItsPossibleFindings);
  const sharedHeadLines = findLinesOfSharedHeads(findingsOfEveryItem);
  const items = findingsOfEveryItem.map((findings, order) => formatItem(findings, order + 1, { tag: groups[order].id, sharedHeadLine: sharedHeadLines[order] }));
  return `${HEAD}\n\n## Findings\n\n${items.join("\n\n")}\n`;
}
