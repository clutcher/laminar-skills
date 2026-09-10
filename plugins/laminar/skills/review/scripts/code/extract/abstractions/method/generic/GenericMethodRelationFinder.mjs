import { findNamesOnLine } from "./references/NameReferences.mjs";
import { findLiteralsOnLine } from "./references/LiteralReferences.mjs";
import { findQueryReferences } from "./references/QueryReferences.mjs";
import { findChainRootBefore, readCallsInColumnOrder, findReceiverBefore } from "./calls/CallScanner.mjs";
import { CodeLines } from "../../../../inputs/source/text/CodeLines.mjs";
import { isShown } from "../../../../inputs/change/ChangedFileText.mjs";
import { doesSpanHoldLine } from "../../../../graph/abstractions/Place.mjs";
import { isAUseOfAType } from "../../../../graph/relations/Reference.mjs";
import { RELATION_KINDS } from "../../../../graph/relations/Relation.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { readLanguageFamily } from "../../../../inputs/source/Languages.mjs";
import { isUpperSnakeName } from "../../../../inputs/source/names/NamingConventions.mjs";
import { RelationFinder } from "../../../finders/RelationFinder.mjs";

const NO_SPAN = null;

const narrowedTo = (possibleTargets, isPreferred) => {
  const preferred = possibleTargets.filter(isPreferred);
  return preferred.length ? preferred : possibleTargets;
};

const findTargetScale = reference => {
  if (isAUseOfAType(reference)) return Scale.CLASS;
  return reference.kind === RELATION_KINDS.READS_FIELD && isUpperSnakeName(reference.name) ? Scale.VARIABLE : null;
};

const isAnotherDeclarationInTheFamily = (possibleTarget, reference, family) => possibleTarget !== reference.from && readLanguageFamily(possibleTarget.place.file) === family;

const isInTheApplicationOf = (possibleTarget, reference) => possibleTarget.isInTheSameApplicationAs(reference.from);

const isEnclosedByTheReceiverOf = (possibleTarget, reference) => {
  if (!reference.receiver || !possibleTarget.parent) return false;
  return possibleTarget.parent.name === reference.receiver;
};

const findPossibleTargets = (reference, scale, graph) => {
  const family = readLanguageFamily(reference.place.file);
  const inTheFamily = graph.findDeclaredAfterTheChangeNamed(reference.name, scale).filter(possibleTarget => isAnotherDeclarationInTheFamily(possibleTarget, reference, family));
  const inTheApplication = narrowedTo(inTheFamily, possibleTarget => isInTheApplicationOf(possibleTarget, reference));
  return narrowedTo(inTheApplication, possibleTarget => isEnclosedByTheReceiverOf(possibleTarget, reference));
};

const readSpan = abstraction => (abstraction && abstraction.place ? abstraction.place.span : NO_SPAN);

export class GenericMethodRelationFinder extends RelationFinder {
  constructor() {
    super(Scale.METHOD);
    this.receiverSeparators = [];
    this.wordsNeverACallee = [];
    this.methodHeads = null;
    this.privateNamePrefix = "";
    this.callsOwnMembersBare = false;
    this.callsWithoutParentheses = false;
    this.trailingBlockCalls = false;
    this.doBlockCalls = false;
    this.cStyleCasts = false;
    this.castsAfterADot = false;
    this.hasRuntimeGlobals = false;
    this.assignmentDeclaresALocal = false;
    this.typesInFolderAreInScope = false;
    this.functionsOfTheFolderAreInScope = false;
    this.resultsComeFromInterfaces = false;
    this.typeOfAnImportedModuleIsQualified = false;
  }

  findReferencesIn(abstraction, source) {
    if (!source.driver) return [];
    const span = readSpan(abstraction);
    const found = [...source.readings.flatMap(numberedLines => this.findReferencesOfReading(numberedLines, source.driver)), ...findQueryReferences(source)];
    return span ? found.filter(reference => doesSpanHoldLine(span, reference.line)) : found;
  }

  findReferencesOfReading(numberedLines, driver) {
    const read = new CodeLines(numberedLines.map(numberedLine => String(numberedLine.text ?? "")), driver.diffDriver, driver.commentForms);
    const found = [];
    numberedLines.forEach((numberedLine, at) => {
      if (!isShown(numberedLine)) return;
      const raw = String(numberedLine.text ?? "");
      found.push(...findNamesOnLine(read.code[at], numberedLine.line, this), ...findLiteralsOnLine(raw, read.code[at], numberedLine.line));
    });
    return found;
  }

  resolve(reference, graph) {
    const scale = findTargetScale(reference);
    if (!scale) return null;
    const possibleTargets = findPossibleTargets(reference, scale, graph);
    if (!possibleTargets.length) return null;
    return possibleTargets.length === 1 ? { to: possibleTargets[0] } : { possibleTargets };
  }

  findCallsOnLine(text, from) {
    return readCallsInColumnOrder(text, this, from);
  }

  findMoreCallsOnLine() {
    return [];
  }

  findReceiverBefore(code, at) {
    return findReceiverBefore(code, at, this);
  }

  findChainRootBefore(code, at) {
    return findChainRootBefore(code, at, this);
  }

  findMethodReferences() {
    return [];
  }
}
