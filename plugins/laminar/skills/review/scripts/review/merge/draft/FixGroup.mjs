import { readCheckRank, readScaleRank, readTrack } from "../../../checks/CheckWords.mjs";
import { CHECKS_BY_ID_MAP } from "../../../checks/CheckCatalog.mjs";
import { isInTheChange, isOnAnEntryBoundary, isPlacedByItsAbstractionPlace, buildPlaceAndFirstOwnLineKey, findSameDecisionPlacesOutsideItsOwnCode } from "../returns/PossibleFindings.mjs";
import { opensAnAnnotation } from "../../../code/index.mjs";
import { collectQuotedPlaceKeys, stripLeadingDotSlash } from "../abstractions/AbstractionsAtPlaces.mjs";
import { holdsAnEnclosingMark, findIndexOfTheEnclosingMark } from "../../render/sections/ItemText.mjs";
import { holdsCopiesOfOnePattern, repeatTheSamePattern } from "./SamePattern.mjs";

const TRACKS_JUDGED_ON_LINES = new Set(["PREVENTION", "BOUNDARY", "PERFORMANCE"]);

const CHECK_TRACKS_JUDGED_ON_LINES_ON_AN_ENTRY_BOUNDARY = new Set(["Correctness · Prevention"]);

const CONFIDENCE_ORDER = Object.freeze(["high", "moderate", "low"]);

const THE_REPEATED_DECISION = "S1";

const VALIDATE_AT_THE_BOUNDARY = CHECKS_BY_ID_MAP.CP6.id;

const THE_COMMENT_JUDGE = "judge-simplicity-comment";

const NO_APPLICATION = () => "";

const ENCLOSING_MARK = " in ";

const buildPlaceLineAndTrackKey = finding => `${buildPlaceAndFirstOwnLineKey(finding)}::${readTrack(finding.check)}`;

const isKeyedByItsPossibleFindingId = finding => isPlacedByItsAbstractionPlace(finding) && !isOnAnEntryBoundary(finding);

const isByTheCommentJudge = finding => finding.judgeType === THE_COMMENT_JUDGE;

const buildCommentKey = finding => (isByTheCommentJudge(finding) ? `::${THE_COMMENT_JUDGE}` : "");

const readAbstractionGroupKey = finding => isKeyedByItsPossibleFindingId(finding) || finding.scriptRaised === true ? finding.possibleFindingId : `${buildPlaceLineAndTrackKey(finding)}${buildCommentKey(finding)}`;

const compareByCheck = (left, right) => readCheckRank(left.check) - readCheckRank(right.check);

const restsOnItsOwnLines = finding => (finding.quotes || []).some(quote => quote.file === finding.file);

const quotesInItsOwnFileOf = finding => (finding.quotes || []).filter(quote => quote.file === finding.file);

const readFirstLineWithItsAnnotations = (ownLines, ownQuotes) => {
  const quotedAnnotationLines = new Set(ownQuotes.filter(quote => opensAnAnnotation(quote.text)).map(quote => Number(quote.line)));
  let first = ownLines.from;
  while (quotedAnnotationLines.has(first - 1)) first--;
  return first;
};

const restsInsideItsOwnLines = finding => {
  const ownQuotes = quotesInItsOwnFileOf(finding);
  if (!ownQuotes.length) return false;
  if (!finding.ownLines) return true;
  const first = readFirstLineWithItsAnnotations(finding.ownLines, ownQuotes);
  return ownQuotes.every(quote => Number(quote.line) >= first && Number(quote.line) <= finding.ownLines.to);
};

const readConfidenceRank = finding => Math.max(CONFIDENCE_ORDER.indexOf(finding.confidence), 0);

const compareByWhereTheDefectSits = (left, right) => compareByCheck(left, right)
  || Number(restsInsideItsOwnLines(right)) - Number(restsInsideItsOwnLines(left))
  || readScaleRank(right.scale) - readScaleRank(left.scale)
  || readConfidenceRank(left) - readConfidenceRank(right);

const groupPossibleFindingsByAbstraction = possibleFindings => {
  const possibleFindingsByAbstractionMap = new Map();
  for (const finding of possibleFindings) {
    const key = readAbstractionGroupKey(finding);
    if (!possibleFindingsByAbstractionMap.has(key)) possibleFindingsByAbstractionMap.set(key, []);
    possibleFindingsByAbstractionMap.get(key).push(finding);
  }
  return [...possibleFindingsByAbstractionMap.values()];
};

const shareACheck = (kept, named) => kept.some(possibleFinding => named.some(other => other.check === possibleFinding.check));

const namesInItsAlsoAt = (kept, named) => kept.some(possibleFinding => (possibleFinding.alsoAt || [])
  .some(place => place.file === named[0].file && place.displayName === named[0].displayName));

