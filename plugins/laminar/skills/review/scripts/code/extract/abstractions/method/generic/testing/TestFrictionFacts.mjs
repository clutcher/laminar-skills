import { isACodeLineCarryingAMark } from "../../../../../inputs/source/lines/LineKinds.mjs";
import { doRegionsHoldLine } from "../../../../../graph/abstractions/Place.mjs";

const ANNOTATION_LINE_PATTERN = /^\s*[@[]/;

const indentOf = text => text.match(/^\s*/)[0].length;

const isBlank = text => !text.trim();

function findSetupBody(lines, start) {
  const headIndent = indentOf(lines[start]);
  let headEnd = start;
  while (headEnd + 1 < lines.length && ANNOTATION_LINE_PATTERN.test(lines[headEnd]) && indentOf(lines[headEnd + 1]) === headIndent) headEnd++;
  let at = headEnd + 1;
  while (at < lines.length && (isBlank(lines[at]) || indentOf(lines[at]) > headIndent)) at++;
  return { from: start + 1, bodyFrom: headEnd + 2, to: at };
}

function findSetupRegions(lines, setupMarkers) {
  const regions = [];
  lines.forEach((text, index) => {
    const line = index + 1;
    if (!isACodeLineCarryingAMark(text, setupMarkers)) return;
    if (doRegionsHoldLine(regions, line)) return;
    regions.push(findSetupBody(lines, index));
  });
  return regions;
}

const findLinesMatching = (lines, patterns) => lines
  .map((text, index) => (isACodeLineCarryingAMark(text, patterns) ? index + 1 : 0))
  .filter(Boolean);

const TEST_MARK_KINDS = Object.freeze(["setupMarkers", "testOpeners", "partialSubstitutes", "substitutesReturningSubstitutes", "privateMethodsReached", "interactionAssertions"]);

const collectTestMarks = roleFinders => Object.fromEntries(TEST_MARK_KINDS.map(kind => [kind, roleFinders.flatMap(finder => finder.testCodeMarks[kind])]));

export function readTestFrictionFacts(lines, roleFinders) {
  const texts = lines.map(text => String(text ?? ""));
  const marks = collectTestMarks(roleFinders);
  return {
    setupRegions: findSetupRegions(texts, marks.setupMarkers),
    testOpeners: findLinesMatching(texts, marks.testOpeners),
    partialSubstitutes: findLinesMatching(texts, marks.partialSubstitutes),
    substitutesReturningSubstitutes: findLinesMatching(texts, marks.substitutesReturningSubstitutes),
    privateMethodsReached: findLinesMatching(texts, marks.privateMethodsReached),
    interactionAssertions: findLinesMatching(texts, marks.interactionAssertions),
  };
}
