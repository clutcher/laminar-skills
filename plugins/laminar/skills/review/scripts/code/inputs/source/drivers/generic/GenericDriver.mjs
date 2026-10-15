import { areBlocksIndented } from "../../forms/BodyEnds.mjs";
import { LanguageDriver } from "../LanguageDriver.mjs";
import { NO_COMMENT_FORMS } from "../../forms/CommentForms.mjs";
import { findLanguage } from "../../Languages.mjs";
import { buildCommentReadingLines, opensTextAt, buildStringReading, collectTextLines, findValueEnd } from "../../forms/StringReading.mjs";
import { readCodeOfLine } from "../../SourceText.mjs";
import { findBracedBlockEnd, closesAlignedWith, findIndentedBlockEnd } from "../../text/BlockEnds.mjs";
import { isImportLine } from "../../lines/ImportLines.mjs";
import { readDeclarationAt, readDeclaration, endsAWrappedHead, looksLikeDeclaration, looksLikeDeclarationAt, readsAsAHeadShape, startsACallThatSpansLines, readTypeName } from "../../declarations/DeclarationHeadReading.mjs";
import { CLASS_FINDER_REGISTRY } from "../../../../extract/abstractions/class/index.mjs";
import { METHOD_FINDER_REGISTRY } from "../../../../extract/abstractions/method/index.mjs";
import { FinderContext } from "../../../../extract/finders/FinderContext.mjs";
import { readParameterNames } from "../../../../extract/abstractions/method/generic/signatures/ParameterLists.mjs";
import { findLocalVariables } from "../../../../extract/abstractions/variable/generic/values/DeclaredValues.mjs";
import { VARIABLE_FINDER_REGISTRY } from "../../../../extract/abstractions/variable/index.mjs";

export class GenericDriver extends LanguageDriver {
  #readingsByLinesMap = new WeakMap();

  get customFunctionNamePattern() {
    return findLanguage(this.diffDriver).functionNamePattern || null;
  }

  get commentForms() {
    return findLanguage(this.diffDriver).commentForms || NO_COMMENT_FORMS;
  }

  get context() {
    return FinderContext.createForLanguage(this.diffDriver);
  }

  get readClassFinder() {
    return CLASS_FINDER_REGISTRY.findWalkingFinder(this.context);
  }

  get classRelationFinder() {
    return CLASS_FINDER_REGISTRY.findRelationFinder(this.context);
  }

  get variableFinder() {
    return VARIABLE_FINDER_REGISTRY.findWalkingFinder(this.context);
  }

  get variableRelationFinder() {
    return VARIABLE_FINDER_REGISTRY.findRelationFinder(this.context);
  }

  get scopeIsFlat() {
    return this.readClassFinder.scopeIsFlat;
  }

  get stringForm() {
    return findLanguage(this.diffDriver).stringForm || null;
  }

  get readsStrings() {
    return Boolean(this.stringForm);
  }

