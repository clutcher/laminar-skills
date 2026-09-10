import { formatChangedLinesLine, formatRootLine } from "../formats/CodeUnderReviewText.mjs";
import { NO_CHANGED_LINES_TEXT } from "../formats/ChangedLinesText.mjs";
import { isACoreOperation, isAnInOutOperation, isARebuiltValue, RELATION_KINDS, readRelationPlaces } from "./DesignRelationCodeUnderReview.mjs";

const formatSpan = span => (span.from === span.to ? `${span.from}` : `${span.from}-${span.to}`);

const quoteName = name => `\`${name}\``;

const formatNamedList = names => (names.length ? names.map(quoteName).join(", ") : "none");

const fenceLines = lines => ["```", ...(lines || []).map(line => `${line.line}: ${line.text}`), "```"].join("\n");

const formatCallersOutside = chainMethod => `callers outside the group: ${chainMethod.callersOutside}`;

const formatCalledAt = chainMethod => (chainMethod.calledAt.length
  ? ["Called at:", ...chainMethod.calledAt.map(place => `- ${quoteName(place.displayName)} · ${place.path}:${place.line}`)].join("\n")
  : "Called at: none");

const formatMethodHead = method => [
  `Method: ${quoteName(method.displayName)} · ${method.path}:${formatSpan(method)}`,
  ...(method.start ? ["start"] : []),
  formatCallersOutside(method),
].join(" · ");

const formatMethodBlock = method => [formatMethodHead(method), formatCalledAt(method), fenceLines(method.lines)].join("\n");

const stopBlockOf = stop => [`Stop: ${quoteName(stop.displayName)} · ${stop.path}:${stop.from} · ${formatCallersOutside(stop)}`, formatCalledAt(stop), fenceLines(stop.lines)].join("\n");

const formatChainGroupBlocks = chainGroup => [
  `Methods: ${chainGroup.methods.length} · Stops: ${chainGroup.stops.length}`,
  ...chainGroup.methods.map(formatMethodBlock),
  ...chainGroup.stops.map(stopBlockOf),
];

const formatPassedOn = passed => (passed.to ? `line ${passed.line} to ${quoteName(passed.to)}` : `line ${passed.line}, not followed`);

const readsOf = operation => {
  if (!operation.hasBody) return "no body";
  const pieces = [`reads: ${formatNamedList(operation.reads)}`];
  if (operation.passedOn.length) pieces.push(`passed on: ${operation.passedOn.map(formatPassedOn).join(", ")}`);
  return pieces.join(" · ");
};

const formatOperationBlock = operation => [
  `Operation: ${quoteName(operation.displayName)} · ${operation.path}:${formatSpan(operation)} · parameter ${quoteName(operation.parameter)} · ${readsOf(operation)}`,
  fenceLines(operation.lines),
].join("\n");

const formatOperationsBlocks = type => [`Operations of ${quoteName(type.name)}: ${type.operations.length}`, ...type.operations.map(formatOperationBlock)];

const formatCarriedItem = item => `${quoteName(item.member)} as ${quoteName(item.as)} at ${item.path}:${item.line}`;

const formatCarrierBlocks = carrier => [
  [
    `Carried into: ${quoteName(carrier.name)} · ${carrier.path}:${formatSpan(carrier)}`,
    `Carried: ${carrier.carried.map(formatCarriedItem).join(", ")}`,
    `Read after carrying: ${formatNamedList(carrier.readAfterCarrying)}`,
    fenceLines(carrier.lines),
  ].join("\n"),
  `Operations of ${quoteName(carrier.name)} called by the operations above: ${carrier.operations.length}`,
  ...carrier.operations.map(formatOperationBlock),
];

const formatTwinBlocks = twin => [
  [`Same members: ${quoteName(twin.name)} · ${twin.path}:${formatSpan(twin)}`, fenceLines(twin.lines)].join("\n"),
  ...formatOperationsBlocks(twin),
];

const formatNamesAt = place => place.names.map(filledName => `${quoteName(filledName.name)} at ${filledName.lines.join(", ")}`).join(" · ");

const formatFilledBlock = place => [
  `Place: ${place.displayName ? `${quoteName(place.displayName)} · ` : ""}${place.path}:${formatSpan(place)} · ${formatNamesAt(place)}`,
  fenceLines(place.lines),
].join("\n");

const formatParameterTypeBlocks = parameterType => [
  [
    `Type: ${quoteName(parameterType.name)} · ${parameterType.path}:${formatSpan(parameterType)}`,
    `Members: ${formatNamedList(parameterType.members)}`,
    `Added by the change: ${formatNamedList(parameterType.added)}`,
    fenceLines(parameterType.typeLines),
  ].join("\n"),
  ...formatOperationsBlocks(parameterType),
  ...(parameterType.carriers || []).flatMap(formatCarrierBlocks),
  ...parameterType.twins.flatMap(formatTwinBlocks),
  ...(parameterType.twins.length ? [`Filled together: ${parameterType.filledTogether.length}`, ...parameterType.filledTogether.map(formatFilledBlock)] : []),
];

const CHANGE_WORDS = Object.freeze({ CREATED: "created", BOUNDARY_CHANGED: "boundary changed", INTERNALS_CHANGED: "internals changed" });

const readChangeWord = changeKind => CHANGE_WORDS[changeKind] || String(changeKind || "").toLowerCase();

const readRelativeFolder = (folder, level) => (level && folder.startsWith(`${level}/`) ? folder.slice(level.length + 1) : folder);