const shareAQuotedLine = (kept, named) => {
  const keptPlaces = collectQuotedPlaceKeys(kept);
  return [...collectQuotedPlaceKeys(named)].some(place => keptPlaces.has(place));
};

const holdsTheSameFinding = (kept, named) => kept !== named
  && kept[0].file === named[0].file
  && shareACheck(kept, named)
  && namesInItsAlsoAt(kept, named)
  && shareAQuotedLine(kept, named);

const cutOutTheEnclosingDisplayName = displayName => {
  if (holdsAnEnclosingMark(displayName)) return displayName.slice(findIndexOfTheEnclosingMark(displayName) + ENCLOSING_MARK.length);
  const cut = Math.max(displayName.lastIndexOf("#"), displayName.lastIndexOf("."));
  return cut > 0 ? displayName.slice(0, cut) : "";
};

const cutOutEveryEnclosingDisplayName = displayName => {
  const enclosingDisplayName = cutOutTheEnclosingDisplayName(displayName);
  return enclosingDisplayName ? [enclosingDisplayName, ...cutOutEveryEnclosingDisplayName(enclosingDisplayName)] : [];
};

const encloses = (outer, inner) => cutOutEveryEnclosingDisplayName(inner.displayName || "").includes(outer.displayName);

const isNestedIn = (possibleFinding, other) => possibleFinding.file === other.file && (encloses(possibleFinding, other) || encloses(other, possibleFinding));

const areNested = (one, other) => one.some(possibleFinding => other.some(otherPossibleFinding => isNestedIn(possibleFinding, otherPossibleFinding)));

const quotesOnlyTheFileOf = (quoting, quoted) => quoting.file !== quoted.file
  && (quoting.quotes || []).length > 0 && quoting.quotes.every(quote => quote.file === quoted.file);

const restsOnlyOnTheLinesOf = (quoting, quoted) => quoting.some(possibleFinding => quoted.some(other => quotesOnlyTheFileOf(possibleFinding, other)));

const isOneCommentResult = result => result.every(isByTheCommentJudge);

const quoteTheSameCommentOfOneAbstraction = (one, other) => isOneCommentResult(one) !== isOneCommentResult(other)
  && one[0].file === other[0].file
  && one[0].displayName === other[0].displayName
  && shareAQuotedLine(one, other);

const isJudgedOnLines = possibleFindingsOfTheItem => TRACKS_JUDGED_ON_LINES.has(possibleFindingsOfTheItem[0].track)
  || (isOnAnEntryBoundary(possibleFindingsOfTheItem[0]) && CHECK_TRACKS_JUDGED_ON_LINES_ON_AN_ENTRY_BOUNDARY.has(readTrack(possibleFindingsOfTheItem[0].check)));

const restOnTheSameCode = (one, other) => areNested(one, other) || restsOnlyOnTheLinesOf(one, other) || restsOnlyOnTheLinesOf(other, one);

const holdTheSameDefect = (one, other) => one !== other
  && isJudgedOnLines(one) && isJudgedOnLines(other)
  && shareACheck(one, other)
  && shareAQuotedLine(one, other)
  && restOnTheSameCode(one, other);

const groupIntoResults = possibleFindingsOfTheItem => {
  const possibleFindingsByCheckMap = new Map();
  for (const possibleFinding of [...possibleFindingsOfTheItem].sort(compareByWhereTheDefectSits)) {
    if (!possibleFindingsByCheckMap.has(possibleFinding.check)) possibleFindingsByCheckMap.set(possibleFinding.check, []);
    possibleFindingsByCheckMap.get(possibleFinding.check).push(possibleFinding);
  }
  return [...possibleFindingsByCheckMap.values()];
};


const findFilesOfCopiesInOtherApplications = (finding, applicationOf) => {
  if (finding.check !== THE_REPEATED_DECISION) return [];
  const own = applicationOf(stripLeadingDotSlash(finding.file));
  const files = findSameDecisionPlacesOutsideItsOwnCode(finding).map(place => stripLeadingDotSlash(place.file));
  if (!own || !files.length) return [];
  return files.some(file => [own, ""].includes(applicationOf(file))) ? [] : files;
};

const buildKeyOfFiles = files => [...new Set(files)].sort().join("|");

const buildPlacesKey = (finding, applicationOf) => buildKeyOfFiles(findFilesOfCopiesInOtherApplications(finding, applicationOf));

const buildEveryCopyKey = (finding, applicationOf) => {
  const files = findFilesOfCopiesInOtherApplications(finding, applicationOf);
  return files.length ? buildKeyOfFiles([stripLeadingDotSlash(finding.file), ...files]) : "";
};

const COPY_KEYS = [buildPlacesKey, buildEveryCopyKey];

