import { IN_OUT_SIDES, liesInAnotherApplication } from "../../../code/index.mjs";
import { CHECKS_BY_ID_MAP, TRACKS } from "../../../checks/CheckCatalog.mjs";
import { isAnInOutOperation } from "../../prepare/relations/DesignRelationCodeUnderReview.mjs";
import { MAX_ENTRY_METHODS } from "../../prepare/abstractions/walks/BoundaryPathsWalk.mjs";
import { buildFileAndLineKey, stripLeadingDotSlash } from "../abstractions/AbstractionsAtPlaces.mjs";
import { OCCURRENCE_KINDS } from "../../prepare/abstractions/walks/decisions/SameDecisionWalk.mjs";

const CONFIDENCE_ORDER = Object.freeze(["high", "moderate", "low"]);

const PATCH_MODE = "PATCH";

const CEILING_BY_SIDE_MAP = Object.freeze({ [IN_OUT_SIDES.IN]: "low", [IN_OUT_SIDES.OUT]: "moderate" });

const NEEDED_TEST_CHECKS = Object.freeze([CHECKS_BY_ID_MAP.CD4.id, CHECKS_BY_ID_MAP.CD5.id]);

const ENTRY_BOUNDARY_CHECKS = Object.freeze([CHECKS_BY_ID_MAP.S1.id, CHECKS_BY_ID_MAP.CP1.id, CHECKS_BY_ID_MAP.D3.id]);

const NO_LIMIT = Object.freeze({ ceiling: null, confirm: "" });

const readRank = confidence => {
  const rank = CONFIDENCE_ORDER.indexOf(confidence);
  if (rank < 0) throw new Error(`the confidence "${confidence}" is none of ${CONFIDENCE_ORDER.join(", ")}`);
  return rank;
};

const isInPatchMode = run => run.mode === PATCH_MODE;

const listLinesOf = place => [].concat(place.lines || place.line || []).map(Number).filter(line => line > 0);

const listNamedPlaces = finding => [...(finding.evidence || []), ...(finding.alsoAt || []), ...(finding.abstractionPlace ? [finding.abstractionPlace] : [])]
  .flatMap(place => listLinesOf(place).map(line => ({ file: stripLeadingDotSlash(place.file || ""), line })));

const namesALineInside = (named, path, from, to) => named.some(place => place.file === stripLeadingDotSlash(path) && place.line >= from && place.line <= to);

const findTheInOutCeiling = codeUnderReview => (isAnInOutOperation(codeUnderReview) && CEILING_BY_SIDE_MAP[codeUnderReview.side] ? { ceiling: CEILING_BY_SIDE_MAP[codeUnderReview.side] } : NO_LIMIT);

const findModuleRootOfThePlace = (codeUnderReview, file) => (codeUnderReview.sameDecisionAt || []).flatMap(occurrence => occurrence.places || [])
  .filter(place => stripLeadingDotSlash(place.path) === stripLeadingDotSlash(file))
  .map(place => place.moduleRoot)
  .find(Boolean) || "";

const findTheOtherModuleRoots = (codeUnderReview, places) => {
  const homeRoot = (codeUnderReview.homeModule || {}).root || "";
  if (!homeRoot) return [];
  return [...new Set(places.map(place => findModuleRootOfThePlace(codeUnderReview, place.file)).filter(root => root && root !== homeRoot))];
};

