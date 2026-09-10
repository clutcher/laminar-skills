import { NO_COMMENT_FORMS } from "../forms/CommentForms.mjs";
import { UPPER_SNAKE_NAME_PATTERN } from "../names/NamingConventions.mjs";
import { findValueQualifierBefore } from "../text/QualifierText.mjs";
import { Scale } from "../../../graph/abstractions/Scale.mjs";

export const NO_DECLARATION = Object.freeze({ scale: null, name: null, scope: null });

export const NO_TEXT_LINES = Object.freeze(new Set());

const NO_VALUE_END = () => 0;

export const MIN_VALUE_NAME_LENGTH = 2;

export class LanguageDriver {
  constructor(diffDriver) {
    this.diffDriver = diffDriver;
  }

  get customFunctionNamePattern() {
    return null;
  }

  get commentForms() {
    return NO_COMMENT_FORMS;
  }

  get fileHoldsTypesOnly() {
    return false;
  }

  get holdsProse() {
    return false;
  }

  findDeclarationHeads() {
    return null;
  }

  findTextLines() {
    return NO_TEXT_LINES;
  }

  findBlockEnds() {
    return NO_VALUE_END;
  }

  findTextOpeningLines() {
    return NO_TEXT_LINES;
  }

  readLinesForComments(lines) {
    return lines;
  }

  findValueEnds() {
    return NO_VALUE_END;
  }

  readDeclaration() {
    return NO_DECLARATION;
  }

  findDeclarationAt(lines, index) {
    return this.readDeclaration(lines[index]);
  }

  findTypeDisplayName() {
    return null;
  }

  looksLikeDeclaration() {
    return false;
  }

  declaresAClass(text) {
    return this.looksLikeDeclaration(text) && this.readDeclaration(text).scale === Scale.CLASS.name;
  }

  looksLikeDeclarationAt(lines, index) {
    return this.looksLikeDeclaration(lines[index]);
  }

  startsACallThatSpansLines() {
    return false;
  }

  isPrivate() {
    return false;
  }

  namesAPackage() {
    return false;
  }

  listSupertypes() {
    return [];
  }

  findLocalVariables() {
    return [];
  }

  readParameterNames() {
    return [];
  }

  findFieldName() {
    return null;
  }

  findComponentNames() {
    return [];
  }

  isAConstructor() {
    return false;
  }

  findConstructorFields() {
    return [];
  }

  isImportLine() {
    return false;
  }

  findValueReferences(code) {
    return [...String(code).matchAll(UPPER_SNAKE_NAME_PATTERN)]
      .filter(match => match[0].length >= MIN_VALUE_NAME_LENGTH)
      .map(match => ({ at: match.index, name: match[0], qualifier: findValueQualifierBefore(code, match.index) }));
  }

  findValueDeclaredAt() {
    return null;
  }

  get readsInlineTests() {
    return false;
  }

  findInlineTests() {
    return null;
  }
}