const findKeyOfTheResult = (result, copyKeyOf, applicationOf) => {
  const keys = new Set(result.map(possibleFinding => copyKeyOf(possibleFinding, applicationOf)));
  return keys.size === 1 ? [...keys][0] : "";
};

const nameTheSameCopiesInOtherApplications = (one, other, applicationOf) => COPY_KEYS.some(copyKeyOf => {
  const key = findKeyOfTheResult(one, copyKeyOf, applicationOf);
  return Boolean(key) && key === findKeyOfTheResult(other, copyKeyOf, applicationOf);
});

const holdsCopiesInOtherApplications = (result, applicationOf) => COPY_KEYS.some(copyKeyOf => Boolean(findKeyOfTheResult(result, copyKeyOf, applicationOf)));

const compareByPlace = (left, right) => String(left.file || "").localeCompare(String(right.file || ""))
  || (Number(left.line) || 0) - (Number(right.line) || 0)
  || String(left.possibleFindingId || "").localeCompare(String(right.possibleFindingId || ""));

const areCopiesOfOneFinding = (one, other, applicationOf) => nameTheSameCopiesInOtherApplications(one, other, applicationOf) || repeatTheSamePattern(one, other);

const areTheSameResult = (one, other, applicationOf) => one !== other && one[0].check === other[0].check
  && (holdsTheSameFinding(one, other) || holdsTheSameFinding(other, one) || holdTheSameDefect(one, other)
    || quoteTheSameCommentOfOneAbstraction(one, other) || areCopiesOfOneFinding(one, other, applicationOf));

const compareKeepingOrder = (one, other, applicationOf) => Number(isOneCommentResult(one)) - Number(isOneCommentResult(other))
  || compareByWhereTheDefectSits(one[0], other[0])
  || (areCopiesOfOneFinding(one, other, applicationOf) ? compareByPlace(one[0], other[0]) : 0);

const buildDisplayNameKey = place => `${stripLeadingDotSlash(place.file || "")}::${place.displayName || ""}`;

const listAlsoAtKeys = result => new Set(result.flatMap(possibleFinding => (possibleFinding.alsoAt || []).map(buildDisplayNameKey)));

const isValidatedAtTheBoundary = result => result[0].check === VALIDATE_AT_THE_BOUNDARY;

const isACalleeOnTheSamePath = (callee, caller) => {
  if (callee === caller || !isValidatedAtTheBoundary(callee) || !isValidatedAtTheBoundary(caller)) return false;
  const callerKey = buildDisplayNameKey(caller[0]);
  const calleeAlsoAtKeys = listAlsoAtKeys(callee);
  const callerAlsoAtKeys = listAlsoAtKeys(caller);
  return calleeAlsoAtKeys.has(callerKey) && [...calleeAlsoAtKeys].some(key => key !== callerKey && callerAlsoAtKeys.has(key));
};

const findCalleeFold = items => {
  for (const item of items) {
    for (const result of item.results) {
      for (const otherItem of items.filter(other => other !== item)) {
        const caller = otherItem.results.find(otherResult => isACalleeOnTheSamePath(result, otherResult));
        if (caller) return { kept: { item: otherItem, result: caller }, named: { item, result }, foldedAsACallee: true };
      }
    }
  }
  return null;
};

const findJoinablePair = (items, applicationOf) => {
  for (const item of items) {
    for (const result of item.results) {
      for (const otherItem of items.filter(other => other !== item)) {
        const other = otherItem.results.find(otherResult => areTheSameResult(result, otherResult, applicationOf));
        if (other) return compareKeepingOrder(result, other, applicationOf) <= 0
          ? { kept: { item, result }, named: { item: otherItem, result: other } }
          : { kept: { item: otherItem, result: other }, named: { item, result } };
      }
    }
  }
  return null;
};

const readPlaceOfTheAbstraction = finding => ({ file: finding.file, line: finding.line, displayName: finding.displayName });

const buildPlaceKeyOrLine = place => `${stripLeadingDotSlash(place.file)}::${place.displayName || place.line}`;

const namesTheLeadInItsAlsoAt = (possibleFinding, lead) => (possibleFinding.alsoAt || []).some(place => buildDisplayNameKey(place) === buildDisplayNameKey(lead));

const isACallerQuotingTheLead = (possibleFinding, lead) => namesTheLeadInItsAlsoAt(possibleFinding, lead) && !restsInsideItsOwnLines(possibleFinding);

const isNamedAtItsOwnPlace = (possibleFinding, lead, carriesEveryPlace, foldedCallees) => !foldedCallees.has(possibleFinding)
  && (carriesEveryPlace || (restsOnItsOwnLines(possibleFinding) && !isACallerQuotingTheLead(possibleFinding, lead)));

