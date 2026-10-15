import { convertToText } from "./ReturnedValueText.mjs";
import { readLead, findCheckWords, findDirection } from "../../../checks/CheckWords.mjs";
import { METHOD_MARK, stripLeadingDotSlash } from "../../merge/abstractions/AbstractionsAtPlaces.mjs";
import { selectOwnFindings } from "./OwnFindings.mjs";
import { isAConsideration } from "../../merge/filing/Considerations.mjs";

export const SUB_POINT_INDENT = "   ";

export const formatPhrase = text => {
  const trimmed = convertToText(text).trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

export const formatSentence = text => {
  const phrase = formatPhrase(text);
  return phrase && phrase.charAt(0).toUpperCase() + phrase.slice(1);
};

const formatKindWord = finding => {
  const scale = String(finding.scale || "").toLowerCase();
  return scale ? scale.charAt(0).toUpperCase() + scale.slice(1) : "Abstraction";
};

const ENCLOSING_MARK = " in ";

export const findIndexOfTheEnclosingMark = displayName => {
  const enclosingMarkIndex = displayName.indexOf(ENCLOSING_MARK);
  const methodMarkIndex = displayName.indexOf(METHOD_MARK);
  return enclosingMarkIndex >= 0 && (methodMarkIndex < 0 || enclosingMarkIndex < methodMarkIndex) ? enclosingMarkIndex : -1;
};

export const holdsAnEnclosingMark = displayName => findIndexOfTheEnclosingMark(displayName) >= 0;

const USED_BARE_IN = "used bare in";

const readUsingAbstraction = finding => (finding.abstraction || {}).usedIn || "";

export const formatDisplayNameText = finding => {
  const usingAbstraction = readUsingAbstraction(finding);
  return usingAbstraction ? `${finding.displayName} ${USED_BARE_IN} ${usingAbstraction}` : String(finding.displayName || "");
};

export const formatQuotedDisplayName = finding => {
  const usingAbstraction = readUsingAbstraction(finding);
  return usingAbstraction ? `\`${finding.displayName}\` ${USED_BARE_IN} \`${usingAbstraction}\`` : `\`${finding.displayName}\``;
};

const readName = finding => {
  const displayName = finding.displayName || "";
  if (holdsAnEnclosingMark(displayName)) return displayName.slice(0, findIndexOfTheEnclosingMark(displayName));
  if (displayName.includes(METHOD_MARK)) return displayName.slice(displayName.indexOf(METHOD_MARK) + 1);
  if (displayName) return displayName;
  return (finding.abstraction && finding.abstraction.name) || "";
};

const readEnclosingName = finding => {
  const abstraction = finding.abstraction || {};
  if (abstraction.enclosing) return abstraction.enclosing;
  const displayName = finding.displayName || "";
  if (holdsAnEnclosingMark(displayName)) return displayName.slice(findIndexOfTheEnclosingMark(displayName) + ENCLOSING_MARK.length);
  return displayName.includes(METHOD_MARK) ? displayName.slice(0, displayName.indexOf(METHOD_MARK)) : "";
};

export const formatHead = finding => {
  if (readUsingAbstraction(finding)) return `${formatKindWord(finding)} ${formatQuotedDisplayName(finding)}`;
  const name = readName(finding);
  const enclosingName = readEnclosingName(finding);
  const enclosingSuffix = enclosingName && enclosingName !== name && !name.startsWith(`${enclosingName}.`) ? ` in \`${enclosingName}\`` : "";
  return `${formatKindWord(finding)} \`${name}\`${enclosingSuffix}`;
};


const isInItsOwnFile = (place, finding) => !place.file || stripLeadingDotSlash(place.file) === stripLeadingDotSlash(finding.file);

const isItsOwnName = (place, finding) => [readName(finding), finding.displayName].includes(place.displayName) && isInItsOwnFile(place, finding);

const sharesItsName = (place, others) => others.filter(other => other.displayName === place.displayName).length > 1;

const doesItsApplicationTellItApart = (place, finding, shown) => Boolean(place.application)
  && !(place.displayName === finding.displayName && place.inItsOwnApplication)
  && shown.filter(other => other.displayName === place.displayName && other.application === place.application).length === 1;

const formatAlsoInName = (place, finding, shown) => {
  const name = `\`${place.displayName}\``;
  if (place.displayName !== finding.displayName && !sharesItsName(place, shown)) return name;
  if (doesItsApplicationTellItApart(place, finding, shown)) return `${name} in application \`${place.application}\``;
  return `${name} in \`${stripLeadingDotSlash(place.file)}\``;
};

const formatAlsoIn = finding => {
  const shown = (finding.alsoAt || []).filter(place => place.displayName && !isItsOwnName(place, finding));
  return shown.map(place => formatAlsoInName(place, finding, shown)).join("; ");
};

export const COMBINED_LEADS_SEPARATOR = " / ";

export const formatLeadWords = finding => finding.combined
  ? finding.combined.checks.map(readLead).join(COMBINED_LEADS_SEPARATOR)
  : readLead(finding.check);

export const PLACES_LEFT_UNOPENED = "Other places the review did not open may hold the same decision.";

const CONFIDENCE_WORDS = Object.freeze({ high: "High", moderate: "Moderate", low: "Low" });

const FIX_LABELS = Object.freeze({ ONE: "Possible fix", MANY: "Possible fixes" });

const IF_A_DEFECT = ", if this is a defect";

const LABELS = Object.freeze({
  FOUND: "Found",
  PATH: "Path",
  BRANCHES: "Branches",
  INPUT: "Input",
  TAKEN_BY: "Taken by",
  UNVERIFIED: "Unverified",
  FIX: FIX_LABELS.ONE,
  ALSO_IN: "Also in",
  ACROSS_APPLICATIONS: "Across applications",
  PLACES_LEFT_UNOPENED: "Places left unopened",
  CONFIDENCE: "Confidence",
  NOT_VERIFIED: "Not verified",
});

const POINT_ORDER = Object.freeze([
  LABELS.FOUND, LABELS.PATH, LABELS.BRANCHES, LABELS.INPUT, LABELS.TAKEN_BY, LABELS.UNVERIFIED,
  LABELS.FIX, LABELS.ALSO_IN, LABELS.ACROSS_APPLICATIONS, LABELS.PLACES_LEFT_UNOPENED, LABELS.CONFIDENCE, LABELS.NOT_VERIFIED,
]);

const BLOCK_LINES = Object.freeze({
  [LABELS.FIX]: `- ${FIX_LABELS.MANY}:`,
  [LABELS.PLACES_LEFT_UNOPENED]: `- ${PLACES_LEFT_UNOPENED}`,
});

const NESTED_POINT_INDENT = "  ";

const createLabeledPoint = (label, text) => text ? { label, text, line: `- ${label}: ${text}` } : null;

const createNamedPoint = (label, text) => text ? { label, text, line: `- ${label} ${text}` } : null;

const isHigh = finding => finding.confidence === "high";

const formatToConfirmClause = finding => {
  const whatWouldConfirm = formatPhrase(finding.whatWouldConfirm);
  return whatWouldConfirm ? ` To confirm: ${whatWouldConfirm}` : "";
};

const formatConfidenceText = finding => isHigh(finding)
  ? CONFIDENCE_WORDS.high
  : `${CONFIDENCE_WORDS[finding.confidence] || finding.confidence}.${formatToConfirmClause(finding)}`;

const formatSummaryLine = finding => {
  const lead = formatLeadWords(finding);
  const summary = formatSentence(isAConsideration(finding) ? finding.consider : finding.summary || finding.sentence);
  return summary ? `- ${lead}: ${summary}` : `- ${lead}.`;
};

const createFoundPoint = finding => isAConsideration(finding) ? createLabeledPoint(LABELS.FOUND, formatSentence(finding.summary || finding.sentence)) : null;

const PLACE_WITH_NO_NAME_PATTERN = /:\d+$/;

export const formatPlaceName = place => {
  const displayName = String((place || {}).displayName || "");
  return displayName && !PLACE_WITH_NO_NAME_PATTERN.test(displayName) ? `\`${displayName}\`` : "";
};

const joinOutcomes = given => (given || []).map(branch => convertToText(branch.outcome).trim().replace(/[.]$/, "")).filter(Boolean).join("; ");

const createPathPoint = (finding, exitWord) => {
  const phrases = [];
  const entryBoundaryName = formatPlaceName(finding.entry);
  const exit = formatPlaceName(finding.exit);
  if (entryBoundaryName) phrases.push(`enters at ${entryBoundaryName}`);
  if (exit) phrases.push(`${exitWord} ${exit}`);
  const outcome = convertToText(finding.outcome).trim();
  if (outcome) phrases.push(`checks ${outcome}`);
  return phrases.length ? createLabeledPoint(LABELS.PATH, formatPhrase(phrases.join(", "))) : null;
};

const createBranchesPoint = finding => {
  const outcomes = joinOutcomes(finding.branches);
  return outcomes ? createLabeledPoint(LABELS.BRANCHES, formatPhrase(outcomes)) : null;
};

const createInputPoint = finding => createLabeledPoint(LABELS.INPUT, formatSentence(finding.input));

const createTakenByPoint = finding => {
  const names = (finding.takenBy || []).map(formatPlaceName).filter(Boolean);
  return names.length ? createNamedPoint(LABELS.TAKEN_BY, `${names.join("; ")}.`) : null;
};

const createUnverifiedPoint = finding => createLabeledPoint(LABELS.UNVERIFIED, formatSentence(finding.unverified));

const TEST_PLAN_POINTS = Object.freeze({
  CD4: finding => [createPathPoint(finding, "exits at")],
  CD5: finding => [createBranchesPoint(finding), createInputPoint(finding)],
  CD6: finding => [createTakenByPoint(finding)],
  CD7: finding => [createPathPoint(finding, "stops at"), createUnverifiedPoint(finding)],
});

const createTestPlanPoints = finding => {
  const checkWords = findCheckWords(finding.check);
  const pointsOf = checkWords && TEST_PLAN_POINTS[checkWords.id];
  return pointsOf ? pointsOf(finding) : [];
};

const PRINTS_THE_PRACTICE = false;

const formatQuotedPassages = passages => passages.map(passage => `"${passage}"`).join(" ");

export const formatDirectionText = (check, judgeType = "") => {
  const direction = findDirection(check, judgeType);
  if (!direction.passages.length) return "";
  const words = [direction.principle, PRINTS_THE_PRACTICE ? direction.practice : ""].filter(Boolean).join(", ");
  return words ? `${formatSentence(words)} ${formatQuotedPassages(direction.passages)}` : formatQuotedPassages(direction.passages);
};

const readJudgeTypeOfTheDirection = finding => finding.standsInFor || finding.judgeType || "";

const listDirectionsOfTheFinding = finding => (finding.combined ? finding.combined.findings : [finding])
  .map(directedFinding => ({ lead: readLead(directedFinding.check), text: formatDirectionText(directedFinding.check, readJudgeTypeOfTheDirection(directedFinding)) }))
  .filter(direction => direction.text);

const keepTheFirstOfEachText = directions => directions.filter((direction, order) => directions.findIndex(other => other.text === direction.text) === order);

export const formatDirectionOfTheFinding = finding => keepTheFirstOfEachText(listDirectionsOfTheFinding(finding)).map(direction => direction.text).join(" ");

const formatDirectionLines = (directions, condition) => directions.length > 1
  ? [`- ${FIX_LABELS.MANY}${condition}:`, ...directions.map(direction => `${NESTED_POINT_INDENT}- ${direction.lead}: ${direction.text}`)]
  : [`- ${FIX_LABELS.ONE}${condition}: ${directions[0].text}`];

const createFixPoint = finding => {
  const directions = keepTheFirstOfEachText(listDirectionsOfTheFinding(finding));
  if (!directions.length) return null;
  const isConditional = isAConsideration(finding);
  return { label: LABELS.FIX, text: formatDirectionOfTheFinding(finding), lines: formatDirectionLines(directions, isConditional ? IF_A_DEFECT : ""), isConditional };
};

const createAlsoInPoint = finding => {
  const alsoIn = formatAlsoIn(finding);
  return alsoIn ? createNamedPoint(LABELS.ALSO_IN, `${alsoIn}.`) : null;
};

export const formatAcrossApplications = finding => ((finding.callerApplications || []).length
  ? `entry boundary of \`${finding.application}\`, called by ${finding.callerApplications.map(application => `\`${application}\``).join(", ")}`
  : "");

const createAcrossApplicationsPoint = finding => createLabeledPoint(LABELS.ACROSS_APPLICATIONS, formatPhrase(formatAcrossApplications(finding)));

const createPlacesLeftUnopenedPoint = finding => finding.placesLeftUnopened === true
  ? { label: LABELS.PLACES_LEFT_UNOPENED, text: "", line: `- ${PLACES_LEFT_UNOPENED}` }
  : null;

const createConfidencePoint = finding => isAConsideration(finding) ? null : createLabeledPoint(LABELS.CONFIDENCE, formatConfidenceText(finding));

const NOT_VERIFIED_TEXT = "the second read did not finish, so this is as its judge wrote it.";

const createNotVerifiedPoint = finding => finding.notVerified ? createLabeledPoint(LABELS.NOT_VERIFIED, NOT_VERIFIED_TEXT) : null;

const pointsOf = finding => [
  createFoundPoint(finding),
  ...createTestPlanPoints(finding),
  createFixPoint(finding),
  createAlsoInPoint(finding),
  createAcrossApplicationsPoint(finding),
  createPlacesLeftUnopenedPoint(finding),
  createConfidencePoint(finding),
  createNotVerifiedPoint(finding),
].filter(Boolean);

const isShownAsAConfidence = finding => !isHigh(finding);

const isShownAlone = (point, finding) => point.label !== LABELS.CONFIDENCE || isShownAsAConfidence(finding);

const formatSingleCheckPoints = finding => [
  formatSummaryLine(finding),
  ...pointsOf(finding).filter(point => isShownAlone(point, finding)).flatMap(point => point.lines || [point.line]),
];

const formatNestedLine = (finding, point) => {
  const lead = `${formatLeadWords(finding)}${point.isConditional ? IF_A_DEFECT : ""}`;
  return `${NESTED_POINT_INDENT}${point.text ? `- ${lead}: ${point.text}` : `- ${lead}.`}`;
};

const formatBlockLine = label => BLOCK_LINES[label] || `- ${label}:`;

const pointsUnder = (findings, label) => findings
  .map(finding => ({ finding, point: pointsOf(finding).find(point => point.label === label) }))
  .filter(findingPoint => findingPoint.point);

const isAShownBlock = (label, findingPoints) => findingPoints.length && (label !== LABELS.CONFIDENCE || findingPoints.some(({ finding }) => isShownAsAConfidence(finding)));

const keepTheFirstPointOfEachText = findingPoints => findingPoints.filter((findingPoint, order) => findingPoints.findIndex(other => other.point.text === findingPoint.point.text) === order);

const formatFixBlock = findings => {
  const findingPoints = keepTheFirstPointOfEachText(pointsUnder(findings, LABELS.FIX));
  if (findingPoints.length === 1) return findingPoints[0].point.lines;
  return findingPoints.length ? [formatBlockLine(LABELS.FIX), ...findingPoints.map(({ finding, point }) => formatNestedLine(finding, point))] : [];
};

const formatBlock = (findings, label) => {
  if (label === LABELS.FIX) return formatFixBlock(findings);
  const findingPoints = pointsUnder(findings, label);
  return isAShownBlock(label, findingPoints) ? [formatBlockLine(label), ...findingPoints.map(({ finding, point }) => formatNestedLine(finding, point))] : [];
};

const formatManyCheckPoints = findings => [
  ...findings.map(formatSummaryLine),
  ...POINT_ORDER.flatMap(label => formatBlock(findings, label)),
];

export const EXISTING_CODE = "existing code";

export const IN_THE_CHANGE = "in the change";

const formatExistingCodeMark = finding => finding.inChange === false ? ` · ${EXISTING_CODE}` : "";

const formatPointLines = findings => {
  const ownFindings = selectOwnFindings(findings);
  return ownFindings.length > 1 ? formatManyCheckPoints(ownFindings) : formatSingleCheckPoints(ownFindings[0]);
};

const readAbstractionLine = finding => Number((finding.ownLines || {}).from) || Number((finding.abstractionPlace || {}).line) || 0;

const buildHeadKey = finding => `${stripLeadingDotSlash(String(finding.file || ""))}::${finding.displayName || readName(finding)}`;

export const findLinesOfSharedHeads = findingsOfEveryItem => {
  const leads = findingsOfEveryItem.map(findings => findings[0]);
  const linesUnderTheSameHead = lead => new Set(leads.filter(other => buildHeadKey(other) === buildHeadKey(lead)).map(readAbstractionLine).filter(Boolean));
  return leads.map(lead => readAbstractionLine(lead) && linesUnderTheSameHead(lead).size > 1 ? readAbstractionLine(lead) : 0);
};

const formatSharedHeadLine = sharedHeadLine => sharedHeadLine ? ` · line ${sharedHeadLine}` : "";

export const formatItem = (findings, number, { tag = "", sharedHeadLine = 0 } = {}) => [
  `${number}.${tag ? ` [${tag}]` : ""} ${formatHead(findings[0])}${formatSharedHeadLine(sharedHeadLine)}${formatExistingCodeMark(findings[0])}`,
  ...formatPointLines(findings),
].filter(Boolean).map((line, order) => order ? `${SUB_POINT_INDENT}${line}` : line).join("\n");