  readStringReading(lines) {
    if (!this.#readingsByLinesMap.has(lines)) this.#readingsByLinesMap.set(lines, buildStringReading(lines, this.stringForm));
    return this.#readingsByLinesMap.get(lines);
  }

  findTextLines(lines) {
    return this.readsStrings ? collectTextLines(this.readStringReading(lines)) : super.findTextLines(lines);
  }

  get blocksAreIndented() {
    return areBlocksIndented(findLanguage(this.diffDriver));
  }

  findBlockEnds(lines) {
    const reading = this.readsStrings ? this.readStringReading(lines) : null;
    const codes = reading ? reading.map(lineReading => lineReading.code) : lines.map(line => readCodeOfLine(line));
    const textLines = this.findTextLines(lines);
    const endByLineMap = new Map();
    const findEndAt = index => {
      if (this.blocksAreIndented) return findIndentedBlockEnd(lines, codes, textLines, index) || 0;
      const end = findBracedBlockEnd(lines, codes, index);
      return end && closesAlignedWith(lines, index, end) ? end + 1 : 0;
    };
    return line => {
      if (!endByLineMap.has(line)) endByLineMap.set(line, line >= 1 && line <= lines.length ? findEndAt(line - 1) : 0);
      return endByLineMap.get(line);
    };
  }

  findTextOpeningLines(lines) {
    if (!this.readsStrings) return super.findTextOpeningLines(lines);
    const reading = this.readStringReading(lines);
    return new Set(reading.map((lineReading, offset) => (opensTextAt(reading, offset + 1) ? offset + 1 : 0)).filter(Boolean));
  }

  readLinesForComments(lines) {
    return this.readsStrings ? buildCommentReadingLines(this.readStringReading(lines), lines) : super.readLinesForComments(lines);
  }

  findValueEnds(lines) {
    if (!this.readsStrings) return super.findValueEnds(lines);
    const reading = this.readStringReading(lines);
    return line => findValueEnd(reading, line);
  }

  readDeclaration(headLine) {
    return readDeclaration(this.diffDriver, headLine);
  }

  findDeclarationAt(lines, index) {
    return readDeclarationAt(this.diffDriver, lines, index);
  }

  findHeadsWrappedBeforeTheName(lines) {
    return METHOD_FINDER_REGISTRY.findWalkingFinder(this.context).findHeadsWrappedBeforeTheName(lines);
  }

  listSupertypes(headText) {
    return this.classRelationFinder.listSupertypes(headText, this.diffDriver);
  }

  isTestCallback(name, context) {
    return METHOD_FINDER_REGISTRY.findFinders(context).some(finder => finder.isTestCallback(name));
  }

  readsAsAHeadShape(text) {
    return readsAsAHeadShape(this.diffDriver, text);
  }

  looksLikeDeclaration(line) {
    return looksLikeDeclaration(this.diffDriver, line);
  }

  endsAWrappedHead(line) {
    return endsAWrappedHead(this.diffDriver, line);
  }

  looksLikeDeclarationAt(lines, index) {
    return looksLikeDeclarationAt(this.diffDriver, lines, index);
  }

  startsACallThatSpansLines(lines, index) {
    return startsACallThatSpansLines(this.diffDriver, lines, index);
  }

  isPrivate(headLine, name, indent) {
    return this.readClassFinder.isPrivate(headLine, name, indent);
  }

  findLocalVariables(lines) {
    return findLocalVariables(lines);
  }

  readParameterNames(headText) {
    return readParameterNames(headText);
  }

  findFieldName(line) {
    return this.variableFinder.findFieldName(line);
  }

  findComponentNames(headText) {
    return this.variableFinder.findComponentNames(headText);
  }

  isAConstructor(tag) {
    return this.variableFinder.isAConstructor(tag);
  }

  findConstructorFields(lines) {
    return this.variableFinder.findConstructorFields(lines);
  }

  namesAPackage(text) {
    return this.readClassFinder.namesAPackage(text);
  }

  isImportLine(line) {
    return isImportLine(line);
  }

  findValueReferences(code) {
    return this.variableRelationFinder.findValueReferences(code, METHOD_FINDER_REGISTRY.findRelationFinder(this.context));
  }

  findValueDeclaredAt(lines, lineNumber, name) {
    return this.variableFinder.findValueDeclaredAt(lines, lineNumber, name, this.diffDriver);
  }

  readTypeName(head) {
    return readTypeName(this.diffDriver, head);
  }

  get methodRoleFinders() {
    return METHOD_FINDER_REGISTRY.findRoleFinders(this.context);
  }

  get readsInlineTests() {
    return this.methodRoleFinders.some(finder => finder.testCodeMarks.readsInlineTests);
  }

  findInlineTests(lines) {
    const finder = this.methodRoleFinders.find(methodRoleFinder => methodRoleFinder.testCodeMarks.readsInlineTests);
    return finder ? finder.testCodeMarks.findInlineTests(lines) : null;
  }
}
