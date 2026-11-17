import { convertToText } from "../sections/ReturnedValueText.mjs";
import { formatAcrossApplications, formatDeclaredBySchema, formatDirectionOfTheFinding, COMBINED_LEADS_SEPARATOR, EXISTING_CODE, formatHead, IN_THE_CHANGE, formatQuotedDisplayName, PLACES_LEFT_UNOPENED, formatSentence, SUB_POINT_INDENT } from "../sections/ItemText.mjs";
import { readCheckName, readLead, TRACK_WORDS } from "../../../checks/CheckWords.mjs";
import { formatSweepWords } from "../../merge/draft/Sweep.mjs";
import { buildIoEndsSection } from "../sections/IoEndsSection.mjs";
import { MATCHED_BY } from "../verdicts/DecidedResults.mjs";
import { RELATION } from "../verdicts/RelatedDecisions.mjs";
import { DECIDED_BUT_CHANGED_SINCE, DECIDED_BY_THE_DESIGN, RAISED_AT_CLASS_SCALE, RELATED_TO_A_DECISION } from "./ReaderReport.mjs";
import { isAConsideration } from "../../merge/filing/Considerations.mjs";
import { LEFT_OUT_REASONS } from "../../../code/index.mjs";
import { NOT_VERIFIED_STAGES } from "../verdicts/SettledFindings.mjs";
import { isRefuted } from "../verdicts/VerifyReturns.mjs";

const quoteText = given => convertToText(given).split("\n").filter(line => line.trim()).map(line => `> ${line}`).join("\n");

const isTheSameName = (left, right) => String(left).trim().toLowerCase() === String(right).trim().toLowerCase();

const LEAD_SEPARATOR_PATTERN = /\s+\/\s+|\s*\(|\)\s*/;

const listNamesInTheLead = check => [readLead(check), ...readLead(check).split(LEAD_SEPARATOR_PATTERN)].filter(Boolean);

const isShownByTheLead = (name, check) => listNamesInTheLead(check).some(leadName => isTheSameName(leadName, name));

const findNamesBeyondTheLead = finding => [readCheckName(finding.check), finding.decision, finding.failure]
  .filter(Boolean)
  .filter((name, at, names) => !isShownByTheLead(name, finding.check) && names.findIndex(other => isTheSameName(other, name)) === at);

const formatNaming = finding => finding.question
  ? [`question ${finding.question}`, ...findNamesBeyondTheLead(finding)].join(", ")
  : findNamesBeyondTheLead(finding).join(", ");

const LISTED_FIELDS = [["fact", "Fact"],
  ["alternative", "Alternative"], ["boundary", "Boundary"], ["belongingAnswers", "Belonging answers"], ["count", "Count"],
  ["concept", "Concept"], ["established", "Established"], ["outcome", "Outcome"], ["input", "Input"],
  ["unverified", "Unverified"]];

const formatNamedPlace = place => {
  const at = `\`${place.file}${place.line ? `:${place.line}` : ""}\``;
  return place.displayName ? `${at}, \`${place.displayName}\`` : at;
};

const formatBranch = branch => [formatNamedPlace(branch), convertToText(branch.outcome)].filter(Boolean).join(": ");

const PLACED_FIELDS = [["entry", "Entry", formatNamedPlace], ["exit", "Exit", formatNamedPlace],
  ["branches", "Branches", formatBranch], ["takenBy", "Taken by", formatNamedPlace],
  ["coveredClaimRejected", "Covered by, a claim the verifier rejected", formatNamedPlace]];

const isPlace = given => Boolean(given && typeof given === "object" && given.file);

const formatPlacedLines = (label, given, lineOf) => Array.isArray(given)
  ? [`${label}:`, ...given.filter(isPlace).map(place => `- ${lineOf(place)}`)].join("\n")
  : `${label}: ${lineOf(given)}`;

const holdsAPlace = given => Array.isArray(given) ? given.some(isPlace) : isPlace(given);

