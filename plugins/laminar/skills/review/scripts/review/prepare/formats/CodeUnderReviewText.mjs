import { ABSTRACTION_KINDS, Scale } from "../../../code/index.mjs";
import { JUDGE_TYPE_BY_SCALE_MAP } from "../../../checks/JudgeType.mjs";
import { PATH_FROM_THE_SOURCE_ROOT, listPlacesShownInSections, readPathFromTheSourceRoot, readSliceSections, showFileListLineFromTheSourceRoot } from "./SliceFormat.mjs";
import { NO_CHANGED_LINES_TEXT } from "./ChangedLinesText.mjs";
import { TRACKS } from "../../../checks/CheckCatalog.mjs";
import { fitsOnOnePage, formatListFileLine, formatPlaceListLines, readAtListLinesOf } from "./ListFileText.mjs";

const SCALE_WORDS = Object.freeze({ VARIABLE: "variable", METHOD: "method", CLASS: "class", MODULE: "module", APPLICATION: "application" });

const FILE_WORD = "file";

const readScaleWord = codeUnderReview => (codeUnderReview.kind === ABSTRACTION_KINDS.FILE ? FILE_WORD : SCALE_WORDS[codeUnderReview.scale] || codeUnderReview.scale);

const formatHeadLine = codeUnderReview => `### ${codeUnderReview.id} · ${readScaleWord(codeUnderReview)} \`${codeUnderReview.displayName}\``;

const formatPlaceLine = codeUnderReview => [
  `Change: ${codeUnderReview.changeKind}`,
  `path: ${codeUnderReview.path}`,
  `boundary rank: ${codeUnderReview.boundaryRank}`,
  codeUnderReview.isTest ? "test code" : "production code",
].join(" · ");

const formatOpenConstructLine = openConstruct => `- ${openConstruct.line}: ${openConstruct.text}`;

const formatOpenConstructs = codeUnderReview => {
  const read = codeUnderReview.openConstructs;
  if (!read || !read.deepestLine) return "";
  return [`Deepest line: ${read.deepestLine.line}: ${read.deepestLine.text}`, "Open constructs:", ...read.constructs.map(formatOpenConstructLine)].join("\n");
};

const formatFunctionLine = found => `- ${found.line} · depth ${found.depth}: ${found.text}`;

const formatNestedFunctionLine = found => `- inner ${found.line} · outer ${found.outerLine}`;

const formatCallArgumentFunctions = codeUnderReview => {
  const found = codeUnderReview.callArgumentFunctions || [];
  if (!found.length) return "";
  const nested = found.filter(callArgumentFunction => callArgumentFunction.outerLine !== null);
  return [
    "Functions inside call arguments:",
    ...found.map(formatFunctionLine),
    ...(nested.length ? ["Functions inside a function:", ...nested.map(formatNestedFunctionLine)] : []),
  ].join("\n");
};

const formatCallInsideAnArgumentLine = found => `- ${found.line} · outer ${found.outer} · inner ${found.inner}`;

const formatCallArgumentCalls = codeUnderReview => {
  const found = codeUnderReview.callArgumentCalls || [];
  return found.length ? ["Calls inside call arguments:", ...found.map(formatCallInsideAnArgumentLine)].join("\n") : "";
};

const formatFactText = ([name, value]) => (value === true ? name : `${name}: ${value}`);

const formatFactsLine = codeUnderReview => Object.entries(codeUnderReview.facts || {}).filter(([, value]) => value === true || typeof value === "string").map(formatFactText).join(", ");

const FRICTION_WORDS = Object.freeze({
  SETUP_GREW: "setup grew", PARTIAL_SUBSTITUTE: "partial substitute", SUBSTITUTE_RETURNS_SUBSTITUTE: "substitute returns substitute",
  PRIVATE_METHOD_REACHED: "private method reached",
});

const formatFrictionLine = friction => `- ${FRICTION_WORDS[friction.kind] || friction.kind} · ${friction.path}:${friction.line}: ${friction.text}`;

export const formatTestFriction = codeUnderReview => {
  const found = codeUnderReview.testFriction || [];
  return found.length ? ["Test friction:", ...found.map(formatFrictionLine)].join("\n") : "";
};

const formatHomeModuleLine = codeUnderReview => {
  const home = codeUnderReview.homeModule;
  if (codeUnderReview.track !== TRACKS.DECISION || !home) return "";
  return home.root ? `Module: \`${home.root}\`` : "Module: none found";
};

export const formatRootLine = repositoryRoot => repositoryRoot ? `Repository root: ${repositoryRoot}` : "Mode: patch";

const PLACE_LIST = "Place list";

const formatPlaceList = (codeUnderReview, { repositoryRoot, placeListFile, applicationRoots }) => {
  const lines = formatPlaceListLines(codeUnderReview, { applicationRoots });
  if (!lines.length) return "";
  const list = fitsOnOnePage(lines) ? [`${PLACE_LIST}:`, ...lines] : [formatListFileLine(PLACE_LIST, placeListFile, lines.length)];
  return [...list, formatRootLine(repositoryRoot)].join("\n");
};

const formatDeclarationLine = declaration => `- \`${declaration.name}\` · ${declaration.path}:${declaration.line}: ${declaration.text}`;

const readAtLineOf = (codeUnderReview, readAtListFile) => {
  const count = readAtListLinesOf(codeUnderReview).length;
  return count ? [formatListFileLine("Read at", readAtListFile, count)] : ["Read at: none"];
};

