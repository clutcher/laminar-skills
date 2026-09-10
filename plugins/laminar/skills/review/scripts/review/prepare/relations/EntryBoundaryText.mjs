import { formatChangedLinesLine, formatRootLine } from "../formats/CodeUnderReviewText.mjs";
import { NO_CHANGED_LINES_TEXT } from "../formats/ChangedLinesText.mjs";
import { ENTRY_BOUNDARY_KINDS } from "../abstractions/walks/entryBoundaries/EntryBoundariesWalk.mjs";
import { readEntryBoundaryPlaces } from "./EntryBoundaryCodeUnderReview.mjs";

const EVERY_FILE_NAMED = "";

const CHANGE_WORDS = Object.freeze({ CREATED: "created", BOUNDARY_CHANGED: "boundary changed", INTERNALS_CHANGED: "internals changed" });

const WORDS_BY_KIND_MAP = Object.freeze({
  [ENTRY_BOUNDARY_KINDS.GRAPHQL_FIELD]: { count: "Fields", fill: "Fill", reached: "Query", reachedPlaces: "query places" },
  [ENTRY_BOUNDARY_KINDS.REST_ENDPOINT]: { count: "Endpoints", fill: "Served by", reached: "Call", reachedPlaces: "call places" },
});

const quoteName = name => `\`${name}\``;

const formatSpan = span => (span.from === span.to ? `${span.from}` : `${span.from}-${span.to}`);

const fenceLines = lines => ["```", ...(lines || []).map(line => `${line.line}: ${line.text}`), "```"].join("\n");

const readChangeWord = changeKind => CHANGE_WORDS[changeKind] || String(changeKind || "").toLowerCase();

const readWords = codeUnderReview => WORDS_BY_KIND_MAP[codeUnderReview.kind] || WORDS_BY_KIND_MAP[ENTRY_BOUNDARY_KINDS.GRAPHQL_FIELD];

const formatHead = codeUnderReview => `### ${codeUnderReview.id} · entry boundary ${quoteName(codeUnderReview.displayName)}`;

const formatKindLine = codeUnderReview => `Kind: ${codeUnderReview.kind} · Application: ${codeUnderReview.application} · ${readWords(codeUnderReview).count}: ${codeUnderReview.boundaries.length}`;

const formatRoute = boundary => (boundary.route ? `${[boundary.verb, boundary.route].filter(Boolean).join(" ")} · ` : "");

const formatBoundaryLine = boundary => `Entry boundary: ${quoteName(boundary.displayName)} · ${formatRoute(boundary)}${boundary.path}:${boundary.line} · ${readChangeWord(boundary.changeKind)}`;

const formatSameNameLine = boundary => `Same name on other types: ${boundary.sameNameOnOtherTypes.length ? boundary.sameNameOnOtherTypes.map(quoteName).join(", ") : "none"}`;

const formatDisplayNamePrefix = place => (place.displayName ? `${quoteName(place.displayName)} · ` : "");

const formatDeclaredInTheFile = declaringSource => ((declaringSource.declaredInTheFile || []).length ? [`Declared in the file: ${declaringSource.path}`, fenceLines(declaringSource.declaredInTheFile)] : []);

const formatDeclaredInAnotherFile = declaringSource => (declaringSource.declaredInAnotherFile || []).flatMap(declared => [`Declared in another file: ${declared.path}`, fenceLines(declared.lines)]);

const formatConditionCallBlock = conditionCall => [`Condition call: ${quoteName(conditionCall.displayName)} · ${conditionCall.path}:${formatSpan(conditionCall)}`, fenceLines(conditionCall.lines), ...formatDeclaredInTheFile(conditionCall), ...formatDeclaredInAnotherFile(conditionCall)].join("\n");

const fillBlockOf = (fill, words) => [
  [`${words.fill}: ${formatDisplayNamePrefix(fill)}${fill.path}:${formatSpan(fill)}`, fenceLines(fill.lines), ...formatDeclaredInAnotherFile(fill)].join("\n"),
  ...(fill.conditionCalls || []).map(formatConditionCallBlock),
];

const fillBlocksOf = (boundary, words) => (boundary.fills.length
  ? boundary.fills.flatMap(fill => fillBlockOf(fill, words))
  : [`${words.fill}: none found`]);

const formatReachedBlock = (place, words) => [`${words.reached}: ${place.path}:${place.line}`, fenceLines(place.lines)].join("\n");

const formatDeclaredAbove = place => ((place.declaredAbove || []).length ? [`Declared above: ${place.path}`, fenceLines(place.declaredAbove)] : []);

const readBlockOf = place => [`Read: ${formatDisplayNamePrefix(place)}${place.path}:${place.line}${place.decision ? " · decision" : ""}`, fenceLines(place.lines), ...formatDeclaredAbove(place), ...formatDeclaredInAnotherFile(place)].join("\n");

const formatCallerBlocks = (caller, words) => [
  `Caller application: ${caller.application} · ${words.reachedPlaces}: ${caller.reached.length} · read places: ${caller.readPlaces.length}`,
  ...caller.reached.map(place => formatReachedBlock(place, words)),
  ...caller.readPlaces.map(readBlockOf),
];

const formatDeclaredType = declaredType => (declaredType
  ? [`Declared type: ${declaredType.kind} ${quoteName(declaredType.name)} · ${declaredType.path}:${formatSpan({ from: declaredType.line, to: declaredType.to })}`, fenceLines(declaredType.lines)]
  : []);

const formatComparedFieldBlock = comparedField => [
  `Schema type: ${quoteName(comparedField.displayName)} · ${quoteName(comparedField.typeText)} · ${comparedField.path}:${comparedField.line}`,
  fenceLines(comparedField.lines),
  ...formatDeclaredType(comparedField.declaredType),
].join("\n");

const formatStoppedLine = boundary => `Stopped: ${boundary.stopped.length ? boundary.stopped.join(", ") : "none"}`;

const formatBoundaryBlocks = (boundary, words) => [
  [formatBoundaryLine(boundary), ...(boundary.route ? [] : [formatSameNameLine(boundary)]), fenceLines(boundary.lines)].join("\n"),
  ...(boundary.comparedFields || []).map(formatComparedFieldBlock),
  ...fillBlocksOf(boundary, words),
  ...boundary.callers.flatMap(caller => formatCallerBlocks(caller, words)),
  formatStoppedLine(boundary),
];

export function formatEntryBoundaryText(codeUnderReview, { repositoryRoot = "", changedLines = NO_CHANGED_LINES_TEXT } = {}) {
  const words = readWords(codeUnderReview);
  const places = readEntryBoundaryPlaces(codeUnderReview).map(place => ({ file: place.path, line: place.line }));
  return `${[
    [formatHead(codeUnderReview), formatRootLine(repositoryRoot), formatKindLine(codeUnderReview)].join("\n"),
    ...codeUnderReview.boundaries.flatMap(boundary => formatBoundaryBlocks(boundary, words)),
    formatChangedLinesLine(changedLines, EVERY_FILE_NAMED, places),
  ].join("\n\n")}\n`;
}
