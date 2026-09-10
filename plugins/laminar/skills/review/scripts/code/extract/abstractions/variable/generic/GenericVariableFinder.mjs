import { readCodeOfLine, indentOf } from "../../../../inputs/source/SourceText.mjs";
import { readTypeName } from "../../../../inputs/source/declarations/DeclarationHeadReading.mjs";

import { readParameters } from "../../method/generic/signatures/ParameterLists.mjs";
import { AbstractionFinder } from "../../../finders/AbstractionFinder.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { escapeForAPattern, buildWholeWordPattern } from "../../../../inputs/source/text/PatternText.mjs";

export const declaresAnUpperSnakeValueIn = (code, name) => new RegExp(`(?<![\\w$.])${escapeForAPattern(name)}\\s*(?::[^=]*)?=(?![=>])`).test(code)
  || new RegExp(`^\\s*${escapeForAPattern(name)}\\s*(?:[(,;{]|$)`).test(code);

export const buildAnyValueDeclarationPattern = name => new RegExp([
  `(?:^|[^\\w$.])(?:const|let|var|val|final|auto)\\s+${escapeForAPattern(name)}(?![\\w$])`,
  `^\\s*${escapeForAPattern(name)}\\s*(?::[^=]+)?=(?![=>])`,
  `(?:^|\\s)[A-Z][\\w$<>,\\[\\]?]*\\s+${escapeForAPattern(name)}\\s*=(?![=>])`,
].join("|"));

const LIST_ITEM_END_PATTERN = /,\s*$/;
const MAX_LINES_TO_A_HEAD = 3000;
const OPENERS = "{(";
const CLOSERS = "})";
const ITEM_START_PATTERN = /[{,(]/;

function findPreviousCodeLine(lines, index) {
  for (let at = index - 1; at >= 0; at--) {
    const code = readCodeOfLine(lines[at]).trim();
    if (code) return code;
  }
  return "";
}

function findHeadByBrackets(lines, lineNumber, nameAt) {
  let depth = 0;
  const lowest = Math.max(0, lineNumber - 1 - MAX_LINES_TO_A_HEAD);
  for (let index = lineNumber - 1; index >= lowest; index--) {
    const whole = readCodeOfLine(lines[index]);
    const code = index === lineNumber - 1 ? whole.slice(0, nameAt) : whole;
    for (let at = code.length - 1; at >= 0; at--) {
      if (CLOSERS.includes(code[at])) depth++;
      else if (OPENERS.includes(code[at])) {
        if (depth === 0) return code.slice(0, at).trim() || findPreviousCodeLine(lines, index);
        depth--;
      }
    }
  }
  return "";
}

function findHeadByIndent(lines, lineNumber) {
  const own = indentOf(String(lines[lineNumber - 1] || ""));
  for (let index = lineNumber - 2; index >= 0 && index >= lineNumber - 1 - MAX_LINES_TO_A_HEAD; index--) {
    const text = String(lines[index] || "");
    if (text.trim() && indentOf(text) < own) return text.trim();
  }
  return "";
}

const readItem = (code, nameAt) => {
  let start = 0;
  for (let at = nameAt - 1; at >= 0; at--) if (ITEM_START_PATTERN.test(code[at])) { start = at + 1; break; }
  return code.slice(start);
};

export class GenericVariableFinder extends AbstractionFinder {
  constructor() {
    super(Scale.VARIABLE);
    this.typeOrder = null;
    this.typeAfterTheName = null;
    this.valueForms = null;
    this.headByIndent = false;
    this.componentForm = null;
    this.constructorFieldForm = null;
    this.declaredOnlyWithAWordOrAType = false;
    this.ownFieldAssignmentDeclares = false;
    this.literalTypes = null;
    this.initializerForms = [];
    this.forEachForm = null;
    this.forEachNamesAKeyFirst = false;
    this.capitalCallIsAFunction = false;
    this.callMayOpenABlock = false;
  }

  findFieldNameIn(text) {
    return null;
  }

  findFieldName(line) {
    const text = readCodeOfLine(line);
    return LIST_ITEM_END_PATTERN.test(text) ? null : this.findFieldNameIn(text);
  }

  findComponentNames(headText) {
    const form = this.componentForm;
    if (!form || !form.head.test(String(headText || ""))) return [];
    return readParameters(headText).map(form.readName).filter(Boolean);
  }

  isAConstructor(tag) {
    const form = this.constructorFieldForm;
    return Boolean(form) && tag.scale === Scale.METHOD.name && tag.name === form.name;
  }

  findConstructorFields(lines) {
    const form = this.constructorFieldForm;
    return form ? form.findFields(lines) : [];
  }

  findValueDeclaredAt(lines, lineNumber, name, language) {
    const forms = this.valueForms;
    const code = readCodeOfLine((lines || [])[lineNumber - 1]);
    const nameAt = code.search(buildWholeWordPattern(name));
    if (!forms || nameAt < 0) return null;
    const word = escapeForAPattern(name);
    const findHead = () => (this.headByIndent ? findHeadByIndent(lines, lineNumber) : findHeadByBrackets(lines, lineNumber, nameAt));
    if (forms.constants.some(form => form(word).test(code))) return { enclosingTypeName: readTypeName(language, findHead()) };
    const item = readItem(code, nameAt);
    const members = forms.enclosingTypeForms.filter(enclosingTypeForm => enclosingTypeForm.member(word).test(code) || enclosingTypeForm.member(word).test(item));
    if (!members.length) return null;
    const enclosingHead = findHead();
    if (!members.some(enclosingTypeForm => enclosingTypeForm.head.test(enclosingHead))) return null;
    const enclosingTypeName = readTypeName(language, enclosingHead);
    return enclosingTypeName === name ? null : { enclosingTypeName };
  }
}
