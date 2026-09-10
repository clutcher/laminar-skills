import { isACodeLineCarryingAMark } from "../../../../../inputs/source/lines/LineKinds.mjs";
import { doesSpanHoldLine } from "../../../../../graph/abstractions/Place.mjs";
import { Scale } from "../../../../../graph/abstractions/Scale.mjs";
import { opensAnAnnotation } from "../../../../../inputs/source/lines/Annotations.mjs";
import { ROLE_KINDS } from "../../../../../graph/abstractions/Role.mjs";
import { collectLeadingLines } from "../../../../../inputs/source/declarations/DeclarationSpans.mjs";

export const TEST_KINDS = Object.freeze({ TEST: "TEST", HOOK: "HOOK", HELPER: "HELPER" });

const NO_TEST_HEAD_FACTS = Object.freeze({ testHeads: [], hookHeads: [], testsAreMarked: false });

const isAMethod = declaration => declaration.scale === Scale.METHOD.name;

const findWhereTheOtherStopsBeforeTheHead = (declaration, other) => {
  if (other === declaration || other.line >= declaration.line) return 0;
  if (other.span && doesSpanHoldLine(other.span, declaration.line)) return other.line;
  return other.span ? other.span.to : other.line;
};

function collectTheLinesMarkingTheHead(declarations, declaration, lineTexts) {
  const firstLineAfterThePreviousDeclaration = declarations.reduce((latest, other) => Math.max(latest, findWhereTheOtherStopsBeforeTheHead(declaration, other)), 0) + 1;
  const annotations = collectLeadingLines(declaration, lineTexts, firstLineAfterThePreviousDeclaration - 1).filter(opensAnAnnotation);
  return [...annotations, lineTexts[declaration.line - 1] ?? ""];
}

const hasACodeLineCarryingAMark = (lineTexts, marks) => lineTexts.some(text => isACodeLineCarryingAMark(text, marks));

function readTestKindOfTheDeclaration(declaration, marked, reading) {
  if (reading.isATestCall(declaration)) return TEST_KINDS.TEST;
  if (hasACodeLineCarryingAMark(marked, reading.hookMarks)) return TEST_KINDS.HOOK;
  if (hasACodeLineCarryingAMark(marked, reading.testOpeners)) return TEST_KINDS.TEST;
  return TEST_KINDS.HELPER;
}

export function collectTestHeadFacts(declarations, lines, reading) {
  const lineTexts = (lines || []).map(text => String(text ?? ""));
  const testHeadLines = [];
  const hookHeadLines = [];
  const methods = declarations.filter(isAMethod);
  for (const declaration of methods) {
    const testKind = readTestKindOfTheDeclaration(declaration, collectTheLinesMarkingTheHead(declarations, declaration, lineTexts), reading);
    if (testKind === TEST_KINDS.TEST) testHeadLines.push(declaration.line);
    if (testKind === TEST_KINDS.HOOK) hookHeadLines.push(declaration.line);
  }
  const setupConstructorHeadLines = testHeadLines.length ? methods.filter(reading.isAConstructor).map(declaration => declaration.line) : [];
  return {
    testHeads: testHeadLines,
    hookHeads: [...new Set([...hookHeadLines, ...setupConstructorHeadLines])].sort((left, right) => left - right),
    testsAreMarked: reading.testOpeners.length > 0 || testHeadLines.length > 0,
  };
}

export function readTestKindWhere(facts, isTheHead) {
  const testHeadFacts = { ...NO_TEST_HEAD_FACTS, ...(facts || {}) };
  if (testHeadFacts.testHeads.some(isTheHead)) return TEST_KINDS.TEST;
  if (testHeadFacts.hookHeads.some(isTheHead)) return TEST_KINDS.HOOK;
  return testHeadFacts.testsAreMarked ? TEST_KINDS.HELPER : TEST_KINDS.TEST;
}

export const readTestKindAtTheHead = (facts, headLine) => readTestKindWhere(facts, line => line === headLine);

export function readTestHeadFactsOfTheFile(graph, filePath) {
  const testRole = graph.findRolesOfTheFile(filePath).find(role => role.kind === ROLE_KINDS.TEST);
  return { ...NO_TEST_HEAD_FACTS, ...(testRole ? testRole.facts : {}) };
}