const formatPlaceAnswer = place => `- ${place.file}${(place.lines || []).length ? `:${place.lines.join(", ")}` : ""}: ${place.sameDecision ? "the same decision" : "a different decision"}`;

const formatPlace = finding => `${finding.file}${finding.line ? `:${finding.line}` : ""}`;

const holdsSomething = given => Array.isArray(given) ? given.length > 0 : Boolean(given);

const formatListedLines = (label, given) => Array.isArray(given)
  ? [`${label}:`, ...given.map(listedValue => `- ${convertToText(listedValue)}`)].join("\n")
  : `${label}: ${convertToText(given)}`;

const formatCallerLines = finding => (finding.callers || [])
  .map(caller => `Caller in ${caller.application}: \`${caller.file}:${caller.line}\`\n${quoteText(caller.text)}`);

const formatAcrossApplicationsLines = finding => {
  const across = formatAcrossApplications(finding);
  return across ? [`Across applications: ${across}`, ...formatCallerLines(finding)] : [];
};

const causeLineOf = finding => `Cause: ${finding.inChange === false ? EXISTING_CODE : IN_THE_CHANGE}${finding.markSetByTheVerifier ? ", set by the verifier" : ""}`;

const formatSettledByTheVerifier = finding => (finding.loweredFrom ? `, lowered by the verifier from ${finding.loweredFrom}` : "");

const RAISED_BY_THE_SCRIPT_NOTE = ", raised by the script from the facts it read, which the verifier does not rule on";

const formatConfidenceLine = finding => `Confidence: ${finding.confidence}${finding.scriptRaised ? RAISED_BY_THE_SCRIPT_NOTE : formatSettledByTheVerifier(finding)}`;

const formatQuestionLine = finding => `To consider: ${convertToText(finding.consider).trim()}`;

const formatToConfirmLines = finding => (finding.whatWouldConfirm ? [`To confirm: ${convertToText(finding.whatWouldConfirm)}`] : []);

const formatConfidenceLines = finding => {
  if (isAConsideration(finding)) return [formatQuestionLine(finding), ...formatToConfirmLines(finding)];
  return [formatConfidenceLine(finding), ...formatToConfirmLines(finding)];
};

const NOT_SENT_TO_THE_REFUTER = "this version sends no test plan or I/O path item to the refuter";

const formatRefutationLine = refutation => `Refutation: ${[convertToText(refutation.answer) || "no answer", convertToText(refutation.line), convertToText(refutation.rule), convertToText(refutation.reason)].map(text => text.trim()).filter(Boolean).join(" · ")}`;

const NOT_VERIFIED_REASONS = Object.freeze({
  REFUTER: "no refuter call answered",
  VERIFIER: "the refuter refuted it and no verifier call answered",
  OLDER_VERIFIER: "no verdict came back",
});

const readNotVerifiedReason = finding => {
  if (finding.notVerified === NOT_VERIFIED_STAGES.REFUTER) return NOT_VERIFIED_REASONS.REFUTER;
  return isRefuted(finding.refutation) ? NOT_VERIFIED_REASONS.VERIFIER : NOT_VERIFIED_REASONS.OLDER_VERIFIER;
};

const formatSecondReadLines = finding => {
  if (finding.notSentToTheRefuter) return [`Refutation: not sent, because ${NOT_SENT_TO_THE_REFUTER}`];
  return [
    ...(finding.refutation ? [formatRefutationLine(finding.refutation)] : []),
    ...(isRefuted(finding.refutation) && finding.verdictDecision ? [`Verdict: ${finding.verdictDecision}`] : []),
    ...(finding.notVerified ? [`Not verified: ${readNotVerifiedReason(finding)}, so this stands as its judge wrote it`] : []),
  ];
};

const formatCombinedChecksLine = finding => finding.combined.checks.map(check => `${check} ${readLead(check)}`).join(COMBINED_LEADS_SEPARATOR);

