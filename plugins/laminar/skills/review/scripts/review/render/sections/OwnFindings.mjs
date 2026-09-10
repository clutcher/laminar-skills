import { collectQuotedPlaceKeys, stripLeadingDotSlash } from "../../merge/abstractions/AbstractionsAtPlaces.mjs";

const sitsAtTheSamePlace = (finding, other) => stripLeadingDotSlash(finding.file) === stripLeadingDotSlash(other.file) && finding.displayName === other.displayName;

const shareAQuotedLine = (finding, other) => {
  const otherPlaces = collectQuotedPlaceKeys([other]);
  return [...collectQuotedPlaceKeys([finding])].some(place => otherPlaces.has(place));
};

const holdsAJudgeCall = finding => Boolean(finding.possibleFindingId);

const comesFromTheSameJudgeCall = (finding, other) => {
  if (!holdsAJudgeCall(finding)) return false;
  return finding.possibleFindingId === other.possibleFindingId;
};

const isAnotherFindingThan = (finding, shown) => sitsAtTheSamePlace(finding, shown)
  && (comesFromTheSameJudgeCall(finding, shown) || !shareAQuotedLine(finding, shown));

const isAFindingOfItsOwn = (finding, shown) => shown
  .filter(other => other.check === finding.check)
  .every(other => isAnotherFindingThan(finding, other));

export const selectOwnFindings = findings => findings
  .reduce((shown, finding) => isAFindingOfItsOwn(finding, shown) ? [...shown, finding] : shown, []);
