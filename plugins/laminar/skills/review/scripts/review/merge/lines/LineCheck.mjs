import { NO_CODE_UNDER_REVIEW_PLACES } from "../abstractions/CodeUnderReviewPlaces.mjs";

export const LINE_CHECK_RESULTS = Object.freeze({ HELD: "HELD", NO_SUCH_LINE: "NO_SUCH_LINE" });

export const LISTED_FILE_LINE_NUMBER = 0;

const readLineNumbers = named => {
  const numbered = [].concat(named.lines === undefined ? named.line : named.lines)
    .map(line => Number(line))
    .filter(line => line > 0);
  return numbered.length ? numbered : [LISTED_FILE_LINE_NUMBER];
};

const keepOnceEach = namedLines => [...new Map(namedLines.map(named => [`${named.file}:${named.line}`, named])).values()];

const NAMED_LINE_FIELDS = Object.freeze(["evidence", "alsoAt", "places", "abstractionPlace", "entry", "exit", "test", "takenBy", "branches"]);

const PLACE_FIELDS = Object.freeze(["abstractionPlace", "entry", "exit", "test"]);

const PLACE_LIST_FIELDS = Object.freeze(["takenBy", "branches"]);

const collectNamedLines = finding => keepOnceEach(NAMED_LINE_FIELDS.flatMap(field => [].concat(finding[field] || []))
  .filter(Boolean)
  .flatMap(named => readLineNumbers(named).map(line => ({ file: named.file, line })))
  .filter(named => named.file));

const findPlaceAtTheCodeUnderReviewLine = (named, codeUnderReviewId, sliceLines, codeUnderReviewPlaces) => {
  const place = codeUnderReviewPlaces.findPlace(codeUnderReviewId, named.line);
  if (!place) return null;
  const text = sliceLines.readTextAt(place.file, place.line);
  return text ? { ...place, text, namedAs: { file: named.file, line: named.line } } : null;
};

const findTheListedFile = (named, codeUnderReviewId, sliceLines) => {
  const text = sliceLines.readListedFileText(codeUnderReviewId, named.file);
  return text ? { file: named.file, line: LISTED_FILE_LINE_NUMBER, text, namedAs: { file: named.file, line: named.line } } : null;
};

const findTheNamedLine = (named, codeUnderReviewId, sliceLines, codeUnderReviewPlaces) => {
  const text = sliceLines.readTextOfTheCodeUnderReview(codeUnderReviewId, named.file, named.line);
  if (text) return { ...named, text };
  return findTheListedFile(named, codeUnderReviewId, sliceLines)
    || findPlaceAtTheCodeUnderReviewLine(named, codeUnderReviewId, sliceLines, codeUnderReviewPlaces);
};

const findTheLineNamedFromTheSourceRoot = (named, codeUnderReviewId, sliceLines) => {
  const file = sliceLines.findFileFromTheSourceRoot(codeUnderReviewId, named.file);
  if (!file) return null;
  const found = findTheNamedLine({ ...named, file }, codeUnderReviewId, sliceLines, NO_CODE_UNDER_REVIEW_PLACES);
  return found ? { ...found, namedAs: { file: named.file, line: named.line } } : null;
};

const readBack = (named, codeUnderReviewId, sliceLines, codeUnderReviewPlaces) => {
  const found = findTheNamedLine(named, codeUnderReviewId, sliceLines, codeUnderReviewPlaces)
    || findTheLineNamedFromTheSourceRoot(named, codeUnderReviewId, sliceLines);
  if (found) return { ...found, lineCheckResult: LINE_CHECK_RESULTS.HELD };
  return { ...named, text: "", lineCheckResult: LINE_CHECK_RESULTS.NO_SUCH_LINE };
};

export function checkLines(finding, sliceLines, codeUnderReviewPlaces = NO_CODE_UNDER_REVIEW_PLACES) {
  const lines = collectNamedLines(finding).map(named => readBack(named, finding.codeUnderReviewId, sliceLines, codeUnderReviewPlaces));
  const confirmedLines = lines.filter(line => line.lineCheckResult === LINE_CHECK_RESULTS.HELD);
  return {
    lines,
    confirmedLines,
    failed: lines.filter(line => line.lineCheckResult !== LINE_CHECK_RESULTS.HELD),
    dropped: confirmedLines.length === 0,
  };
}

const mapToQuoted = confirmedLines => confirmedLines.map(line => ({ file: line.file, line: line.line, text: line.text }));

const formatPlaceWord = place => `${place.file}:${place.line}`;

const repairsOf = (finding, confirmedLines) => confirmedLines.filter(line => line.namedAs).map(line => ({
  possibleFindingId: finding.possibleFindingId,
  codeUnderReviewId: finding.codeUnderReviewId,
  check: finding.check,
  from: formatPlaceWord(line.namedAs),
  to: formatPlaceWord(line),
}));

const findRepairedPlace = (place, confirmedLines) => {
  const repaired = confirmedLines.find(line => line.namedAs && formatPlaceWord(line.namedAs) === formatPlaceWord(place));
  return repaired ? { file: repaired.file, line: repaired.line } : {};
};

const repairNamedPlaces = (finding, confirmedLines) => {
  const repaired = {};
  for (const field of PLACE_FIELDS) if (finding[field]) repaired[field] = { ...finding[field], ...findRepairedPlace(finding[field], confirmedLines) };
  for (const field of PLACE_LIST_FIELDS) if (finding[field]) repaired[field] = [].concat(finding[field]).map(place => ({ ...place, ...findRepairedPlace(place, confirmedLines) }));
  return repaired;
};

export function checkFindings(possibleFindings, sliceLines, codeUnderReviewPlaces = NO_CODE_UNDER_REVIEW_PLACES) {
  const kept = [];
  const dropped = [];
  const repaired = [];
  for (const finding of possibleFindings) {
    const checked = checkLines(finding, sliceLines, codeUnderReviewPlaces);
    if (checked.dropped) { dropped.push({ ...finding, quotes: checked.lines }); continue; }
    repaired.push(...repairsOf(finding, checked.confirmedLines));
    kept.push({ ...finding, ...findRepairedPlace(finding, checked.confirmedLines), ...repairNamedPlaces(finding, checked.confirmedLines), evidence: mapToQuoted(checked.confirmedLines), quotes: checked.confirmedLines, linesNotInTheCode: checked.failed });
  }
  return { kept, dropped, repaired };
}