const formatSingleFinding = finding => {
  const lines = [`**\`${formatPlace(finding)}\`** — ${String(finding.scale || "").toLowerCase()} ${formatQuotedDisplayName(finding)} · ${convertToText(finding.summary || finding.sentence)}`];
  lines.push([`${finding.check} ${readLead(finding.check)}`, formatNaming(finding)].filter(Boolean).join(": "));
  if (finding.prediction) lines.push(`Reads as: ${convertToText(finding.prediction)}`, `Holds: ${convertToText(finding.found) || "not written"}`);
  if (finding.evidence) lines.push(quoteText(finding.evidence));
  if (finding.failureScenario) lines.push(`Cost: ${convertToText(finding.failureScenario)}`);
  for (const place of finding.alsoAt || []) lines.push(`Also at: \`${place.file}:${place.line}\`, \`${place.displayName}\`${place.quote ? `\n${quoteText(place.quote)}` : ""}`);
  if (formatDeclaredBySchema(finding)) lines.push(`Declared by the schema: ${formatDeclaredBySchema(finding)}`);
  if ((finding.places || []).length) lines.push(["Places:", ...finding.places.map(formatPlaceAnswer)].join("\n"));
  lines.push(...formatAcrossApplicationsLines(finding));
  if (finding.placesLeftUnopened === true) lines.push(PLACES_LEFT_UNOPENED);
  for (const [field, label, lineOf] of PLACED_FIELDS) if (holdsAPlace(finding[field])) lines.push(formatPlacedLines(label, finding[field], lineOf));
  for (const [field, label] of LISTED_FIELDS) if (holdsSomething(finding[field])) lines.push(formatListedLines(label, finding[field]));
  lines.push(causeLineOf(finding));
  lines.push(...formatConfidenceLines(finding));
  lines.push(...formatSecondReadLines(finding));
  for (const named of finding.linesNotInTheCode || []) lines.push(`Line not in the code at \`${named.file}:${named.line}\``);
  lines.push(`Direction: ${formatDirectionOfTheFinding(finding) || "none for this check"}`);
  return lines.join("\n");
};

const formatCombinedFinding = finding => [
  [`**\`${formatPlace(finding)}\`** — ${String(finding.scale || "").toLowerCase()} ${formatQuotedDisplayName(finding)} · ${convertToText(finding.summary)}`,
    `${finding.combined.foldedAtTheSameLine ? "Combined at the same line" : "Combined by the verifier"}: ${formatCombinedChecksLine(finding)}`,
    causeLineOf(finding),
    ...formatConfidenceLines(finding),
    `Direction: ${formatDirectionOfTheFinding(finding) || "none for this check"}`].join("\n"),
  ...finding.combined.findings.map(formatSingleFinding),
].join("\n\n");

const formatFinding = finding => finding.combined ? formatCombinedFinding(finding) : formatSingleFinding(finding);

const RELATION_WORDS = Object.freeze({
  [RELATION.SIBLING]: "the same check on a sibling",
  [RELATION.MEMBER_AND_CLASS]: "the same check on a member and its declaring class",
});

const formatSourceOfTheDecision = decision => [decision.plan === null ? "" : `plan ${decision.plan}`, decision.source].filter(Boolean).join(", ");

const formatRelatedDecisionLine = ({ decision, relation }) => `${RELATED_TO_A_DECISION}, by ${RELATION_WORDS[relation]}: ${decision.check} on ${decision.scale} \`${decision.displayName}\`, ${decision.reason}, decided by ${decision.decidedBy}, source: ${formatSourceOfTheDecision(decision) || "not stated"}: ${decision.says}`;

const NO_RELATED_DECISIONS = Object.freeze({ listRelatedOfTheFinding: () => [] });

// An open result keeps its place and its status; 1 line per related decision names the rule that relates it.
const formatOpenFinding = (finding, related) => [formatFinding(finding), ...related.listRelatedOfTheFinding(finding).map(formatRelatedDecisionLine)].join("\n");

