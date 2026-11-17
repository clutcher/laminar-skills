import { CHECK_WORDS, findCheckWords, SCALE_ORDER } from "../../../checks/CheckWords.mjs";
import { convertToText } from "../sections/ReturnedValueText.mjs";
import { formatLeadWords, formatDisplayNameText, formatDirectionText, formatDirectionsWithTheirLeads } from "../sections/ItemText.mjs";
import { selectScopeProperties } from "../sections/ScopeLine.mjs";
import { ChangeKindsOfTheReport } from "./ChangeKindsOfTheReport.mjs";
import { isAConsideration } from "../../merge/filing/Considerations.mjs";
import { formatChangedSinceWords } from "./ReaderReport.mjs";

const SCHEMA_URL = "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json";
const INFORMATION_URI = "https://github.com/clutcher/laminar-skills";
const DRIVER_NAME = "laminar-review";
const LEVELS = Object.freeze({ FINDING: "warning", CONSIDERATION: "note" });

const RANK_OF_CONFIDENCE = Object.freeze({ high: 0.9, moderate: 0.6, low: 0.3 });

const buildHelp = checkWords => {
  const direction = formatDirectionText(checkWords.id);
  return direction ? { help: { text: direction } } : {};
};

const sarifRules = CHECK_WORDS.map(checkWords => ({ id: checkWords.id, name: checkWords.lead, shortDescription: { text: checkWords.text }, ...buildHelp(checkWords) }));

const buildLocation = (file, line) => ({
  physicalLocation: {
    artifactLocation: { uri: String(file || "") },
    ...(line ? { region: { startLine: Number(line) } } : {}),
  },
});

const buildNamedPlace = finding => {
  const name = formatDisplayNameText(finding);
  const place = buildLocation(finding.file, finding.line);
  return name ? { ...place, logicalLocations: [{ fullyQualifiedName: name }] } : place;
};

const TEST_PLAN_PROPERTIES = Object.freeze(["outcome", "input", "unverified"]);

const buildTestPlanProperties = finding => Object.fromEntries(TEST_PLAN_PROPERTIES
  .map(field => [field, convertToText(finding[field])])
  .filter(([, text]) => text));

const REASON_PROPERTIES = Object.freeze(["failure", "decision"]);

const buildReasonProperties = finding => Object.fromEntries(REASON_PROPERTIES
  .map(field => [field, convertToText(finding[field])])
  .filter(([, text]) => text));

const RELATED_ABSTRACTION_ROLES = Object.freeze([
  ["alsoAt", "also"],
  ["entry", "entry"],
  ["exit", "exit"],
  ["takenBy", "taken by"],
]);

const buildRelatedAbstractions = (finding, changeKinds) => RELATED_ABSTRACTION_ROLES.flatMap(([field, role]) => [finding[field]].flat()
  .filter(place => isPlace(place) && place.displayName)
  .map(place => ({ abstraction: place.displayName, role, changeKind: changeKinds.readKindAtThePlace(place) })));

const readTheScale = (finding, abstraction, displayName) => {
  const scale = finding.scale || abstraction.scale;
  if (!scale) throw new Error(`the finding of the check ${finding.check} on ${displayName || "an abstraction with no display name"} has no scale`);
  return String(scale);
};

const buildProperties = (finding, changeKinds) => {
  const abstraction = finding.abstraction || {};
  const relatedAbstractions = buildRelatedAbstractions(finding, changeKinds);
  const displayName = formatDisplayNameText(finding) || abstraction.displayName || "";
  const properties = {
    abstraction: displayName,
    scale: readTheScale(finding, abstraction, displayName),
    changeKind: changeKinds.readKindOfTheFinding(finding),
    test_code: Boolean(finding.isTest),
    check: finding.check,
    direction: formatDirectionsWithTheirLeads(finding),
    confidence: finding.confidence,
    what_would_confirm: finding.confidence === "high" ? "" : convertToText(finding.whatWouldConfirm),
    ...buildReasonProperties(finding),
    ...buildTestPlanProperties(finding),
  };
  if (finding.combined) properties.rule_ids = [...finding.combined.checks];
  const second = (finding.alsoAt || [])[0];
  if (second && second.displayName) properties.also_abstraction = second.displayName;
  if ((finding.callerApplications || []).length) Object.assign(properties, { entry_boundary_of: finding.application, called_by: [...finding.callerApplications] });
  if (isPlace(finding.declaredBySchema)) properties.declared_by_schema = finding.declaredBySchema.displayName;
  if (relatedAbstractions.length) properties.related_abstractions = relatedAbstractions;
  return properties;
};

