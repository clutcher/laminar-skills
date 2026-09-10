import { REFERENCE_FORMS } from "../../../../../graph/relations/Reference.mjs";
import { RELATION_KINDS } from "../../../../../graph/relations/Relation.mjs";
import { isShown } from "../../../../../inputs/change/ChangedFileText.mjs";
import { GRAPHQL_FILE_KINDS, readGraphQlFileKind } from "../../../../../inputs/source/languages/graphql/GraphQLSourceText.mjs";

const WORD_PATTERN = /[A-Za-z_$][\w$]*/g;

const QUERY_OPENING_PATTERN = /^(?:(?:query|mutation|subscription|fragment)\b|\{)/;
const QUOTE_PATTERN = /^[`"']+/;
const ONE_LINE_QUERY_PATTERN = /(["'`])\s*(?:(?:query|mutation|subscription|fragment)\b[^"'`]*\{|\{\s*[A-Za-z_]\w*[\s({][^"'`]*\})/;

const collectEveryLine = lines => new Set((lines || []).map((text, offset) => offset + 1));

const findOpenerAt = (text, plain) => {
  for (let at = 0; at < text.length; at++) if (plain[at] !== text[at]) return at;
  return text.length;
};

const readTailOfTheOpeningLine = (text, plain) => String(text).slice(findOpenerAt(String(text), String(plain))).replace(QUOTE_PATTERN, "");

const findTextRegions = reading => {
  const regions = [];
  reading.forEach((lineReading, offset) => {
    if (!lineReading.startsInText) return;
    const last = regions[regions.length - 1];
    if (last && last.to === offset) last.to = offset + 1;
    else regions.push({ opening: offset, from: offset + 1, to: offset + 1 });
  });
  return regions;
};

const doesRegionOpenAQuery = (region, lines, reading) => {
  const opening = region.opening > 0 ? readTailOfTheOpeningLine(lines[region.opening - 1], reading[region.opening - 1].plain) : "";
  const text = [opening, ...lines.slice(region.from - 1, region.to)].join(" ").trim();
  return QUERY_OPENING_PATTERN.test(text.replace(QUOTE_PATTERN, "").trim());
};

const findQueryLinesOfStrings = (lines, driver) => {
  const found = new Set();
  const reading = driver.readsStrings ? driver.readStringReading(lines) : [];
  for (const region of findTextRegions(reading)) {
    if (!doesRegionOpenAQuery(region, lines, reading)) continue;
    if (region.opening > 0) found.add(region.opening);
    for (let line = region.from; line <= region.to; line++) found.add(line);
  }
  lines.forEach((text, offset) => { if (ONE_LINE_QUERY_PATTERN.test(String(text))) found.add(offset + 1); });
  return found;
};

export function findQueryLines(driver, lines) {
  if (!driver || !lines) return new Set();
  if (driver.fileHoldsTypesOnly) return readGraphQlFileKind(lines) === GRAPHQL_FILE_KINDS.QUERY ? collectEveryLine(lines) : new Set();
  return findQueryLinesOfStrings(lines.map(String), driver);
}

const findQueryReferencesOnLine = (text, line) => [...String(text).matchAll(WORD_PATTERN)]
  .map(word => ({ line, kind: RELATION_KINDS.READS_FIELD, name: word[0], receiver: "", form: REFERENCE_FORMS.QUERY }));

const collectReadingLines = source => source.lines || source.readings.flat().reduce((lines, reading) => { lines[reading.line - 1] = reading.text; return lines; }, []);

export function findQueryReferences(source) {
  if (!source.driver) return [];
  const queryLines = findQueryLines(source.driver, Array.from(collectReadingLines(source), text => text ?? ""));
  if (!queryLines.size) return [];
  return source.readings.flat().filter(reading => isShown(reading) && queryLines.has(reading.line)).flatMap(reading => findQueryReferencesOnLine(reading.text, reading.line));
}