const DETECTION = "Correctness · Detection";

const isTheTestLine = (quote, test) => quote.file === test.file && Number(quote.line) === Number(test.line) && Boolean(quote.text);

const findQuotedTestLine = (covered, test) => {
  const testLineQuote = (covered.quotes || []).find(quote => isTheTestLine(quote, test));
  return testLineQuote ? `${testLineQuote.file}:${testLineQuote.line}: ${testLineQuote.text}` : "";
};

const formatCallingTests = calledByTests => `  A helper that ${calledByTests.length} tests call: ${calledByTests.map(displayName => `\`${displayName}\``).join(", ")}`;

const formatCoveredPathHead = covered => `- ${formatNamedPlace(covered.abstractionPlace || {})} by ${formatNamedPlace(covered.test || {})}${covered.outcome ? `, checks ${convertToText(covered.outcome)}` : ""}`;

const formatCoveredPathSecondReadLines = covered => [
  ...(covered.refutation ? [`  ${formatRefutationLine(covered.refutation)}`] : []),
  ...(isRefuted(covered.refutation) && covered.verdictDecision ? [`  Verdict: ${covered.verdictDecision}`] : []),
  ...(covered.notVerified ? [`  Not verified: ${readNotVerifiedReason(covered)}, so it stays covered as its judge wrote it`] : []),
];

const formatCoveredPath = covered => {
  const test = covered.test || {};
  const lines = [formatCoveredPathHead(covered)];
  const quote = test.quote || covered.quote || findQuotedTestLine(covered, test);
  if (quote) lines.push(quoteText(quote).split("\n").map(line => `  ${line}`).join("\n"));
  if ((test.calledByTests || []).length) lines.push(formatCallingTests(test.calledByTests));
  lines.push(...formatCoveredPathSecondReadLines(covered));
  return lines.join("\n");
};

const formatCoveredPaths = covered => covered.length ? [["Covered paths:", ...covered.map(formatCoveredPath)].join("\n")] : [];

const formatTrackSection = (word, kept, covered, related) => {
  const findingsOfTheTrack = kept.filter(finding => finding.group === word);
  const coveredHere = word === DETECTION ? formatCoveredPaths(covered) : [];
  return [`## ${word}`, findingsOfTheTrack.length ? findingsOfTheTrack.map(finding => formatOpenFinding(finding, related)).join("\n\n") : `Nothing was found under ${word}.`, ...coveredHere].join("\n\n");
};

const formatConsiderationSection = (considered, related) => `## To consider\n\n${considered.length ? considered.map(finding => formatOpenFinding(finding, related)).join("\n\n") : "Nothing was left to consider."}`;

const formatClosedLines = closed => (closed || [])
  .map(closedCheck => `- ${closedCheck.displayName || closedCheck.codeUnderReviewId}, ${closedCheck.check}: ${convertToText(closedCheck.reason) || "not stated"}`);

const formatJudgedLines = judged => (judged || [])
  .map(judgedCheck => `- ${judgedCheck.displayName || judgedCheck.codeUnderReviewId}: ${judgedCheck.check}`);

const formatNotAnsweredLines = notAnswered => notAnswered.flatMap(unansweredJudgeCall => [
  `- ${convertToText(unansweredJudgeCall.reason)}`,
  ...(unansweredJudgeCall.classes || []).map(type => `  - \`${type.name}\`, \`${type.path}\``),
]);

const formatRejectedItem = (finding, order) => [
  `${order + 1}. ${formatHead(finding)}`,
  `${SUB_POINT_INDENT}- Check: ${readLead(finding.check)}`,
  ...(finding.refutation ? [`${SUB_POINT_INDENT}- ${formatRefutationLine(finding.refutation)}`] : []),
  `${SUB_POINT_INDENT}- Rejection reason: ${formatSentence(finding.fact) || "No fact was written."}`,
].join("\n");

