import { formatItem } from "../../render/sections/ItemText.mjs";

const NOTHING_WAS_FOUND = "Nothing was found.";

const HEAD = "# The draft list";

const copyTheGroupChangeToItsPossibleFindings = group => group.possibleFindings.map(possibleFinding => ({ ...possibleFinding, inChange: group.inChange }));

export function buildDraftReport(groups) {
  if (!groups.length) return `${HEAD}\n\n## Findings\n\n${NOTHING_WAS_FOUND}\n`;
  const items = groups.map((group, order) => formatItem(copyTheGroupChangeToItsPossibleFindings(group), order + 1, group.id));
  return `${HEAD}\n\n## Findings\n\n${items.join("\n\n")}\n`;
}