const askWhetherTheModulesAgree = (homeRoot, otherRoots) => `Must module \`${homeRoot}\` and module ${otherRoots.map(root => `\`${root}\``).join(", ")} give the same answer for the system to stay correct?`;

const ASK_WHETHER_THE_INPUT_CAN_BE_THE_KEY = "Can the input itself serve as the key, so no made-up key is needed?";

const collectMatchingKeyPlaceKeys = codeUnderReview => new Set((codeUnderReview.sameDecisionAt || [])
  .filter(occurrence => occurrence.kind === OCCURRENCE_KINDS.MATCHING_KEY)
  .flatMap(occurrence => occurrence.places || [])
  .map(place => buildFileAndLineKey(place.path, place.line)));

const restsOnAMatchingKey = (codeUnderReview, places) => {
  const matchingKeyPlaceKeys = collectMatchingKeyPlaceKeys(codeUnderReview);
  const isAMatchingKeyPlace = place => listLinesOf(place).some(line => matchingKeyPlaceKeys.has(buildFileAndLineKey(place.file, line)));
  return matchingKeyPlaceKeys.size > 0 && places.length > 0 && places.every(isAMatchingKeyPlace);
};

const findTheModuleCeiling = (codeUnderReview, places, run) => {
  const inAnotherApplication = place => liesInAnotherApplication(codeUnderReview.path, stripLeadingDotSlash(place.file), run.applicationRoots);
  const placesInThisApplication = places.filter(place => !inAnotherApplication(place));
  const otherRoots = findTheOtherModuleRoots(codeUnderReview, placesInThisApplication);
  if (!otherRoots.length) return NO_LIMIT;
  const placesInOtherModules = placesInThisApplication.filter(place => otherRoots.includes(findModuleRootOfThePlace(codeUnderReview, place.file)));
  const confirm = restsOnAMatchingKey(codeUnderReview, placesInOtherModules) ? ASK_WHETHER_THE_INPUT_CAN_BE_THE_KEY : askWhetherTheModulesAgree(codeUnderReview.homeModule.root, otherRoots);
  return { ceiling: "moderate", confirm };
};

const PLACES_FROM_THE_PATCH_ALONE = "The places come from the patch alone, so the whole tree may hold more of them.";

const findTheDecisionLimits = (finding, codeUnderReview, run) => {
  const sameDecisionPlaces = (finding.places || []).filter(place => place.sameDecision === true && place.file);
  return [
    sameDecisionPlaces.length ? findTheModuleCeiling(codeUnderReview, sameDecisionPlaces, run) : NO_LIMIT,
    isInPatchMode(run) ? { ceiling: "moderate", confirm: PLACES_FROM_THE_PATCH_ALONE } : NO_LIMIT,
  ];
};

export const readTheNeededTestCeiling = run => isInPatchMode(run) ? "low" : "moderate";

const findTheTestPlanCeiling = (finding, run) => {
  if (NEEDED_TEST_CHECKS.includes(finding.check)) return { ceiling: readTheNeededTestCeiling(run) };
  if (finding.check === CHECKS_BY_ID_MAP.CD6.id && !(finding.takenBy || []).length) return { ceiling: "moderate" };
  if (finding.check === CHECKS_BY_ID_MAP.CD7.id && !(finding.entry && finding.exit)) return { ceiling: "moderate" };
  return NO_LIMIT;
};

const restsOnEveryEntryMethod = (finding, codeUnderReview) => {
  const entryMethods = codeUnderReview.entryMethods || [];
  const named = listNamedPlaces(finding);
  return entryMethods.length >= MAX_ENTRY_METHODS && entryMethods.every(entryMethod => namesALineInside(named, entryMethod.path, entryMethod.from, entryMethod.to));
};

const OTHER_ENTRY_METHODS_MAY_REACH = displayName => `Other entry methods may reach \`${displayName}\`, because the search kept at most ${MAX_ENTRY_METHODS} of them.`;

const findTheBoundaryPathCeiling = (finding, codeUnderReview) => (restsOnEveryEntryMethod(finding, codeUnderReview) ? { ceiling: "moderate", confirm: OTHER_ENTRY_METHODS_MAY_REACH(codeUnderReview.displayName) } : NO_LIMIT);

const findTheBoundariesOfTheFinding = (finding, codeUnderReview) => {
  const boundaries = codeUnderReview.boundaries || [];
  const named = listNamedPlaces(finding);
  const namedBoundaries = boundaries.filter(boundary => namesALineInside(named, boundary.path, boundary.line, boundary.to || boundary.line));
  return namedBoundaries.length ? namedBoundaries : boundaries;
};