const formatNotVerifiedLine = finding => `- \`${finding.file}:${finding.line}\`, ${finding.check}: ${readNotVerifiedReason(finding)}, so it stands as its judge wrote it`;

const formatRejectedCoveredPath = covered => [
  formatCoveredPathHead(covered),
  ...(covered.refutation ? [`  ${formatRefutationLine(covered.refutation)}`] : []),
  `  Rejection reason: ${formatSentence(covered.fact) || "No fact was written."}`,
].join("\n");

const formatRejectedSection = (settled, rejectedCoveredPaths) => {
  const rejected = settled.rejected.map(formatRejectedItem);
  const coveredPaths = rejectedCoveredPaths.length ? [["Covered paths the verifier rejected, so each prints as an Integration Test Needed finding and nowhere as covered:", ...rejectedCoveredPaths.map(formatRejectedCoveredPath)].join("\n")] : [];
  const blocks = [...rejected, ...coveredPaths];
  return `## Rejected\n\n${blocks.join("\n\n") || "The verifier rejected no item."}`;
};

const MATCHED_BY_WORDS = Object.freeze({
  [MATCHED_BY.DISPLAY_NAME]: "its display name",
  [MATCHED_BY.FORMER_NAME]: "its former name",
  [MATCHED_BY.CLASS_OF_THE_METHOD]: "the class of its method",
});

const formatRaisedWord = (decision, matchedBy) => (matchedBy === MATCHED_BY.CLASS_OF_THE_METHOD ? `, ${RAISED_AT_CLASS_SCALE} on \`${decision.displayName}\`` : "");

const formatReachWord = decision => (decision.reachOf ? `, decided by the reach of \`${decision.reachOf}\`` : "");

const formatDecisionLine = (decision, matchedBy) => `${SUB_POINT_INDENT}- Decided by the design: ${decision.reason}, decided by ${decision.decidedBy}: ${decision.says} · source: ${formatSourceOfTheDecision(decision) || "not stated"} · matched by ${MATCHED_BY_WORDS[matchedBy]}${formatRaisedWord(decision, matchedBy)}${formatReachWord(decision)}`;

const formatAlsoDecidedLine = decision => `${SUB_POINT_INDENT}- Also decided by: ${decision.reason}, ${formatSourceOfTheDecision(decision) || "not stated"}`;

const formatDecidedResult = mark => [
  formatFinding(mark.finding),
  formatDecisionLine(mark.decision, mark.matchedBy),
  ...mark.alsoDecidedBy.map(formatAlsoDecidedLine),
].join("\n");

const formatLinesFingerprintLine = mark => `${SUB_POINT_INDENT}- Lines fingerprint at the decision ${mark.decision.linesFingerprint}, ${mark.linesFingerprintNow ? `now ${mark.linesFingerprintNow}` : "now not readable in this run"}`;

const formatChangedSinceResult = mark => [formatDecidedResult(mark), formatLinesFingerprintLine(mark)].join("\n");

const formatChangedSinceList = changedSince => (changedSince.length ? [`${DECIDED_BUT_CHANGED_SINCE}:`, ...changedSince.map(formatChangedSinceResult)] : []);

const formatChangedSinceWord = decided => (decided.holdsALinesFingerprint ? `, ${decided.changedSince.length} changed since the decision` : "");

const formatDecisionKey = decision => `\`${decision.displayName}\`, ${decision.scale}, ${decision.check}`;

const formatNotMetLine = decision => `- ${formatDecisionKey(decision)}: ${decision.reason}, ${formatSourceOfTheDecision(decision) || "not stated"}`;

const formatAmbiguousLine = ({ decision, files }) => `- ${formatDecisionKey(decision)}: ${files.length} files hold the key, ${files.map(file => `\`${file}\``).join(" and ")}, and the decision names ${decision.file ? `\`${decision.file}\`` : "no file"}`;

const formatExpiredLine = ({ decision, finding, expiry }) => `- ${formatDecisionKey(decision)} at \`${finding.file}:${finding.line}\`: ${expiry}`;

