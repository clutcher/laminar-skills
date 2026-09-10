import { formatChangedLinesLine, formatRootLine } from "../formats/CodeUnderReviewText.mjs";
import { NO_CHANGED_LINES_TEXT } from "../formats/ChangedLinesText.mjs";
import { readExample } from "./IoPaths.mjs";

export const IO_SUMMARY_LABEL = "I/O summary";
export const END_CALLS_LABEL = "End calls";
export const UNRESOLVED_MARK = "unresolved";
export const IO_UNKNOWN_LABEL = "I/O unknown end methods";
export const IO_UNKNOWN_FILE = "io-unknown.md";

const formatSpan = end => (end.from === end.to ? `${end.from}` : `${end.from}-${end.to}`);

const formatPlaceText = place => `${place.path}:${place.line}`;

const formatEndMethodLine = end => `End method: ${end.id} · ${end.path}:${formatSpan(end)} · \`${end.method}\``;

const formatEndCallLine = call => `- ${call.id} · line ${call.line} · \`${call.call}\` · code: ${call.text}`;

const countLoops = ioPaths => ioPaths.reachingCalls.reduce((total, reachingCall) => total + reachingCall.loops.length, 0);

const formatCountsLine = (ioPaths, calls) => `Reaching calls: ${ioPaths.reachingCalls.length} · Loops: ${countLoops(ioPaths)} · ${END_CALLS_LABEL}: ${calls.length}`;

const formatChangedCallPhrase = loop => loop.changedCall ? ` · changed call: ${formatPlaceText(loop.changedCall)} \`${loop.changedCall.call}\`` : "";

const formatLoopLine = loop => `    - ${loop.direction} · ${formatPlaceText(loop.loop)} · loop \`${loop.loop.form}\` · first hop: line ${loop.hops[0].line} \`${loop.hops[0].call}\` · depth: ${loop.hops.length} · changed method \`${loop.changedMethod}\`${formatChangedCallPhrase(loop)}`;

const formatExampleLines = examplePath => [
  `    - ${formatPlaceText(examplePath.loop)} · loop \`${examplePath.loop.form}\` · code: ${examplePath.loop.text}`,
  ...examplePath.hops.map(hop => `    - ${formatPlaceText(hop)} · \`${hop.method}\` · \`${hop.call}\` · code: ${hop.text}`),
];

const formatReachingCallLines = reachingCall => [
  `- ${formatPlaceText(reachingCall)} · \`${reachingCall.method}\` · \`${reachingCall.call}\` · code: ${reachingCall.text}`,
  `  - Loops: ${reachingCall.loops.length}`,
  ...reachingCall.loops.map(formatLoopLine),
  "  - Example path:",
  ...formatExampleLines(readExample(reachingCall)),
].join("\n");

const formatEndMethodBlock = (ioPaths, calls) => [
  [formatEndMethodLine(ioPaths.end), formatCountsLine(ioPaths, calls)].join("\n"),
  [`${END_CALLS_LABEL}:`, ...calls.map(formatEndCallLine)].join("\n"),
  ["Reaching calls:", ...ioPaths.reachingCalls.map(formatReachingCallLines)].join("\n"),
];

export const readIoPathsPlaces = ioPaths => [
  ...ioPaths.calls.map(call => ({ ...call, path: ioPaths.end.path })),
  ...ioPaths.reachingCalls.flatMap(reachingCall => [reachingCall, ...reachingCall.loops.flatMap(loop => [loop.loop, loop.hops[0], ...(loop.changedCall ? [loop.changedCall] : [])]), ...readExample(reachingCall).hops]),
].map(place => ({ file: place.path, line: place.line }));

export function formatIoPathsText(ioPaths, { repositoryRoot = "", changedLines = NO_CHANGED_LINES_TEXT } = {}) {
  return `${[
    [`### ${ioPaths.id} · end method \`${ioPaths.displayName}\``, formatRootLine(repositoryRoot)].join("\n"),
    ...formatEndMethodBlock(ioPaths, ioPaths.calls),
    formatChangedLinesLine(changedLines, "", readIoPathsPlaces(ioPaths)),
  ].join("\n\n")}\n`;
}

export function formatIoUnknownText(unknown, { repositoryRoot = "" } = {}) {
  const endCalls = unknown.reduce((total, { calls }) => total + calls.length, 0);
  return `${[
    [`${IO_UNKNOWN_LABEL}: ${unknown.length} · ${END_CALLS_LABEL}: ${endCalls}`, formatRootLine(repositoryRoot)].join("\n"),
    ...unknown.map(({ ioPaths, calls }) => [`### ${ioPaths.end.id} · end method \`${ioPaths.end.method}\``, ...formatEndMethodBlock(ioPaths, calls)].join("\n\n")),
  ].join("\n\n")}\n`;
}

const formatNamedList = names => names.map(name => `\`${name}\``).join(", ");

const formatGroupLines = group => [
  `- ${group.id} · \`${group.name}\` · ${group.family}${group.bare ? ` · ${UNRESOLVED_MARK}` : ""} · end calls: ${group.count}`,
  ...(group.names.length ? [`  - also on: ${formatNamedList(group.names)}`] : []),
  ...group.callees.map(callee => `  - \`${callee.text}\` · ${callee.count}`),
].join("\n");

const formatDependencyFileLines = file => [
  `- \`${file.path}\` · lines: ${file.lineCount} · dependency lines: ${file.dependencyLines}${file.repeated ? ` · repeated: ${file.repeated}` : ""}`,
  ...file.lines.map(line => `  - ${line}`),
].join("\n");

export const formatIoSummaryText = (summary, { repositoryRoot = "" } = {}) => `${[
  `${IO_SUMMARY_LABEL}: ${summary.groupCount} groups · ${END_CALLS_LABEL}: ${summary.endCalls} · left over: ${summary.leftOver}`,
  formatRootLine(repositoryRoot),
  ["Groups:", ...summary.groups.map(formatGroupLines)].join("\n"),
  [`Dependency files: ${summary.dependencyFileCount}`, ...summary.dependencyFiles.map(formatDependencyFileLines)].join("\n"),
].join("\n\n")}\n`;