const formatDeclarationList = (codeUnderReview, repositoryRoot, readAtListFile) => {
  const named = codeUnderReview.namedDeclarations;
  if (!named) return "";
  if (!named.declarations.length) return "Declarations: none";
  return [
    formatRootLine(repositoryRoot),
    "Declarations:",
    ...named.declarations.map(formatDeclarationLine),
    ...(named.stopped ? [`Stopped: limit ${named.declarations.length}`] : []),
    ...readAtLineOf(codeUnderReview, readAtListFile),
  ].join("\n");
};

const formatOutsideDeclaration = codeUnderReview => {
  const declared = codeUnderReview.outsideDeclaration;
  if (!declared) return "";
  if (!declared.lines.length) return "Declaration: none";
  return ["Declaration:", ...declared.lines.map(place => `- ${place.path}:${place.line}: ${place.text}`)].join("\n");
};

const MODULE_JUDGE = JUDGE_TYPE_BY_SCALE_MAP[Scale.MODULE.name];

export const readSourceRoot = codeUnderReview => (codeUnderReview.judgeType === MODULE_JUDGE && codeUnderReview.slice ? codeUnderReview.slice.sourceRoot : undefined);

const formatPathFromTheSourceRootLine = codeUnderReview => {
  const sourceRoot = readSourceRoot(codeUnderReview);
  return sourceRoot === undefined ? "" : `${PATH_FROM_THE_SOURCE_ROOT}: ${readPathFromTheSourceRoot(codeUnderReview.path, sourceRoot)}`;
};

export const formatSliceBlock = codeUnderReview => {
  const sourceRoot = readSourceRoot(codeUnderReview);
  const lines = [];
  for (const section of readSliceSections(codeUnderReview)) {
    lines.push(`--- ${section.section}`);
    for (const line of section.lines || []) lines.push(showFileListLineFromTheSourceRoot(section.section, line, sourceRoot));
  }
  return ["Slice:", "```", ...lines, "```"].join("\n");
};

const CHANGED_LINES = "Changed lines";

export const formatChangedLinesLine = (changedLines, ownPath, places) => `${CHANGED_LINES}: ${changedLines.formatListedLines(ownPath, places)}`;

export const readSlicePlaces = codeUnderReview => listPlacesShownInSections(codeUnderReview.path, readSliceSections(codeUnderReview));

const listLineNumbers = (from, to) => Array.from({ length: Math.max(to - from + 1, 0) }, (_, offset) => from + offset);

const readCommentPlaces = codeUnderReview => (codeUnderReview.comments || [])
  .flatMap(comment => [...listLineNumbers(comment.from, comment.to || comment.from), comment.codeBelow.line])
  .filter(line => line > 0)
  .map(line => ({ file: codeUnderReview.path, line }));

const countCommentLines = comment => (comment.to || comment.from) - comment.from + 1;

const countCommentWords = comment => String(comment.text).split(/\s+/).filter(Boolean).length;

const formatCommentLines = codeUnderReview => (codeUnderReview.comments || []).flatMap(comment => [
  `${comment.from}: ${comment.text}`,
  `    size: ${countCommentLines(comment)} lines, ${countCommentWords(comment)} words`,
  `    below ${comment.codeBelow.line}: ${comment.codeBelow.text}`,
]);

const formatCommentBlock = codeUnderReview =>
  ["Comments:", "```", ...formatCommentLines(codeUnderReview), "```"].join("\n");

const formatCommentText = (codeUnderReview, changedLines) => `${[
  formatHeadLine(codeUnderReview),
  `path: ${codeUnderReview.path}`,
  formatCommentBlock(codeUnderReview),
  formatChangedLinesLine(changedLines, codeUnderReview.path, readCommentPlaces(codeUnderReview)),
].join("\n\n")}\n`;

export function formatCodeUnderReviewText(codeUnderReview, { repositoryRoot = "", placeListFile = "", readAtListFile = "", applicationRoots = [], changedLines = NO_CHANGED_LINES_TEXT } = {}) {
  if (codeUnderReview.track === TRACKS.COMMENT) return formatCommentText(codeUnderReview, changedLines);
  const blocks = [formatHeadLine(codeUnderReview), formatPlaceLine(codeUnderReview)];
  const pathFromTheSourceRoot = formatPathFromTheSourceRootLine(codeUnderReview);
  if (pathFromTheSourceRoot) blocks.push(pathFromTheSourceRoot);
  const homeModule = formatHomeModuleLine(codeUnderReview);
  if (homeModule) blocks.push(homeModule);
  const openConstructs = formatOpenConstructs(codeUnderReview);
  if (openConstructs) blocks.push(openConstructs);
  const callArgumentFunctions = formatCallArgumentFunctions(codeUnderReview);
  if (callArgumentFunctions) blocks.push(callArgumentFunctions);
  const callArgumentCalls = formatCallArgumentCalls(codeUnderReview);
  if (callArgumentCalls) blocks.push(callArgumentCalls);
  const factsLine = formatFactsLine(codeUnderReview);
  if (factsLine) blocks.push(`Facts: ${factsLine}`);
  const testFriction = formatTestFriction(codeUnderReview);
  if (testFriction) blocks.push(testFriction);
  const placeList = formatPlaceList(codeUnderReview, { repositoryRoot, placeListFile, applicationRoots });
  if (placeList) blocks.push(placeList);
  const declarationList = formatDeclarationList(codeUnderReview, repositoryRoot, readAtListFile);
  if (declarationList) blocks.push(declarationList);
  const outsideDeclaration = formatOutsideDeclaration(codeUnderReview);
  if (outsideDeclaration) blocks.push(outsideDeclaration);
  blocks.push(formatSliceBlock(codeUnderReview));
  blocks.push(formatChangedLinesLine(changedLines, codeUnderReview.path, readSlicePlaces(codeUnderReview)));
  return `${blocks.join("\n\n")}\n`;
}