const formatCombinedLeftOpenLine = ({ finding, decisions, openChecks }) => `- \`${decisions[0].displayName}\` at \`${finding.file}:${finding.line}\`: decided on ${decisions.map(decision => decision.check).join(" and ")}, not on ${openChecks.join(" and ")}, so the result stays in the items`;

const formatReachWithoutAFingerprintLine = decision => `- ${formatDecisionKey(decision)}: the reach of \`${decision.reachOf}\` gives this key no lines fingerprint, so nothing guards it`;

const formatOverrideLine = override => `- ${override.project || "a project convention"} over ${override.codeStyle || "a code-style rule"}: ${override.says || "not stated"}`;

const formatDecisionList = (title, lines, none) => `${title}\n\n${lines.join("\n") || none}`;

const formatDecidedSection = decided => [
  `## ${DECIDED_BY_THE_DESIGN}`,
  `Decided by the design: ${decided.filePath}, ${decided.decisionCount} decision(s), ${decided.decided.length} result(s) marked${formatChangedSinceWord(decided)}`,
  ...(decided.notAppliedReason ? [`Not applied: ${decided.notAppliedReason}, so every result stays where the review put it.`] : []),
  ...(decided.overrides.length ? [formatDecisionList("Project conventions the design follows over code-style:", decided.overrides.map(formatOverrideLine), "")] : []),
  ...decided.decided.map(formatDecidedResult),
  ...formatChangedSinceList(decided.changedSince),
  formatDecisionList("Not met:", decided.notMet.map(formatNotMetLine), "Every decision met a result."),
  formatDecisionList("Not applied, ambiguous:", decided.ambiguous.map(formatAmbiguousLine), "No decision was ambiguous."),
  formatDecisionList("Not applied, expired:", decided.expired.map(formatExpiredLine), "No decision expired."),
  ...(decided.combinedLeftOpen.length ? [formatDecisionList("Not applied, combined with a check no decision names:", decided.combinedLeftOpen.map(formatCombinedLeftOpenLine), "")] : []),
  ...(decided.reachWithoutAFingerprint.length ? [formatDecisionList("Not applied, reach without a fingerprint:", decided.reachWithoutAFingerprint.map(formatReachWithoutAFingerprintLine), "")] : []),
].join("\n\n");

const formatCoveredPathNotVerifiedLine = covered => `- ${formatNamedPlace(covered.abstractionPlace || {})} by ${formatNamedPlace(covered.test || {})}: ${readNotVerifiedReason(covered)}, so it stays covered as its judge wrote it`;

const formatNotSentLine = finding => `- \`${finding.file}:${finding.line}\`, ${finding.check}: ${NOT_SENT_TO_THE_REFUTER}`;

const formatNotVerifiedSection = (settled, covered) => {
  const notSent = settled.notSentToTheRefuter.map(formatNotSentLine);
  const notVerified = [...settled.notVerified.map(formatNotVerifiedLine), ...covered.filter(coveredPath => coveredPath.notVerified).map(formatCoveredPathNotVerifiedLine)];
  return [
    "## Not verified",
    notVerified.join("\n") || "Every possible finding and every covered path sent to a second read came back.",
    ...(notSent.length ? [["Not sent to a second read:", ...notSent].join("\n")] : []),
  ].join("\n\n");
};

const LEFT_OUT_REASON_TEXT_MAP = new Map([
  [LEFT_OUT_REASONS.BUILD_FILE, "this is a build file, so the review did not read its code"],
  [LEFT_OUT_REASONS.NO_LANGUAGE_DRIVER, "the review cannot read files of this kind, so it did not check this file"],
  [LEFT_OUT_REASONS.PROSE, "this file holds text and no code, so the review did not check it"],
  [LEFT_OUT_REASONS.TRIVIAL, "the change to this file is trivial, which means it changes only things such as spaces, comments, imports or a version number, or it moves lines, so the review did not check it"],
  [LEFT_OUT_REASONS.OUTSIDE_EVERY_TYPE, "no type in this file holds the changed lines, so the review did not judge this file on its own, though another judge may still read it as the caller of a changed file"],
]);

