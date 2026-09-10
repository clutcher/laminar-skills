import { Scale } from "../../../code/index.mjs";
import { CHECKS_BY_ID_MAP } from "../../../checks/CheckCatalog.mjs";
import { stripLeadingDotSlash } from "../abstractions/AbstractionsAtPlaces.mjs";

const THE_LOWEST_CONFIDENCE = "low";

const isExcludeIllegalStates = finding => finding.check === CHECKS_BY_ID_MAP.CP1.id;

const escapeForAPattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const namesTheWordIn = (text, word) => new RegExp(`(^|[^A-Za-z0-9_])${escapeForAPattern(word)}([^A-Za-z0-9_]|$)`).test(String(text || ""));

const isInsideTheAbstraction = (line, abstractionSpan) => !abstractionSpan || (line >= abstractionSpan.from && line <= abstractionSpan.to);

const isAPlaceInsideTheSet = (place, set) => stripLeadingDotSlash(place.file) === stripLeadingDotSlash(set.path)
  && (place.lines || []).every(line => isInsideTheAbstraction(line, set.lines));

const isAPlaceOutsideTheSet = (place, set) => stripLeadingDotSlash(place.file) !== stripLeadingDotSlash(set.path)
  || (place.lines || []).every(line => !isInsideTheAbstraction(line, set.lines));

const restsOnlyOnItsOwnCases = (finding, set) => {
  const evidence = finding.evidence || [];
  return evidence.length > 0 && evidence.every(place => isAPlaceInsideTheSet(place, set));
};

const isASpeculativeSetFinding = (finding, set) => Boolean(set) && set.scale === Scale.CLASS.name && !finding.scriptRaised
  && isExcludeIllegalStates(finding) && finding.confidence === THE_LOWEST_CONFIDENCE && restsOnlyOnItsOwnCases(finding, set);

const namesTheSetAtAUse = (finding, set) => namesTheWordIn(finding.established, set.name)
  && (finding.evidence || []).length > 0 && (finding.evidence || []).every(place => isAPlaceOutsideTheSet(place, set));

export function splitSetFindingsFoldedIntoAUse(findings, everyCodeUnderReview = []) {
  const codeUnderReviewByIdMap = new Map(everyCodeUnderReview.map(codeUnderReview => [codeUnderReview.id, codeUnderReview]));
  const setOf = finding => codeUnderReviewByIdMap.get(finding.codeUnderReviewId);
  const speculative = findings.filter(finding => isASpeculativeSetFinding(finding, setOf(finding)));
  const useFindings = findings.filter(finding => isExcludeIllegalStates(finding) && !speculative.includes(finding));
  const isFolded = finding => speculative.includes(finding)
    && useFindings.some(useFinding => useFinding.codeUnderReviewId !== finding.codeUnderReviewId && namesTheSetAtAUse(useFinding, setOf(finding)));
  return { kept: findings.filter(finding => !isFolded(finding)), folded: findings.filter(isFolded) };
}
