import { liesInAnotherApplication, readApplicationName } from "../../../code/index.mjs";
import { CHECKS_BY_ID_MAP, TRACKS } from "../../../checks/CheckCatalog.mjs";
import { buildFileAndLineKey, stripLeadingDotSlash } from "../abstractions/AbstractionsAtPlaces.mjs";

export const NEAR_TWIN = "TWIN_MEMBERS";

const NOTHING_TO_CONSIDER = "";

const trimText = given => String(given || "").trim();

export const isAConsideration = finding => Boolean(trimText(finding.consider));

const listLinesOf = place => [].concat(place.lines || place.line || []).map(Number).filter(line => line > 0);

const listSameDecisionPlaces = finding => (finding.places || []).filter(place => place.sameDecision === true && place.file);

const listTwinOccurrences = codeUnderReview => (codeUnderReview.sameDecisionAt || []).filter(occurrence => occurrence.kind === NEAR_TWIN);

const formatNames = names => names.map(name => `\`${name}\``).join(" and ");

const askWhetherTheTwinsAreOneThing = codeUnderReview => `Do ${formatNames([codeUnderReview.name || codeUnderReview.displayName, ...new Set(listTwinOccurrences(codeUnderReview).map(occurrence => occurrence.key))])} stand for 1 thing that needs 1 owner, or for different things that only share members?`;

const liesInsideItsOwnSpan = (place, codeUnderReview) => {
  const ownSpan = codeUnderReview.lines;
  const lines = listLinesOf(place);
  return Boolean(ownSpan) && stripLeadingDotSlash(place.file) === stripLeadingDotSlash(codeUnderReview.path)
    && lines.length > 0 && lines.every(line => line >= ownSpan.from && line <= ownSpan.to);
};

const listSameDecisionPlacesOutsideItsOwnSpan = (finding, codeUnderReview) => listSameDecisionPlaces(finding)
  .filter(place => !liesInsideItsOwnSpan(place, codeUnderReview));

const collectSameDecisionPlaceKeysOutsideItsOwnSpan = (finding, codeUnderReview) => listSameDecisionPlacesOutsideItsOwnSpan(finding, codeUnderReview)
  .flatMap(place => listLinesOf(place).map(line => buildFileAndLineKey(place.file, line)));

const restsOnNearTwinsAlone = (finding, codeUnderReview) => {
  const twinOccurrences = listTwinOccurrences(codeUnderReview);
  if (!twinOccurrences.length) return false;
  const twinKeys = new Set(twinOccurrences.flatMap(occurrence => occurrence.places.map(place => buildFileAndLineKey(place.path, place.line))));
  const namedSameDecisionKeys = collectSameDecisionPlaceKeysOutsideItsOwnSpan(finding, codeUnderReview);
  return namedSameDecisionKeys.length ? namedSameDecisionKeys.every(key => twinKeys.has(key)) : (codeUnderReview.sameDecisionAt || []).every(occurrence => occurrence.kind === NEAR_TWIN);
};

const restsOnlyOnOtherApplications = (finding, codeUnderReview, run) => {
  const places = listSameDecisionPlacesOutsideItsOwnSpan(finding, codeUnderReview);
  return places.length > 0 && places.every(place => liesInAnotherApplication(codeUnderReview.path, stripLeadingDotSlash(place.file), run.applicationRoots));
};

const namesOfTheApplications = (codeUnderReview, finding, run) => {
  const home = readApplicationName(codeUnderReview.path, run.applicationRoots);
  const others = listSameDecisionPlacesOutsideItsOwnSpan(finding, codeUnderReview).map(place => readApplicationName(stripLeadingDotSlash(place.file), run.applicationRoots));
  return [...new Set([home, ...others].filter(Boolean))];
};

const askWhetherTheApplicationsMustAgree = (codeUnderReview, finding, run) => {
  const applications = namesOfTheApplications(codeUnderReview, finding, run);
  const named = applications.length > 1 ? `applications ${formatNames(applications)}` : "these applications";
  return `Must ${named} always give the same answer for the system to stay correct, or is the copy kept on purpose, such as to save a remote call or to check the same input on both sides?`;
};

const isARepeatedDecision = (finding, codeUnderReview) => codeUnderReview && codeUnderReview.track === TRACKS.DECISION && finding.check === CHECKS_BY_ID_MAP.S1.id;

const findTheQuestion = (finding, codeUnderReview, run) => {
  if (!isARepeatedDecision(finding, codeUnderReview)) return NOTHING_TO_CONSIDER;
  if (restsOnlyOnOtherApplications(finding, codeUnderReview, run)) return askWhetherTheApplicationsMustAgree(codeUnderReview, finding, run);
  if (restsOnNearTwinsAlone(finding, codeUnderReview)) return askWhetherTheTwinsAreOneThing(codeUnderReview);
  return NOTHING_TO_CONSIDER;
};

const markTheConsideration = (finding, codeUnderReview, run) => {
  if (isAConsideration(finding)) return { ...finding, consider: trimText(finding.consider) };
  const question = findTheQuestion(finding, codeUnderReview, run);
  return question ? { ...finding, consider: question } : finding;
};

export function markTheConsiderations(findings, everyCodeUnderReview = [], run = {}) {
  const codeUnderReviewByIdMap = new Map(everyCodeUnderReview.map(codeUnderReview => [codeUnderReview.id, codeUnderReview]));
  const runFacts = { applicationRoots: run.applicationRoots || [] };
  return findings.map(finding => markTheConsideration(finding, codeUnderReviewByIdMap.get(finding.codeUnderReviewId), runFacts));
}