const formatLeftOutFileLines = leftOutFiles => leftOutFiles.map(leftOutFile => `- \`${leftOutFile.path}\`: ${LEFT_OUT_REASON_TEXT_MAP.get(leftOutFile.reason) || leftOutFile.reason}`);

const formatExcludedLine = excluded => (excluded.length
  ? `The caller excluded these paths, so nobody reviewed them: ${excluded.map(excludedPath => `\`${excludedPath}\``).join(", ")}`
  : "The caller excluded no path.");

const formatLeftOutFilesList = leftOutFiles => ["The review did not check these changed files:", formatLeftOutFileLines(leftOutFiles).join("\n")].join("\n\n");

const formatNotCheckedSection = (excluded, leftOutFiles) => [
  "## Not checked",
  formatExcludedLine(excluded),
  ...(leftOutFiles.length ? [formatLeftOutFilesList(leftOutFiles)] : []),
].join("\n\n");

export function buildEvidenceReport({ banner, scopeLine, acrossApplicationsLine, changeSummary, settled, covered, rejectedCoveredPaths, sweep, notAnswered, dropped, droppedWithNoCodeUnderReview, excluded, leftOutFiles, io, decided = null, related = null }) {
  const unmatched = settled.unmatchedVerdicts.map(verdict => `- ${verdict.itemId}${verdict.check ? `, ${verdict.check}` : ""}: ${verdict.reason}`);
  const droppedLines = [
    ...(dropped || []).map(finding => `- \`${finding.file}:${finding.line}\`, ${finding.check}: no line it names is in the code\n${quoteText((finding.quotes || []).map(named => `${named.file}:${named.line}`))}`),
    ...(droppedWithNoCodeUnderReview || []).map(finding => `- \`${finding.file}:${finding.line}\`, ${finding.check}: its code under review ${finding.codeUnderReviewId} is not in prepare.json`),
  ];
  return [
    banner,
    ...(scopeLine ? [scopeLine] : []),
    ...(acrossApplicationsLine ? [acrossApplicationsLine] : []),
    `## The change\n\n${formatSentence(changeSummary)}`,
    "## Reasoning\n\nEvery kept finding with its check, the cognitive failure or the prevention decision behind it, its full evidence, and the confidence the verifier settled, then every item to consider with its evidence and its question.",
    ...TRACK_WORDS.map(word => formatTrackSection(word, settled.kept, covered || [], related || NO_RELATED_DECISIONS)),
    formatConsiderationSection(settled.considered || [], related || NO_RELATED_DECISIONS),
    formatRejectedSection(settled, rejectedCoveredPaths || []),
    ...(decided ? [formatDecidedSection(decided)] : []),
    formatNotVerifiedSection(settled, covered || []),
    `## Verdicts with no item\n\n${unmatched.join("\n") || "Every verdict names an item and a check it holds."}`,
    `## Dropped\n\n${droppedLines.join("\n") || "The line check dropped no possible finding."}`,
    `## No finding, by a judge\n\n${formatJudgedLines(sweep.noFindingByAJudgeChecks).join("\n") || "No judge finished a check with no finding."}`,
    `## No finding, by the screen\n\n${formatClosedLines(sweep.noFindingByTheScreenChecks).join("\n") || "The screen closed no check."}`,
    `## Failed\n\n${formatClosedLines(sweep.failedChecks).join("\n") || "No check failed."}`,
    formatNotCheckedSection(excluded, leftOutFiles || []),
    `## Not scheduled\n\n${formatNotAnsweredLines(notAnswered || []).join("\n") || "Every check the tracks hold was scheduled."}`,
    buildIoEndsSection(io || {}),
    `## Sweep\n\n${formatSweepWords(sweep)}.`,
  ].join("\n\n") + "\n";
}
