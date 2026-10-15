import { readApplicationName, liesInAnotherApplication, formatPlaceKey } from "../../../code/index.mjs";
import { TRACKS } from "../../../checks/CheckCatalog.mjs";

export const LIST_PAGE_LINES = 50;

export const formatCountedWord = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;

export const formatFileHeadLine = (label, file, lineCount, pageCount, ...more) => [`${label}: ${file}`, formatCountedWord(lineCount, "line", "lines"), formatCountedWord(pageCount, "page", "pages"), ...more].join(" · ");

export const formatListFileLine = (label, file, count, ...more) => formatFileHeadLine(label, file, count, Math.ceil(count / LIST_PAGE_LINES), ...more);

export const fitsOnOnePage = lines => lines.length <= LIST_PAGE_LINES;

const HEAD_WRITER_BY_OCCURRENCE_KIND_MAP = Object.freeze({
  NAME_STEMS: key => `Name stems of \`${key}\``,
  LITERAL: key => `Literal \`${key}\``,
  WINDOW: key => `Window of \`${key}\``,
  READ_IDENTIFIER: key => `Identifier \`${key}\``,
  SHARED_READS: key => `Shared reads \`${key}\``,
  DERIVED_VALUE: key => `Derived from \`${key}\``,
  TWIN_MEMBERS: (key, occurrence) => `Near twin \`${key}\` · ${occurrence.shared} of ${occurrence.members} members shared`,
});

const formatHeadOfTheOccurrence = occurrence => {
  const writeTheHead = HEAD_WRITER_BY_OCCURRENCE_KIND_MAP[occurrence.kind];
  if (!writeTheHead) throw new Error(`a place list entry of kind ${occurrence.kind} has no head`);
  return writeTheHead(occurrence.key, occurrence);
};

const STOPPED_AT_THE_LINE_LIMIT = "Stopped: line limit";

const formatModuleWords = (place, homeRoot) => {
  if (!place.moduleRoot) return "no module found";
  return place.moduleRoot === homeRoot ? "same module" : `module \`${place.moduleRoot}\``;
};

const formatPlaceListLine = (place, homeRoot) => `- ${formatModuleWords(place, homeRoot)} · ${place.path}:${place.line}: ${place.text}`;

const formatOtherApplicationWords = (codeUnderReview, place, applicationRoots) => (liesInAnotherApplication(codeUnderReview.path, place.path, applicationRoots)
  ? `application \`${readApplicationName(place.path, applicationRoots)}\``
  : "");

const formatPlaceWords = (place, homeRoot, applicationWordsOf) => applicationWordsOf(place) || formatModuleWords(place, homeRoot);

const readFileName = file => String(file || "").split("/").pop();

const copyKeyOf = place => `${readFileName(place.path)}\u0000${place.text}`;

const splitOffTheCopiesInOtherFiles = places => {
  const firstPathByCopyKeyMap = new Map();
  const originals = [];
  const copies = [];
  for (const place of places) {
    const firstPath = firstPathByCopyKeyMap.get(copyKeyOf(place));
    if (firstPath !== undefined && firstPath !== place.path) { copies.push({ place, firstPath }); continue; }
    if (firstPath === undefined) firstPathByCopyKeyMap.set(copyKeyOf(place), place.path);
    originals.push(place);
  }
  return { originals, copies };
};

const groupByFileAndText = places => {
  const fileGroupsByPathMap = new Map();
  for (const place of places) {
    if (!fileGroupsByPathMap.has(place.path)) fileGroupsByPathMap.set(place.path, { first: place, linesByTextMap: new Map() });
    const file = fileGroupsByPathMap.get(place.path);
    if (!file.linesByTextMap.has(place.text)) file.linesByTextMap.set(place.text, { numbers: [], copies: [] });
    file.linesByTextMap.get(place.text).numbers.push(place.line);
  }
  return fileGroupsByPathMap;
};

const groupPlacesByFileWithTheCopiesFolded = places => {
  const { originals, copies } = splitOffTheCopiesInOtherFiles(places);
  const files = groupByFileAndText(originals);
  for (const { place, firstPath } of copies) files.get(firstPath).linesByTextMap.get(place.text).copies.push(place);
  return files;
};

const COPY_INDENT = "    ";
const LINE_INDENT = "  ";

const formatCopyLine = (copy, wordsOf) => `${COPY_INDENT}also ${wordsOf(copy)} · ${copy.path}:${copy.line}`;

const formatTextLines = ([text, lines], lead, wordsOf) => [
  `${lead}${lines.numbers.join(", ")}: ${text}`,
  ...lines.copies.map(copy => formatCopyLine(copy, wordsOf)),
];

const formatFileGroupLines = (path, file, wordsOf) => [...file.linesByTextMap].flatMap((textLines, order) => formatTextLines(textLines, order ? LINE_INDENT : `- ${wordsOf(file.first)} · ${path}:`, wordsOf));

const findPlacesNotYetListed = (occurrence, listed) => (occurrence.places || []).filter(place => !listed.has(formatPlaceKey(place)));

