import { escapeForAPattern } from "../../../inputs/source/text/PatternText.mjs";
import { findMethodRelationFinder } from "../../finders/LanguageStrategies.mjs";
import { readLambdaParameterForm, LAMBDA_HINT_PATTERN } from "../../abstractions/method/generic/typing/LambdaForms.mjs";
import { getOrReadAndRemember } from "../../../../collections/memos.mjs";

const localFormsByKeyMap = new Map();

const readLocalDeclarationForms = (name, diffDriver) => {
  const key = `${diffDriver}\u0000${name}`;
  if (!localFormsByKeyMap.has(key)) localFormsByKeyMap.set(key, buildLocalDeclarationForms(name, diffDriver));
  return localFormsByKeyMap.get(key);
};

const buildLocalDeclarationForms = (name, diffDriver) => {
  const word = escapeForAPattern(name);
  const forms = [
    new RegExp(`(?:^|[^\\w$.])(?:var|let|const|val|auto|final|my|local)\\s+(?:[\\w$.<>\\[\\]*]+\\s+)?${word}(?![\\w$])`),
    new RegExp(`(?:^|[^\\w$.])(?:[\\w$]+\\s*,\\s*)*${word}\\s*(?:,\\s*[\\w$]+\\s*)*:=`),
    new RegExp(`\\bfor\\s*\\(?\\s*(?:[\\w$.<>\\[\\]]+\\s+)?(?:[\\w$]+\\s*,\\s*)?${word}\\s*(?:,|\\bin\\b|\\bof\\b|:)`),
    new RegExp(`(?:^|[(,;])\\s*(?:final\\s+)?[A-Z][\\w$.<>\\[\\]]*\\s+${word}\\s*[=;,)]`),
  ];
  if (findMethodRelationFinder(diffDriver).assignmentDeclaresALocal) forms.push(new RegExp(`^\\s*${word}\\s*(?::[^=]+)?=(?!=)`));
  return forms;
};

const FUNCTION_DECLARATION_HINT_PATTERN = /=>|\b(?:function|def|fun|func|fn|lambda)\b|=\s*\{/;

const localFunctionFormsByNameMap = new Map();

const readLocalFunctionForms = name => {
  if (!localFunctionFormsByNameMap.has(name)) {
    const word = escapeForAPattern(name);
    localFunctionFormsByNameMap.set(name, [
      new RegExp(`(?:^|[^\\w$.])(?:const|let|var|val)\\s+${word}\\s*(?::[^=]+)?=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[\\w$]+)\\s*(?::\\s*[^=]+)?=>`),
      new RegExp(`(?:^|[^\\w$.])(?:const|let|var|val)\\s+${word}\\s*(?::[^=]+)?=\\s*(?:async\\s+)?(?:function\\b|\\{)`),
      new RegExp(`(?:^|[^\\w$.])(?:function|def|fun|func|fn)\\s+${word}\\s*[(<]`),
      new RegExp(`(?:^|[^\\w$.])${word}\\s*:?=\\s*(?:func\\s*\\(|lambda\\b)`),
    ]);
  }
  return localFunctionFormsByNameMap.get(name);
};

const WORD_PATTERN = /[A-Za-z_$][\w$]*/g;

export const MethodScope = {
  isLocal(method, name) {
    return this.isADeclaredParameterOf(method, name) || this.declaresALocalNamed(method, name);
  },

  declaresALocalNamed(method, name) {
    return getOrReadAndRemember(this.localByMethodAndNameMap, `${method.id}\u0000${name}`, () => this.holdsALocalDeclarationOf(method, name));
  },

  holdsALocalDeclarationOf(method, name) {
    const forms = readLocalDeclarationForms(name, method.file.diffDriver);
    return this.findLinesOfMethodHolding(method, name).some(index => forms.some(form => form.test(method.file.code[index])));
  },

  isAValueOfTheMethod(method, name) {
    return this.isLocal(method, name) || this.isALambdaParameter(method, name);
  },

  isADeclaredParameterOf(method, name) {
    return method.parameterNames.includes(name);
  },

  isAParameterOf(method, name) {
    return this.isADeclaredParameterOf(method, name) || this.isALambdaParameter(method, name);
  },

  findLinesOfMethodHolding(method, word) {
    if (!this.wordLinesByMethodIdMap) this.wordLinesByMethodIdMap = new Map();
    if (!this.wordLinesByMethodIdMap.has(method.id)) {
      const linesByWordMap = new Map();
      for (const index of this.listLinesOfMethod(method)) {
        for (const found of new Set((method.file.code[index] || "").match(WORD_PATTERN) || [])) this.add(linesByWordMap, found, index);
      }
      this.wordLinesByMethodIdMap.set(method.id, linesByWordMap);
    }
    return this.wordLinesByMethodIdMap.get(method.id).get(word) || [];
  },

  declaresALocalFunction(method, name) {
    if (!this.localFunctionByMethodAndNameMap) this.localFunctionByMethodAndNameMap = new Map();
    return getOrReadAndRemember(this.localFunctionByMethodAndNameMap, `${method.id}\u0000${name}`, () => this.holdsALocalFunctionDeclarationOf(method, name));
  },

  holdsALocalFunctionDeclarationOf(method, name) {
    const forms = readLocalFunctionForms(name);
    return this.findLinesOfMethodHolding(method, name).some(index => index > method.line - 1 && FUNCTION_DECLARATION_HINT_PATTERN.test(method.file.code[index]) && forms.some(form => form.test(method.file.code[index])));
  },

  isALambdaParameter(method, name) {
    if (!this.lambdaParameterByMethodAndNameMap) this.lambdaParameterByMethodAndNameMap = new Map();
    return getOrReadAndRemember(this.lambdaParameterByMethodAndNameMap, `${method.id}\u0000${name}`, () => this.holdsALambdaParameterNamed(method, name));
  },

  holdsALambdaParameterNamed(method, name) {
    const form = readLambdaParameterForm(name);
    return this.findLinesOfMethodHolding(method, name).some(index => {
      const code = method.file.code[index] || "";
      return LAMBDA_HINT_PATTERN.test(code) && form.test(code);
    });
  },
};