const collectNamedPlaces = (lead, joined, carriesEveryPlace, foldedCallees) => {
  const named = new Set([buildPlaceKeyOrLine(readPlaceOfTheAbstraction(lead))]);
  const offered = [
    ...(lead.alsoAt || []),
    ...joined.flatMap(possibleFinding => [...(isNamedAtItsOwnPlace(possibleFinding, lead, carriesEveryPlace, foldedCallees) ? [readPlaceOfTheAbstraction(possibleFinding)] : []), ...(possibleFinding.alsoAt || [])]),
  ];
  return offered.filter(place => !named.has(buildPlaceKeyOrLine(place)) && named.add(buildPlaceKeyOrLine(place)));
};

const joinKeys = places => (places || []).map(buildPlaceKeyOrLine).join("|");

const holdsCopiesAtManyPlaces = (result, applicationOf) => holdsCopiesInOtherApplications(result, applicationOf)
  && new Set(result.map(possibleFinding => buildPlaceKeyOrLine(readPlaceOfTheAbstraction(possibleFinding)))).size > 1;

const selectLowestConfidence = result => result.reduce((lowest, possibleFinding) => readConfidenceRank(possibleFinding) > readConfidenceRank(lowest) ? possibleFinding : lowest);

const applyTheLowestConfidence = (lead, result) => {
  const lowest = selectLowestConfidence(result);
  return lowest === lead ? lead : { ...lead, confidence: lowest.confidence, whatWouldConfirm: lowest.whatWouldConfirm || lead.whatWouldConfirm };
};

const addTheirPlaces = (result, applicationOf, foldedCallees) => {
  const [lead, ...others] = result;
  const carriesEveryPlace = holdsCopiesAtManyPlaces(result, applicationOf) || holdsCopiesOfOnePattern(result);
  const places = collectNamedPlaces(lead, others, carriesEveryPlace, foldedCallees);
  return joinKeys(places) === joinKeys(lead.alsoAt) ? result : [{ ...lead, alsoAt: places }, ...others];
};

const applyTheLowestConfidenceAcrossApplications = (result, applicationOf) => {
  if (!holdsCopiesAtManyPlaces(result, applicationOf)) return result;
  const [lead, ...others] = result;
  const settled = applyTheLowestConfidence(lead, result);
  return settled === lead ? result : [settled, ...others];
};

const findPairToJoin = (items, applicationOf) => findCalleeFold(items) || findJoinablePair(items, applicationOf);

const joinResults = (items, applicationOf, foldedCallees) => {
  const joined = items.map(item => ({ results: [...item.results] }));
  for (let pair = findPairToJoin(joined, applicationOf); pair; pair = findPairToJoin(joined, applicationOf)) {
    const { kept, named } = pair;
    if (pair.foldedAsACallee) named.result.forEach(possibleFinding => foldedCallees.add(possibleFinding));
    named.item.results.splice(named.item.results.indexOf(named.result), 1);
    kept.item.results[kept.item.results.indexOf(kept.result)] = [...kept.result, ...named.result];
  }
  return joined.filter(item => item.results.length);
};

const settleResult = (result, applicationOf, foldedCallees) => applyTheLowestConfidenceAcrossApplications(addTheirPlaces(result, applicationOf, foldedCallees), applicationOf);

const collectPossibleFindingsOfTheItem = (item, applicationOf, foldedCallees) => item.results
  .map(result => settleResult(result, applicationOf, foldedCallees))
  .sort((left, right) => compareByCheck(left[0], right[0]))
  .flat();

export function buildFixGroups(possibleFindings, { applicationOf = NO_APPLICATION } = {}) {
  const groups = [];
  const foldedCallees = new Set();
  const items = groupPossibleFindingsByAbstraction(possibleFindings).map(possibleFindingsOfTheItem => ({ results: groupIntoResults(possibleFindingsOfTheItem) }));
  for (const item of joinResults(items, applicationOf, foldedCallees)) {
    const possibleFindingsOfTheItem = collectPossibleFindingsOfTheItem(item, applicationOf, foldedCallees);
    const lead = possibleFindingsOfTheItem[0];
    groups.push({
      id: `G${groups.length + 1}`,
      file: lead.file,
      line: lead.line,
      displayName: lead.displayName,
      scale: lead.scale,
      track: lead.track,
      judgeType: lead.judgeType,
      leadPossibleFindingId: lead.possibleFindingId,
      inChange: possibleFindingsOfTheItem.some(isInTheChange),
      possibleFindings: possibleFindingsOfTheItem,
    });
  }
  groups.sort((left, right) => readCheckRank(left.possibleFindings[0].check) - readCheckRank(right.possibleFindings[0].check));
  return groups.map((group, order) => ({ ...group, id: `G${order + 1}` }));
}
