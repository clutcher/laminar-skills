import { CHECK_WORDS, findCheckWords } from "../../../checks/CheckWords.mjs";
import { convertToText } from "../sections/ReturnedValueText.mjs";
import { formatLeadWords, formatDisplayNameText, formatDirectionText, formatDirectionOfTheFinding } from "../sections/ItemText.mjs";
import { selectScopeProperties } from "../sections/ScopeLine.mjs";

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

const buildProperties = finding => {
  const abstraction = finding.abstraction || {};
  const properties = {
    abstraction: formatDisplayNameText(finding) || abstraction.displayName || "",
    scale: String(finding.scale || abstraction.scale || ""),
    check: finding.check,
    mechanism: convertToText(finding.mechanism || finding.decision || finding.prevention),
    direction: formatDirectionOfTheFinding(finding),
    confidence: finding.confidence,
    what_would_confirm: finding.confidence === "high" ? "" : convertToText(finding.whatWouldConfirm),
    ...buildTestPlanProperties(finding),
  };
  if (finding.combined) properties.rule_ids = [...finding.combined.checks];
  const second = (finding.alsoAt || [])[0];
  if (second && second.displayName) properties.also_abstraction = second.displayName;
  if ((finding.callerApplications || []).length) Object.assign(properties, { entry_boundary_of: finding.application, called_by: [...finding.callerApplications] });
  return properties;
};

const isPlace = given => Boolean(given && typeof given === "object" && given.file);

const buildDescribedPlace = (place, role) => {
  const described = { ...buildLocation(place.file, place.line), message: { text: role } };
  return place.displayName ? { ...described, logicalLocations: [{ fullyQualifiedName: place.displayName }] } : described;
};

const RELATED_ROLES = Object.freeze([
  ["entry", () => "entry"],
  ["exit", () => "exit"],
  ["takenBy", () => "taken by"],
  ["branches", branch => convertToText(branch.outcome) ? `branch: ${convertToText(branch.outcome)}` : "branch"],
]);

const buildTestPlanPlaces = finding => RELATED_ROLES.flatMap(([field, roleOf]) => [finding[field]].flat()
  .filter(isPlace)
  .map(place => buildDescribedPlace(place, roleOf(place))));

const buildAcrossApplicationsPlaces = finding => (finding.callerApplications || []).length ? [
  ...(finding.callers || []).map(caller => buildDescribedPlace(caller, `caller in ${caller.application}`)),
  ...(finding.fills || []).map(fill => buildDescribedPlace(fill, `fill in ${finding.application}`)),
] : [];

const isTheFirstOfItsKind = (location, order, locations) => locations.findIndex(other => JSON.stringify(other) === JSON.stringify(location)) === order;

const buildRelatedLocations = finding => [
  ...(finding.alsoAt || []).map(place => buildLocation(place.file, place.line)),
  ...buildTestPlanPlaces(finding),
  ...buildAcrossApplicationsPlaces(finding),
].filter(isTheFirstOfItsKind);

const BASELINE_STATES = Object.freeze({ IN_THE_CHANGE: "new", EXISTING_CODE: "unchanged" });

const chooseBaselineState = finding => finding.inChange === false ? BASELINE_STATES.EXISTING_CODE : BASELINE_STATES.IN_THE_CHANGE;

const formatMessage = finding => {
  const summary = convertToText(finding.summary || finding.sentence).trim();
  return summary ? `${formatLeadWords(finding)}: ${summary}` : formatLeadWords(finding);
};

const buildResult = finding => {
  const checkWords = findCheckWords(finding.check);
  const result = {
    ruleId: checkWords ? checkWords.id : finding.check,
    level: LEVELS.FINDING,
    baselineState: chooseBaselineState(finding),
    rank: RANK_OF_CONFIDENCE[finding.confidence] || RANK_OF_CONFIDENCE.high,
    message: { text: formatMessage(finding) },
    locations: [buildNamedPlace(finding)],
    properties: buildProperties(finding),
  };
  const related = buildRelatedLocations(finding);
  if (related.length) result.relatedLocations = related;
  return result;
};

const CONFIDENCE_PROPERTIES = Object.freeze(["confidence", "what_would_confirm"]);

const buildConsiderationProperties = finding => ({
  ...Object.fromEntries(Object.entries(buildProperties(finding)).filter(([name]) => !CONFIDENCE_PROPERTIES.includes(name))),
  to_consider: true,
  summary: convertToText(finding.summary || finding.sentence),
});

const formatQuestion = finding => `${formatLeadWords(finding)}: ${convertToText(finding.consider).trim()}`;

const buildConsiderationResult = finding => {
  const { rank, ...result } = buildResult(finding);
  return { ...result, level: LEVELS.CONSIDERATION, message: { text: formatQuestion(finding) }, properties: buildConsiderationProperties(finding) };
};

const runPropertiesOf = (scope, acrossApplications) => ({
  ...(scope ? { scope: selectScopeProperties(scope) } : {}),
  ...(acrossApplications ? { entryBoundaries: { ...acrossApplications } } : {}),
});

export function buildSarifReport(kept, version, scope = null, acrossApplications = null, considered = []) {
  const properties = runPropertiesOf(scope, acrossApplications);
  return JSON.stringify({
    $schema: SCHEMA_URL,
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: DRIVER_NAME, version, informationUri: INFORMATION_URI, rules: sarifRules } },
      results: [...kept.map(buildResult), ...considered.map(buildConsiderationResult)],
      ...(Object.keys(properties).length ? { properties } : {}),
    }],
  }, null, 2) + "\n";
}