const isPlace = given => Boolean(given && typeof given === "object" && given.file);

const pairWithItsDescribedLocation = (place, role) => {
  const described = { ...buildLocation(place.file, place.line), message: { text: role } };
  return [place, place.displayName ? { ...described, logicalLocations: [{ fullyQualifiedName: place.displayName }] } : described];
};

const RELATED_ROLES = Object.freeze([
  ["entry", () => "entry"],
  ["exit", () => "exit"],
  ["takenBy", () => "taken by"],
  ["branches", branch => convertToText(branch.outcome) ? `branch: ${convertToText(branch.outcome)}` : "branch"],
]);

const buildTestPlanPlaces = finding => RELATED_ROLES.flatMap(([field, roleOf]) => [finding[field]].flat()
  .filter(isPlace)
  .map(place => pairWithItsDescribedLocation(place, roleOf(place))));

const buildAcrossApplicationsPlaces = finding => (finding.callerApplications || []).length ? [
  ...(finding.callers || []).map(caller => pairWithItsDescribedLocation(caller, `caller in ${caller.application}`)),
  ...(finding.fills || []).map(fill => pairWithItsDescribedLocation(fill, `fill in ${finding.application}`)),
] : [];

const isTheFirstOfItsKind = (location, order, locations) => locations.findIndex(other => JSON.stringify(other) === JSON.stringify(location)) === order;

const DECLARED_BY_THE_SCHEMA_ROLE = "declared by the schema";

const buildDeclaredBySchemaPlaces = finding => (isPlace(finding.declaredBySchema) ? [pairWithItsDescribedLocation(finding.declaredBySchema, DECLARED_BY_THE_SCHEMA_ROLE)] : []);

const listTheRelatedPlaces = finding => [
  ...(finding.alsoAt || []).map(place => [place, buildLocation(place.file, place.line)]),
  ...buildDeclaredBySchemaPlaces(finding),
  ...buildTestPlanPlaces(finding),
  ...buildAcrossApplicationsPlaces(finding),
];

const buildRelatedLocations = (finding, changeKinds) => listTheRelatedPlaces(finding)
  .map(([place, location]) => ({ ...location, properties: { changeKind: changeKinds.readKindAtThePlace(place) } }))
  .filter(isTheFirstOfItsKind);

const BASELINE_STATES = Object.freeze({ IN_THE_CHANGE: "new", EXISTING_CODE: "unchanged" });

const chooseBaselineState = finding => finding.inChange === false ? BASELINE_STATES.EXISTING_CODE : BASELINE_STATES.IN_THE_CHANGE;

const formatMessage = finding => {
  const summary = convertToText(finding.summary || finding.sentence).trim();
  return summary ? `${formatLeadWords(finding)}: ${summary}` : formatLeadWords(finding);
};

const buildResult = (finding, changeKinds) => {
  const checkWords = findCheckWords(finding.check);
  const result = {
    ruleId: checkWords ? checkWords.id : finding.check,
    level: LEVELS.FINDING,
    baselineState: chooseBaselineState(finding),
    rank: RANK_OF_CONFIDENCE[finding.confidence] || RANK_OF_CONFIDENCE.high,
    message: { text: formatMessage(finding) },
    locations: [buildNamedPlace(finding)],
    properties: buildProperties(finding, changeKinds),
  };
  const related = buildRelatedLocations(finding, changeKinds);
  if (related.length) result.relatedLocations = related;
  return result;
};

const CONFIDENCE_PROPERTIES = Object.freeze(["confidence", "what_would_confirm"]);

const buildConsiderationProperties = (finding, changeKinds) => ({
  ...Object.fromEntries(Object.entries(buildProperties(finding, changeKinds)).filter(([name]) => !CONFIDENCE_PROPERTIES.includes(name))),
  to_consider: true,
  summary: convertToText(finding.summary || finding.sentence),
});

const formatQuestion = finding => `${formatLeadWords(finding)}: ${convertToText(finding.consider).trim()}`;

const buildConsiderationResult = (finding, changeKinds) => {
  const { rank, ...result } = buildResult(finding, changeKinds);
  return { ...result, level: LEVELS.CONSIDERATION, message: { text: formatQuestion(finding) }, properties: buildConsiderationProperties(finding, changeKinds) };
};