const markAsListed = (places, listed) => {
  for (const place of places) listed.add(formatPlaceKey(place));
};

const formatLeftOutLines = (leftOut, singular, plural) => (leftOut ? [`Left out: ${formatCountedWord(leftOut, singular, plural)}`] : []);

const formatEvidenceGroupLines = (head, lines, leftOutLines) => (lines.length ? [`${head}:`, ...lines, ...leftOutLines] : [`${head}: none`]);

const formatNamingFilesLines = ({ typeName, places, leftOut }, formatWords) => formatEvidenceGroupLines(
  `Named in other modules · \`${typeName}\``,
  places.map(place => `- ${formatWords(place)} · ${place.path}:${place.line}: ${place.text}`),
  formatLeftOutLines(leftOut, "file", "files"));

const formatMappingLines = ({ head, built }, formatWords) => [
  `- ${formatWords(head)} · ${head.path}:${head.line}: ${head.text}`,
  ...(built ? [`${LINE_INDENT}${built.line}: ${built.text}`] : []),
];

const formatMappedLines = ({ names, mappings, leftOut }, formatWords) => formatEvidenceGroupLines(
  `Mapped between ${names.map(name => `\`${name}\``).join(" and ")}`,
  mappings.flatMap(mapping => formatMappingLines(mapping, formatWords)),
  formatLeftOutLines(leftOut, "mapping", "mappings"));

const formatTwinEvidenceLines = (occurrence, formatWords) => [
  ...(occurrence.namedInOtherModules || []).flatMap(naming => formatNamingFilesLines(naming, formatWords)),
  ...(occurrence.mapped ? formatMappedLines(occurrence.mapped, formatWords) : []),
];

const formatOccurrenceLines = (occurrence, fresh, homeRoot, applicationWordsOf) => {
  if (!fresh.length && !occurrence.stopped) return [];
  const head = formatHeadOfTheOccurrence(occurrence);
  const stopped = occurrence.stopped ? [STOPPED_AT_THE_LINE_LIMIT] : [];
  const formatWords = place => formatPlaceWords(place, homeRoot, applicationWordsOf);
  const grouped = [...groupPlacesByFileWithTheCopiesFolded(fresh)].flatMap(([path, file]) => formatFileGroupLines(path, file, formatWords));
  const evidence = formatTwinEvidenceLines(occurrence, formatWords);
  return fresh.length ? [`${head}:`, ...grouped, ...stopped, ...evidence] : [`${head}: listed above`, ...stopped, ...evidence];
};

const formatScopeLine = scope => scope
  ? [[`Language family: ${scope.family}`, ...(scope.minifiedSkipped ? [`minified skipped: ${scope.minifiedSkipped}`] : [])].join(" · ")]
  : [];

export const formatPlaceListLines = (codeUnderReview, { applicationRoots = [] } = {}) => {
  if (codeUnderReview.track !== TRACKS.DECISION) return [];
  const listed = new Set();
  const homeRoot = (codeUnderReview.homeModule || {}).root || "";
  const formatApplicationWords = place => formatOtherApplicationWords(codeUnderReview, place, applicationRoots);
  const occurrenceLines = (codeUnderReview.sameDecisionAt || []).flatMap(occurrence => {
    const fresh = findPlacesNotYetListed(occurrence, listed);
    markAsListed(fresh, listed);
    return formatOccurrenceLines(occurrence, fresh, homeRoot, formatApplicationWords);
  });
  return occurrenceLines.length ? [...formatScopeLine(codeUnderReview.searchScope), ...occurrenceLines] : [];
};

export const formatPlaceListText = (codeUnderReview, options = {}) => `${formatPlaceListLines(codeUnderReview, options).join("\n")}\n`;

const findDeclarationsReadAtPlaces = codeUnderReview => ((codeUnderReview.namedDeclarations || {}).declarations || [])
  .filter(declaration => Array.isArray(declaration.readAt));

const readAtLinesOfAPlace = (place, homeRoot) => [
  formatPlaceListLine(place, homeRoot),
  ...(place.below || []).map(below => `    ${below.line}: ${below.text}`),
];

const formatReadAtGroup = (declaration, homeRoot) => [
  `Value \`${declaration.name}\` · ${declaration.path}:${declaration.line}`,
  ...(declaration.readAt.length ? declaration.readAt.flatMap(place => readAtLinesOfAPlace(place, homeRoot)) : ["Lines: none"]),
];

export const readAtListLinesOf = codeUnderReview => {
  const readAt = findDeclarationsReadAtPlaces(codeUnderReview);
  if (!readAt.some(declaration => declaration.readAt.length)) return [];
  const homeRoot = codeUnderReview.namedDeclarations.homeRoot || "";
  return readAt.flatMap(declaration => formatReadAtGroup(declaration, homeRoot));
};

export const readAtListTextOf = codeUnderReview => `${readAtListLinesOf(codeUnderReview).join("\n")}\n`;
