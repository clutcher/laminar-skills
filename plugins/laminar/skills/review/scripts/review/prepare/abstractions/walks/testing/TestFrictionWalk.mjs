import { compareByPathAndLine, COMMENT_LINE_FORMS, isACodeLine, isTestPath, ROLE_KINDS, doesSpanHoldLine } from "../../../../../code/index.mjs";
import { isAnExactTestFileName } from "./TestReachWalk.mjs";

export const FRICTION_KINDS = Object.freeze({
  SETUP_GREW: "SETUP_GREW",
  PARTIAL_SUBSTITUTE: "PARTIAL_SUBSTITUTE",
  SUBSTITUTE_RETURNS_SUBSTITUTE: "SUBSTITUTE_RETURNS_SUBSTITUTE",
  PRIVATE_METHOD_REACHED: "PRIVATE_METHOD_REACHED",
});

const FRICTION_ORDER = [
  FRICTION_KINDS.SETUP_GREW, FRICTION_KINDS.PARTIAL_SUBSTITUTE, FRICTION_KINDS.SUBSTITUTE_RETURNS_SUBSTITUTE,
  FRICTION_KINDS.PRIVATE_METHOD_REACHED,
];

const METHOD_FRICTION_KINDS = [FRICTION_KINDS.PARTIAL_SUBSTITUTE, FRICTION_KINDS.SUBSTITUTE_RETURNS_SUBSTITUTE];

export const MAX_FRICTION_LINES = 6;

const NO_FACTS = Object.freeze({ setupRegions: [], testOpeners: [], partialSubstitutes: [], substitutesReturningSubstitutes: [], privateMethodsReached: [] });

const holdsCode = text => isACodeLine(text, COMMENT_LINE_FORMS.C_STYLE_AND_HASH);

const buildFrictionLine = (kind, filePath, line, text) => ({ kind, path: filePath, line, text: text.trim() });

export const selectMethodFriction = classFriction => classFriction
  .filter(frictionLine => METHOD_FRICTION_KINDS.includes(frictionLine.kind));

function capFairly(found) {
  const byKind = FRICTION_ORDER.map(kind => found.filter(frictionLine => frictionLine.kind === kind).sort(compareByPathAndLine));
  const taken = [];
  for (let round = 0; taken.length < MAX_FRICTION_LINES && byKind.some(frictionLinesOfAKind => frictionLinesOfAKind.length > round); round++) {
    for (const frictionLinesOfAKind of byKind) {
      if (frictionLinesOfAKind[round] && taken.length < MAX_FRICTION_LINES) taken.push(frictionLinesOfAKind[round]);
    }
  }
  return FRICTION_ORDER.flatMap(kind => taken.filter(frictionLine => frictionLine.kind === kind));
}

export class TestFrictionWalk {
  constructor(changedFiles, linesOf, references, graph) {
    this.readLinesOf = linesOf;
    this.references = references;
    this.graph = graph;
    this.factsByFileMap = new Map(graph.findAbstractionsWithRole(ROLE_KINDS.TEST)
      .flatMap(abstraction => abstraction.roles.filter(role => role.kind === ROLE_KINDS.TEST && role.facts.setupRegions).map(role => [abstraction.place.file, role.facts])));
    this.addedLinesByPathMap = new Map(changedFiles.map(file =>
      [file.path, file.hunks.flatMap(hunk => hunk.numberedAddedLines)]));
  }

  collectFriction(classAbstraction) {
    const testPaths = this.findTestPaths(classAbstraction);
    return capFairly([
      ...testPaths.flatMap(testPath => this.findSetupGrowth(testPath)),
      ...testPaths.flatMap(testPath => this.buildFrictionLines(testPath, this.readFacts(testPath).partialSubstitutes, FRICTION_KINDS.PARTIAL_SUBSTITUTE)),
      ...testPaths.flatMap(testPath => this.substitutesReturningSubstitutesIn(testPath)),
      ...testPaths.flatMap(testPath => this.buildFrictionLines(testPath, this.readFacts(testPath).privateMethodsReached, FRICTION_KINDS.PRIVATE_METHOD_REACHED)),
      ...this.findVisibleForTesting(classAbstraction),
    ]);
  }

  findTestPaths(classAbstraction) {
    const rankedTests = (classAbstraction.reachingTests && classAbstraction.reachingTests.ranked) || [];
    return rankedTests
      .filter(reachingTest => isTestPath(reachingTest.path))
      .filter(reachingTest => isAnExactTestFileName(reachingTest.path, classAbstraction.name)
        || (reachingTest.changedInTheChange && this.namesTheClass(reachingTest.path, classAbstraction.name)))
      .map(reachingTest => reachingTest.path);
  }

  namesTheClass(filePath, className) {
    return this.references.lines.collectNamesInFile(filePath).has(className);
  }

  readFacts(filePath) {
    return this.factsByFileMap.get(filePath) || NO_FACTS;
  }

  readFileLines(filePath) {
    return this.readLinesOf(filePath) || [];
  }

  readAddedLines(filePath) {
    return this.addedLinesByPathMap.get(filePath) || [];
  }

  buildFrictionLines(filePath, lines, kind) {
    const texts = this.readFileLines(filePath);
    return lines.map(line => buildFrictionLine(kind, filePath, line, String(texts[line - 1] ?? "")));
  }

  substitutesReturningSubstitutesIn(filePath) {
    const facts = this.readFacts(filePath);
    const partialSubstituteLines = new Set(facts.partialSubstitutes);
    return this.buildFrictionLines(filePath, facts.substitutesReturningSubstitutes.filter(line => !partialSubstituteLines.has(line)), FRICTION_KINDS.SUBSTITUTE_RETURNS_SUBSTITUTE);
  }

  findSetupGrowth(filePath) {
    const added = this.readAddedLines(filePath);
    const openers = new Set(this.readFacts(filePath).testOpeners);
    if (!added.some(addedLine => openers.has(addedLine.line))) return [];
    const regions = this.readFacts(filePath).setupRegions;
    return added
      .filter(addedLine => holdsCode(addedLine.text))
      .filter(addedLine => regions.some(region => addedLine.line >= region.bodyFrom && addedLine.line <= region.to))
      .map(addedLine => buildFrictionLine(FRICTION_KINDS.SETUP_GREW, filePath, addedLine.line, addedLine.text));
  }

  findVisibleForTesting(classAbstraction) {
    const lines = classAbstraction.lines;
    if (!lines) return [];
    const fileClass = this.graph.findFileClassAt(classAbstraction.path);
    const marked = new Set(fileClass ? fileClass.measures.visibleForTesting || [] : []);
    return this.readAddedLines(classAbstraction.path)
      .filter(addedLine => doesSpanHoldLine(lines, addedLine.line) && marked.has(addedLine.line))
      .map(addedLine => buildFrictionLine(FRICTION_KINDS.PRIVATE_METHOD_REACHED, classAbstraction.path, addedLine.line, addedLine.text));
  }
}