// SARIF states a decision in suppressions and never in level, so a reader that ignores suppressions sees the result as the review raised it.
// A suppression under review is pending, so a generic reader keeps a result decided but changed since visible, and only an accepted one counts as decided.
const SUPPRESSION = Object.freeze({ KIND: "external", STATUS: "accepted", STATUS_OF_THE_CHANGED_SINCE: "underReview" });

// A result the merge combined leaves the items only where a decision names each of its checks, so its suppression names every check it was decided on.
const buildCheckProperties = ({ finding, decision, alsoDecidedBy = [] }) => {
  if (!finding.combined) return {};

  const decidedChecks = new Set([decision, ...alsoDecidedBy].map(other => other.check));
  return { checks: [...finding.combined.checks].filter(check => decidedChecks.has(check)) };
};

const buildReachProperties = decision => (decision.reachOf ? { reachOf: decision.reachOf } : {});

const buildDecisionProperties = mark => ({ check: mark.decision.check, ...buildCheckProperties(mark), displayName: mark.decision.displayName, reason: mark.decision.reason, decidedBy: mark.decision.decidedBy, plan: mark.decision.plan, source: mark.decision.source, matchedBy: mark.matchedBy, ...buildReachProperties(mark.decision) });

const buildAcceptedSuppression = mark => ({
  kind: SUPPRESSION.KIND,
  status: SUPPRESSION.STATUS,
  justification: `${mark.decision.reason}: ${mark.decision.says}`,
  properties: buildDecisionProperties(mark),
});

const buildChangedSinceSuppression = mark => ({
  kind: SUPPRESSION.KIND,
  status: SUPPRESSION.STATUS_OF_THE_CHANGED_SINCE,
  justification: `${mark.decision.reason}: ${mark.decision.says}; ${formatChangedSinceWords(mark.decision)}`,
  properties: { ...buildDecisionProperties(mark), linesFingerprint: mark.decision.linesFingerprint, linesFingerprintNow: mark.linesFingerprintNow },
});

const buildSuppression = mark => (mark.changedSince ? buildChangedSinceSuppression(mark) : buildAcceptedSuppression(mark));

const buildDecidedResult = (mark, changeKinds) => {
  const result = isAConsideration(mark.finding) ? buildConsiderationResult(mark.finding, changeKinds) : buildResult(mark.finding, changeKinds);
  return { ...result, suppressions: [buildSuppression(mark)] };
};

const listTheScalesOfTheRun = scope => scope && scope.scales.length ? scope.scales : SCALE_ORDER;

const buildScopeProperties = scope => selectScopeProperties({ ...(scope || {}), scales: listTheScalesOfTheRun(scope) });

const runPropertiesOf = (scope, acrossApplications) => ({
  scope: buildScopeProperties(scope),
  ...(acrossApplications ? { entryBoundaries: { ...acrossApplications } } : {}),
});

const buildRelatedDecision = ({ decision, relation }) => ({ relation, check: decision.check, scale: decision.scale, displayName: decision.displayName, reason: decision.reason, plan: decision.plan });

// A related decision is a property of an open result and never a suppression, so the result keeps its level, its rank and its status.
const addTheRelatedDecisions = (result, finding, related) => {
  const relatedOfTheFinding = related ? related.listRelatedOfTheFinding(finding) : [];
  return relatedOfTheFinding.length ? { ...result, properties: { ...result.properties, related_decisions: relatedOfTheFinding.map(buildRelatedDecision) } } : result;
};

export function buildSarifReport(kept, version, scope = null, acrossApplications = null, considered = [], changeKinds = new ChangeKindsOfTheReport(), decided = [], related = null) {
  return JSON.stringify({
    $schema: SCHEMA_URL,
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: DRIVER_NAME, version, informationUri: INFORMATION_URI, rules: sarifRules } },
      results: [...kept.map(finding => addTheRelatedDecisions(buildResult(finding, changeKinds), finding, related)), ...considered.map(finding => addTheRelatedDecisions(buildConsiderationResult(finding, changeKinds), finding, related)), ...decided.map(mark => buildDecidedResult(mark, changeKinds))],
      properties: runPropertiesOf(scope, acrossApplications),
    }],
  }, null, 2) + "\n";
}
