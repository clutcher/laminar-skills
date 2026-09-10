import { formatChangedLinesLine, formatRootLine } from "../formats/CodeUnderReviewText.mjs";
import { NO_CHANGED_LINES_TEXT } from "../formats/ChangedLinesText.mjs";
import { BOUNDARY_PATH_KINDS } from "../abstractions/walks/BoundaryPathsWalk.mjs";
import { readBoundaryPathPlaces } from "./BoundaryPathCodeUnderReview.mjs";

const EVERY_FILE_NAMED = "";

const CHANGE_WORDS = Object.freeze({ CREATED: "created", BOUNDARY_CHANGED: "boundary changed", INTERNALS_CHANGED: "internals changed" });

const SCALE_WORDS = Object.freeze({ METHOD: "method", CLASS: "class" });

const quoteName = name => `\`${name}\``;

const formatSpan = span => (span.from === span.to ? `${span.from}` : `${span.from}-${span.to}`);

const fenceLines = lines => ["```", ...(lines || []).map(line => `${line.line}: ${line.text}`), "```"].join("\n");

const readChangeWord = changeKind => CHANGE_WORDS[changeKind] || String(changeKind || "").toLowerCase();

const formatShownLinesPhrase = boundaryPath => {
  const total = boundaryPath.to - boundaryPath.from + 1;
  return boundaryPath.ownLines.length < total ? ` · first ${boundaryPath.ownLines.length} of ${total} lines` : "";
};

const formatHead = boundaryPath => `### ${boundaryPath.id} · boundary path ${quoteName(boundaryPath.displayName)}`;

const formatKindLine = boundaryPath => (boundaryPath.kind === BOUNDARY_PATH_KINDS.ENTRY
  ? `Kind: ${boundaryPath.kind} · Passed to: ${boundaryPath.passedTo.length} · Sinks: ${boundaryPath.sinks.length}`
  : `Kind: ${boundaryPath.kind} · Entry methods: ${boundaryPath.entryMethods.length} · Sinks: ${boundaryPath.sinks.length}`);

const formatUnderReviewBlock = boundaryPath => [
  `Under review: ${quoteName(boundaryPath.displayName)} · ${SCALE_WORDS[boundaryPath.scale] || boundaryPath.scale} · ${boundaryPath.path}:${formatSpan(boundaryPath)} · ${readChangeWord(boundaryPath.changeKind)}${formatShownLinesPhrase(boundaryPath)}`,
  fenceLines(boundaryPath.ownLines),
].join("\n");

const formatCallLine = call => `- ${quoteName(call.displayName)} · ${call.path}:${call.line}: ${call.text}`;

const formatCallsBelow = entryMethod => (entryMethod.calls.length ? ["Calls below the entry:", ...entryMethod.calls.map(formatCallLine)].join("\n") : "Calls below the entry: none");

const formatEntryMethodBlock = entryMethod => [
  `Entry: ${quoteName(entryMethod.displayName)} · ${entryMethod.path}:${formatSpan(entryMethod)} · ${entryMethod.shown}`,
  fenceLines(entryMethod.lines),
  formatCallsBelow(entryMethod),
].join("\n");

const formatPassedToBlock = passed => [
  `Passed to: ${quoteName(passed.displayName)} · ${passed.path}:${formatSpan(passed)} · called at line ${passed.calledAt}`,
  fenceLines(passed.lines),
].join("\n");

const formatOnPhrase = sink => (sink.on.length ? ` on ${sink.on.map(quoteName).join(", ")}` : "");

const formatSinkLine = sink => `- ${quoteName(sink.displayName)} · ${sink.path}:${sink.line} · call ${quoteName(sink.call)}${formatOnPhrase(sink)} · code: ${sink.text}`;

const formatSinks = boundaryPath => (boundaryPath.sinks.length ? ["Sinks:", ...boundaryPath.sinks.map(formatSinkLine)].join("\n") : "Sinks: none");

const formatPathBlocks = boundaryPath => (boundaryPath.kind === BOUNDARY_PATH_KINDS.ENTRY
  ? boundaryPath.passedTo.map(formatPassedToBlock)
  : boundaryPath.entryMethods.map(formatEntryMethodBlock));

export function formatBoundaryPathText(boundaryPath, { repositoryRoot = "", changedLines = NO_CHANGED_LINES_TEXT } = {}) {
  const places = readBoundaryPathPlaces(boundaryPath).map(place => ({ file: place.path, line: place.line }));
  return `${[
    [formatHead(boundaryPath), formatRootLine(repositoryRoot), formatKindLine(boundaryPath)].join("\n"),
    formatUnderReviewBlock(boundaryPath),
    ...formatPathBlocks(boundaryPath),
    formatSinks(boundaryPath),
    formatChangedLinesLine(changedLines, EVERY_FILE_NAMED, places),
  ].join("\n\n")}\n`;
}