const MORE_CALLERS_MAY_EXIST = stopped => `More callers may exist, because the search stopped at the ${stopped.join(", ")}.`;

const findTheEntryBoundaryLimits = (finding, codeUnderReview) => {
  if (!ENTRY_BOUNDARY_CHECKS.includes(finding.check)) return [];
  const boundaries = findTheBoundariesOfTheFinding(finding, codeUnderReview);
  const stopped = [...new Set(boundaries.flatMap(boundary => boundary.stopped || []))];
  return [
    boundaries.some(boundary => (boundary.sameNameOnOtherTypes || []).length) ? { ceiling: "moderate" } : NO_LIMIT,
    stopped.length ? { ceiling: null, confirm: MORE_CALLERS_MAY_EXIST(stopped) } : NO_LIMIT,
  ];
};

const LIMIT_FINDERS_BY_TRACK_MAP = Object.freeze({
  [TRACKS.DESIGN]: (finding, codeUnderReview) => [findTheInOutCeiling(codeUnderReview)],
  [TRACKS.DECISION]: (finding, codeUnderReview, run) => (finding.check === CHECKS_BY_ID_MAP.S1.id ? findTheDecisionLimits(finding, codeUnderReview, run) : []),
  [TRACKS.TEST_PLAN]: (finding, codeUnderReview, run) => [findTheTestPlanCeiling(finding, run)],
  [TRACKS.IO_PATHS]: () => [{ ceiling: "moderate" }],
  [TRACKS.BOUNDARY]: (finding, codeUnderReview) => [findTheBoundaryPathCeiling(finding, codeUnderReview)],
  [TRACKS.ENTRY_BOUNDARY]: (finding, codeUnderReview) => findTheEntryBoundaryLimits(finding, codeUnderReview),
});

const findTheLimits = (finding, codeUnderReview, run) => {
  const findLimits = codeUnderReview ? LIMIT_FINDERS_BY_TRACK_MAP[codeUnderReview.track] : null;
  return findLimits ? findLimits(finding, codeUnderReview, run) : [];
};

const chooseTheLowest = ceilings => ceilings.filter(Boolean).reduce((lowest, ceiling) => (lowest === null || readRank(ceiling) > readRank(lowest) ? ceiling : lowest), null);

const capConfidenceAt = (confidence, ceiling) => (ceiling === null || readRank(confidence) >= readRank(ceiling) ? confidence : ceiling);

const addTheSentences = (whatWouldConfirm, sentences) => {
  const written = String(whatWouldConfirm || "").trim();
  const missing = sentences.filter(sentence => sentence && !written.includes(sentence));
  return [written, ...missing].filter(Boolean).join(" ");
};

const applyTheLimits = (finding, limits) => {
  const ceiling = chooseTheLowest(limits.map(limit => limit.ceiling));
  const sentences = limits.map(limit => limit.confirm).filter(Boolean);
  if (ceiling === null && !sentences.length) return finding;
  const confidence = capConfidenceAt(finding.confidence || "high", ceiling);
  const whatWouldConfirm = addTheSentences(finding.whatWouldConfirm, sentences);
  const changed = confidence !== finding.confidence || whatWouldConfirm !== String(finding.whatWouldConfirm || "").trim();
  return changed ? { ...finding, confidence, ...(whatWouldConfirm ? { whatWouldConfirm } : {}) } : finding;
};

export function applyTheConfidenceCeilings(findings, everyCodeUnderReview = [], run = {}) {
  const codeUnderReviewByIdMap = new Map(everyCodeUnderReview.map(codeUnderReview => [codeUnderReview.id, codeUnderReview]));
  const runFacts = { mode: run.mode || "", applicationRoots: run.applicationRoots || [] };
  return findings.map(finding => applyTheLimits(finding, findTheLimits(finding, codeUnderReviewByIdMap.get(finding.codeUnderReviewId), runFacts)));
}