const formatGroupName = (folders, level) => folders.map(folder => readRelativeFolder(folder, level)).join(" + ");

const formatCoreLine = core => `Core: ${core.folders.join(" + ")} · imported by ${core.importedBy.map(group => formatGroupName(group, core.level)).join(", ")} · imports none of them · no calls outside the process`;

const formatImplementedByPhrase = neighbour => (neighbour.implementation ? ` · implemented by ${quoteName(neighbour.implementation.name)} · ${neighbour.implementation.path}:${formatSpan(neighbour.implementation)}` : "");

const formatOwnOutputLines = coreOperation => (coreOperation.ownOutput.length
  ? coreOperation.ownOutput.map(taken => `Own output taken back: ${quoteName(taken.operation)} takes ${quoteName(taken.parameterType)}, the result of ${quoteName(taken.resultOf)}`)
  : ["Own output taken back: none"]);

const formatNeighbourBlock = neighbour => [
  `Neighbour: ${quoteName(neighbour.name)} · ${neighbour.path}:${formatSpan(neighbour)}${formatImplementedByPhrase(neighbour)}`,
  fenceLines([...neighbour.interfaceLines, ...neighbour.implementationLines]),
].join("\n");

const formatCoreOperationBlocks = coreOperation => [
  [
    formatCoreLine(coreOperation.core),
    `Operation: ${quoteName(coreOperation.name)} · ${coreOperation.path}:${formatSpan(coreOperation)} · ${readChangeWord(coreOperation.changeKind)}${formatImplementedByPhrase(coreOperation)}`,
    ...formatOwnOutputLines(coreOperation),
    fenceLines([...coreOperation.interfaceLines, ...coreOperation.implementationLines]),
  ].join("\n"),
  `Neighbours: ${coreOperation.neighbours.length} of ${coreOperation.neighbourCount}`,
  ...coreOperation.neighbours.map(formatNeighbourBlock),
];

const formatInOutOperationBlocks = inOutOperation => [
  [
    `Side: ${inOutOperation.side} · ${inOutOperation.shape}`,
    `Operation: ${quoteName(inOutOperation.displayName)} · ${inOutOperation.path}:${formatSpan(inOutOperation)} · ${readChangeWord(inOutOperation.changeKind)}`,
    `Decision lines: ${inOutOperation.decisionLines.join(", ")}`,
    fenceLines(inOutOperation.methodLines),
  ].join("\n"),
];

const formatCallsOutsideTheValue = callsOutside => `Calls outside the value: ${callsOutside.length ? callsOutside.map(call => `${quoteName(call.callee)} at line ${call.line}`).join(", ") : "none"}`;

const formatRebuiltCallerBlock = caller => [`Called at: ${quoteName(caller.displayName)} · ${caller.path}:${caller.line}`, fenceLines([caller])].join("\n");

const formatSiblingBlock = sibling => [
  `Sibling: ${quoteName(sibling.displayName)} · ${sibling.path}:${formatSpan(sibling)} · ${formatCallsOutsideTheValue(sibling.callsOutside)}`,
  fenceLines(sibling.lines),
].join("\n");

const formatRebuiltValueBlocks = rebuiltValue => [
  [`Value type: ${quoteName(rebuiltValue.value.name)} · ${rebuiltValue.value.path}:${formatSpan(rebuiltValue.value)}`, fenceLines(rebuiltValue.value.lines)].join("\n"),
  [
    `Rebuilt by: ${quoteName(rebuiltValue.displayName)} · ${rebuiltValue.path}:${formatSpan(rebuiltValue)} · ${readChangeWord(rebuiltValue.changeKind)} · takes ${quoteName(rebuiltValue.parameterType)}`,
    formatCallsOutsideTheValue(rebuiltValue.callsOutside),
    fenceLines(rebuiltValue.methodLines),
  ].join("\n"),
  ...(rebuiltValue.callers.length ? rebuiltValue.callers.map(formatRebuiltCallerBlock) : ["Called at: none"]),
  `Siblings: ${rebuiltValue.siblings.length}`,
  ...rebuiltValue.siblings.map(formatSiblingBlock),
];

const formatHead = designRelation => `### ${designRelation.id} · ${designRelation.relation} ${quoteName(designRelation.displayName)}`;

const formatHeadLines = (designRelation, repositoryRoot) => [formatHead(designRelation), formatRootLine(repositoryRoot), ...(isACoreOperation(designRelation) || isAnInOutOperation(designRelation) || isARebuiltValue(designRelation) ? [`Path: ${designRelation.path}`] : [])];

const formatRelationBlocks = designRelation => {
  if (designRelation.relation === RELATION_KINDS.CHAIN_GROUP) return formatChainGroupBlocks(designRelation);
  if (isACoreOperation(designRelation)) return formatCoreOperationBlocks(designRelation);
  if (isAnInOutOperation(designRelation)) return formatInOutOperationBlocks(designRelation);
  if (isARebuiltValue(designRelation)) return formatRebuiltValueBlocks(designRelation);
  return formatParameterTypeBlocks(designRelation);
};

export function formatDesignRelationText(designRelation, { repositoryRoot = "", changedLines = NO_CHANGED_LINES_TEXT } = {}) {
  const pieces = formatRelationBlocks(designRelation);
  const places = readRelationPlaces(designRelation).map(place => ({ file: place.path, line: place.line }));
  return `${[
    formatHeadLines(designRelation, repositoryRoot).join("\n"),
    ...pieces,
    formatChangedLinesLine(changedLines, designRelation.path, places),
  ].join("\n\n")}\n`;
}
