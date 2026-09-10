import { readLambdaParameterForm, LAMBDA_HINT_PATTERN } from "./LambdaForms.mjs";
import { readPackageScope } from "../../../../finders/LanguageStrategies.mjs";
import { CALL_FORMS, namesAQualifier } from "../../../../../graph/relations/Reference.mjs";
import { findClosingParenthesis as closingParenthesisOf } from "../../../../../inputs/source/text/Brackets.mjs";
import { WORDS_FOR_THE_ENCLOSING_TYPE } from "../../../../../inputs/source/names/LanguageWords.mjs";
import { findDeclarationIn } from "../../../variable/generic/types/DeclaredTypes.mjs";
import { findElementType, collectNestedTypeArguments, parseType, replaceASelfTypeWithTheEnclosingType, stripATypeParameter } from "../../../../../inputs/source/text/TypeText.mjs";
import { isInMemoryType, doesSomeTypeLeaveMemory } from "../calls/InMemoryCalls.mjs";
import { escapeForAPattern } from "../../../../../inputs/source/text/PatternText.mjs";
import { listLinesSpannedBy } from "../../../../calls/SourceLayout.mjs";
import { findCallsOnLine } from "../calls/CallReading.mjs";
import { getOrReadAndRemember, getOrReadGuardingReentry } from "../../../../../../collections/memos.mjs";
import { findTypesEnclosingTheSpanInnermostFirst } from "../../../../calls/CallGraph.mjs";

const NO_TYPE_ARGUMENT = () => "";

const UNTYPED_CHAIN = Object.freeze({ text: "", file: undefined, approximate: false });

const originFormsByKeyMap = new Map();

const readOriginForms = (name, own) => {
  const key = `${own}\u0000${name}`;
  if (!originFormsByKeyMap.has(key)) {
    const word = escapeForAPattern(name);
    const target = own ? `(?:this|self)\\s*\\.\\s*${word}|@${word}` : `(?<![\\w$.@])${word}`;
    originFormsByKeyMap.set(key, {
      looped: new RegExp(`\\bfor\\s*(?:await\\s*)?\\(?\\s*(?:(?:const|let|var|val|final)\\s+)?(?:[\\w$.<>?]+\\s+)?(?:[\\[{(][^\\]})]*(?<![\\w$])${word}(?![\\w$])[^\\]})]*[\\]})]|(?:[\\w$]+\\s*,\\s*)*${word}(?:\\s*,\\s*[\\w$]+)*)\\s*(?:\\bof\\b|\\bin\\b|:=\\s*range\\b|:(?!:))\\s*(.+?)\\)?\\s*[{:]?\\s*$`),
      destructured: new RegExp(`(?:const|let|var|val)\\s*[{\\[(]([^}\\])]*)[}\\])]\\s*(?::[^=]+)?=\\s*(.+)$`),
      assigned: new RegExp(`(?:^|[^\\w$.])(?:(?:const|let|var|val|final|auto)\\s+)?(?:[\\w$.<>\\[\\],?]+\\s+)?(?:${target})\\s*(?::\\s*[^=;]+)?:?(?<![=!<>+\\-*/|&%^])=(?![=>])\\s*(.+)$`),
    });
  }
  return originFormsByKeyMap.get(key);
};

function findReceiverExpressionBefore(text) {
  let at = text.length - 1;
  const skipSpace = () => { while (at >= 0 && /\s/.test(text[at])) at--; };
  skipSpace();
  if (/(?:^|[^\w$])async$/.test(text.slice(0, at + 1))) { at -= 5; skipSpace(); }
  if (!/[\w$]/.test(text[at] || "")) {
    let depth = 0;
    for (; at >= 0; at--) {
      const character = text[at];
      if (")]}".includes(character)) depth++;
      else if ("([{".includes(character)) { if (depth === 0) break; depth--; }
      else if (character === ";" && depth === 0) return "";
    }
    if (at < 0 || text[at] !== "(") return "";
    at--;
    skipSpace();
  }
  const calleeEnd = at + 1;
  while (at >= 0 && /[\w$]/.test(text[at])) at--;
  if (at + 1 === calleeEnd) return "";
  skipSpace();
  if (text[at] !== ".") return "";
  at--;
  if (text[at] === "?") at--;
  const end = at + 1;
  while (at >= 0) {
    skipSpace();
    if (text[at] === ")" || text[at] === "]") {
      const opening = text[at] === ")" ? "(" : "[";
      const closing = text[at];
      let depth = 0;
      for (; at >= 0; at--) {
        if (text[at] === closing) depth++;
        else if (text[at] === opening && --depth === 0) break;
      }
      at--;
      skipSpace();
    }
    const wordEnd = at;
    while (at >= 0 && /[\w$]/.test(text[at])) at--;
    if (at === wordEnd) return "";
    const wordStart = at + 1;
    skipSpace();
    if (text[at] === ".") {
      at--;
      if (text[at] === "?") at--;
      continue;
    }
    return text.slice(wordStart, end).trim();
  }
  return "";
}

const STATEMENT_END_PATTERN = /[;{}]\s*$/;

function findStatementStart(code, index, first) {
  let at = index;
  while (at > first && !STATEMENT_END_PATTERN.test(code[at - 1] || "")) at--;
  return at;
}

const NOT_TYPED = Object.freeze({ text: "", file: null });

const findCallFromItsText = (text, diffDriver) => {
  const calls = findCallsOnLine(`${text}()`, diffDriver);
  return calls.length ? calls[calls.length - 1] : null;
};

const isADottedCall = call => call.form === CALL_FORMS.DOTTED;

const findElementTypesOfAnInMemoryContainer = (text, diffDriver) => {
  const type = parseType(text);
  if (!type || !isInMemoryType(type, diffDriver)) return [];
  const found = collectNestedTypeArguments(text);
  return doesSomeTypeLeaveMemory(found, diffDriver) ? found : [];
};

const DESTRUCTURING_HINT_PATTERN = /[{[(][^=]*=/;
const DESTRUCTURING_DECLARATION_START_PATTERN = /^.*?(?:const|let|var|val)\s*/;
const ELEMENT_PATTERN_OPENING_PATTERN = /^\s*\[|\(/;

const bindsInThePattern = (pattern, name) => new RegExp(`(?<![\\w$:])${escapeForAPattern(name)}(?![\\w$])`).test(pattern);

const yieldsAnElement = declaration => ELEMENT_PATTERN_OPENING_PATTERN.test(declaration.replace(DESTRUCTURING_DECLARATION_START_PATTERN, ""));

const findTheOriginBoundInADestructuring = (destructured, name) => (bindsInThePattern(destructured[1], name)
  ? { expression: destructured[2], element: yieldsAnElement(destructured[0]) }
  : null);

export const ReceiverTyping = {
  typeTheStartOfAPath(method, [root, ...rest], index) {
    if (!WORDS_FOR_THE_ENCLOSING_TYPE.has(root)) return { typed: this.readRememberedDeclaredType(method, root, "", index), fields: rest };
    if (!rest.length) return { typed: { text: method.enclosingTypeName, file: method.file }, fields: rest };
    return { typed: this.readRememberedDeclaredType(method, rest[0], root, index), fields: rest.slice(1) };
  },

  typeThePath(method, path, index) {
    const start = this.typeTheStartOfAPath(method, path, index);
    let typed = start.typed;
    for (const word of start.fields) {
      const read = this.findFieldOfAReceiverTyped(typed, word, method.file);
      if (!read) return NOT_TYPED;
      typed = read.field || NOT_TYPED;
    }
    return typed.text ? typed : NOT_TYPED;
  },

  findMemberTyped(result, name) {
    const read = this.findFieldOfAReceiverTyped(result, name, result.file);
    return read ? read.field : null;
  },

  findFieldOfAReceiverTyped(typed, name, file) {
    const type = parseType(typed.text);
    const typeDeclarations = type ? this.findDeclarationsOfType(type, typed.file || file) : [];
    return typeDeclarations.length ? { field: this.findRememberedFieldType(type.simple, name, this.fileByPathMap.get(typeDeclarations[0].path)) } : null;
  },

  readDeclaredTypeText(method, name, qualifier, index) {
    return this.readRememberedDeclaredType(method, name, qualifier, index).text;
  },

  readRememberedDeclaredType(method, name, qualifier, index) {
    if (!name || name === ")") return NOT_TYPED;
    return getOrReadGuardingReentry(this.declaredTypeByMethodAndNameMap, `${method.id}\u0000${qualifier}\u0000${name}`, NOT_TYPED, () => {
      const found = this.findDeclaredType(method, name, qualifier, index);
      return found && found.text ? found : NOT_TYPED;
    });
  },

  findDeclaredType(method, name, qualifier, index) {
    const ownField = name.startsWith("@") || WORDS_FOR_THE_ENCLOSING_TYPE.has(qualifier);
    if (ownField) return this.findRememberedFieldType(method.enclosingTypeName, name, method.file) || this.findRememberedFileLevelType(method.file, name);
    if (namesAQualifier(qualifier)) {
      const outer = this.readRememberedDeclaredType(method, qualifier, "", index);
      const read = this.findFieldOfAReceiverTyped(outer, name, method.file);
      if (read) return read.field;
      return parseType(outer.text) ? null : this.findTypeInAnImportedModule(method.file, qualifier, name);
    }
    const lines = /^[A-Za-z_$][\w$]*$/.test(name) ? this.findLinesOfMethodHolding(method, name) : this.listLinesOfMethod(method);
    const inMethod = this.findTypedInLines(method.file, lines, name, method, false);
    if (inMethod && inMethod.text) return inMethod;
    const outer = inMethod ? null : (method.enclosingTypeName && this.findRememberedFieldType(method.enclosingTypeName, name, method.file)) || this.findRememberedFileLevelType(method.file, name);
    if (outer) return outer;
    const element = this.inferTheElementTypeOf(method, name, index);
    if (element) return element;
    return inMethod ? null : this.findTypedInLines(method.file, lines, name, method, true);
  },

  inferTheElementTypeOf(method, name, index) {
    const possibleTypes = method.file ? this.inferElementTypesOfTheVariable(method, name, index) : [];
    return possibleTypes.length === 1 && !possibleTypes.approximate ? { text: possibleTypes[0], file: possibleTypes.file || method.file } : null;
  },

  findTypeInAnImportedModule(file, word, name) {
    if (!file.imports(word)) return null;
    const declared = this.findImportedDeclaration(file, word);
    if (!declared || declared.kind !== "module") return null;
    for (const file of declared.files) {
      const typed = this.findRememberedFileLevelType(file, name);
      if (typed) return typed;
    }
    return null;
  },

  findTargetReturning(targets, position, resolveTheTypeArgumentReturnedBy = NO_TYPE_ARGUMENT) {
    for (const target of targets) {
      const targetMethod = this.methods[target];
      const returned = targetMethod.returns ? targetMethod.returns[position] || "" : "";
      if (returned) return { targetMethod, returned };
      const argument = resolveTheTypeArgumentReturnedBy(targetMethod);
      if (argument) return { targetMethod, argument };
    }
    return null;
  },

  readTypeOfAConstructedResult(resolution, file, namedType = "") {
    return { text: resolution.constructedType || namedType, file: resolution.typeFile || file };
  },

  findTypeOfACallResult(resolution, position, file, resolveTheTypeArgumentReturnedBy = NO_TYPE_ARGUMENT) {
    if (resolution.constructedType) return this.readTypeOfAConstructedResult(resolution, file);
    const found = this.findTargetReturning(resolution.targets, position, resolveTheTypeArgumentReturnedBy);
    if (!found) return null;
    if (found.argument) return { text: found.argument, file: resolution.typeFile || file };
    return { text: replaceASelfTypeWithTheEnclosingType(found.returned, found.targetMethod.enclosingTypeName), file: found.targetMethod.file };
  },

  findTypedInLines(file, indexes, name, context, withAssignments = true) {
    const found = findDeclarationIn(file.code, indexes, name, file.diffDriver, withAssignments);
    if (!found) return null;
    const typed = this.typeTheDeclaration(file, found, context);
    return { text: stripATypeParameter(typed.text, this.collectTypeParametersAtTheLine(file, found.index)), file: typed.file };
  },

  typeTheDeclaration(file, found, context) {
    const at = context || this.getOrAddContext(file, "");
    if (found.call) {
      const byCall = this.typeTheCall(at, found.call, found.position || 0, found.index);
      if (byCall.text) return byCall;
    }
    if (found.type) return { text: found.type, file };
    if (found.alias) {
      const aliased = this.typeThroughTheAlias(file, found, context);
      if (aliased.text) return { text: aliased.text, file: aliased.file || file };
    }
    if (found.iteratedExpression) {
      const iterableType = this.typeTheExpression(at, found.iteratedExpression, found.index);
      return { text: iterableType.text ? this.findElementTypeText({ file: iterableType.file || file }, iterableType.text) : "", file: iterableType.file || file };
    }
    return { text: "", file };
  },

  typeThroughTheAlias(file, found, context) {
    const enclosingMethod = this.findMethodHoldingTheLine(file, found.index);
    if (!enclosingMethod || enclosingMethod === context || WORDS_FOR_THE_ENCLOSING_TYPE.has(found.alias)) return NOT_TYPED;
    return this.readRememberedDeclaredType(enclosingMethod, found.alias, "", found.index);
  },

  typeTheCall(context, text, position, index) {
    const call = findCallFromItsText(text, context.file.diffDriver);
    if (!call) return { text: "", file: context.file };
    const resolution = isADottedCall(call) ? this.resolveDottedCall(context, index, call) : this.resolveBareCall(context, call);
    return this.findTypeOfACallResult(resolution, position, context.file) || { text: "", file: context.file };
  },

  typeTheExpression(context, text, index) {
    const expression = text.trim().replace(/^[&*]+/, "").replace(/[{:]\s*$/, "").trim();
    const called = /^([\w$.]+)\s*\(.*\)$/.exec(expression);
    if (called) return this.typeTheCall(context, called[1], 0, index);
    const member = /^([\w$]+)\.([\w$]+)$/.exec(expression);
    if (member) return this.readRememberedDeclaredType(context, member[2], member[1], index);
    return /^[\w$]+$/.test(expression) ? this.readRememberedDeclaredType(context, expression, "", index) : NOT_TYPED;
  },

  findElementTypeText(context, text) {
    const element = findElementType(text);
    if (element) return element;
    const type = parseType(text);
    const typeDeclaration = type ? this.findDeclarationsOfType(type, context.file).find(declared => declared.underlying) : null;
    return typeDeclaration ? findElementType(typeDeclaration.underlying) : "";
  },

  readFieldTypeText(typeName, name, file) {
    const typed = this.findRememberedFieldType(typeName, name, file);
    return typed ? typed.text : "";
  },

  findRememberedFieldType(typeName, name, file) {
    if (!typeName) return null;
    return getOrReadGuardingReentry(this.fieldTypeByEnclosingTypeAndNameMap, `${typeName}\u0000${file ? file.folder : ""}\u0000${name}`, null, () => this.findFieldType(typeName, name, file));
  },

  findFieldType(typeName, name, file) {
    const typeDeclarations = this.findTypesNamed(typeName, file ? file.path : "", file ? file.folder : "", file);
    for (const typeDeclaration of typeDeclarations) {
      const declaringFile = this.fileByPathMap.get(typeDeclaration.path);
      if (!declaringFile) continue;
      const typed = this.findTypedInLines(declaringFile, listLinesSpannedBy(typeDeclaration), name, this.getOrAddContext(declaringFile, typeName));
      if (typed && typed.text) return typed;
    }
    return this.findFieldTypeOfRelatives(typeName, name, typeDeclarations);
  },

  findFieldTypeOfRelatives(typeName, name, typeDeclarations) {
    for (const typeDeclaration of typeDeclarations) {
      const declaringFile = this.fileByPathMap.get(typeDeclaration.path);
      for (const supertype of typeDeclaration.supertypes) {
        const type = parseType(supertype);
        if (!type || type.simple === typeName) continue;
        const inside = this.findDeclarationsOfType(type, declaringFile);
        const found = inside.length ? this.findRememberedFieldType(type.simple, name, this.fileByPathMap.get(inside[0].path)) : null;
        if (found) return found;
      }
      const enclosing = findTypesEnclosingTheSpanInnermostFirst(this.types, typeDeclaration.path, { from: typeDeclaration.line, to: typeDeclaration.to });
      for (const outer of enclosing) {
        const found = this.findRememberedFieldType(outer.name, name, declaringFile);
        if (found) return found;
      }
    }
    return null;
  },

  readFileLevelTypeText(file, name) {
    const typed = this.findRememberedFileLevelType(file, name);
    return typed ? typed.text : "";
  },

  findRememberedFileLevelType(file, name) {
    if (!this.fileLevelTypeByNameMap) this.fileLevelTypeByNameMap = new Map();
    return getOrReadGuardingReentry(this.fileLevelTypeByNameMap, `${file.path}\u0000${name}`, null, () => this.findFileLevelType(file, name));
  },

  findFileLevelType(file, name) {
    const own = this.findTypedAtTheLevelOfTheFile(file, name);
    if (own) return own;
    return this.sharesFileLevelValuesWithItsFolder(file) ? this.findTypedAtTheLevelOfTheFolder(file, name) : null;
  },

  findTypedAtTheLevelOfTheFile(file, name) {
    const typed = this.findTypedInLines(file, this.getOrReadLevelIndexes(file), name, this.getOrAddContext(file, ""));
    return typed && typed.text ? typed : null;
  },

  sharesFileLevelValuesWithItsFolder(file) {
    return readPackageScope(file.diffDriver).fileLevelValuesShareTheFolder;
  },

  findTypedAtTheLevelOfTheFolder(file, name) {
    for (const other of this.filesByFolderMap.get(file.folder) || []) {
      if (other === file) continue;
      const found = this.findTypedAtTheLevelOfTheFile(other, name);
      if (found) return found;
    }
    return null;
  },

  isAnInferableVariable(method, name) {
    return Boolean(name) && !WORDS_FOR_THE_ENCLOSING_TYPE.has(name) && !this.isADeclaredParameterOf(method, name);
  },

  inferElementTypesOfTheVariable(method, name, index) {
    if (!this.isAnInferableVariable(method, name)) return [];
    if (!this.elementTypesByVariableMap) this.elementTypesByVariableMap = new Map();
    return getOrReadGuardingReentry(this.elementTypesByVariableMap, `${method.id}\u0000${name}`, [], () => this.readElementTypesFromTheOrigin(method, name, index));
  },

  readElementTypesFromTheOrigin(method, name, index) {
    const origin = this.findRememberedOrigin(method, name, index);
    const chain = origin && origin.element ? this.typeTheChainText(method, origin.expression, origin.index) : UNTYPED_CHAIN;
    const typeParameters = this.collectTypeParametersAtTheLine(method.file, index);
    const found = chain.text ? this.findElementTypesOfAType({ file: chain.file || method.file }, chain.text).filter(text => stripATypeParameter(text, typeParameters)) : [];
    if (chain.approximate || found.length > 1) found.approximate = chain.approximate;
    found.file = chain.file || method.file;
    return found;
  },

  findElementTypesOfAType(context, text) {
    const single = this.findElementTypeText(context, text);
    if (single) return [single];
    return findElementTypesOfAnInMemoryContainer(text, context.file.diffDriver);
  },

  typeTheChainRoot(context, text, index) {
    const rootFound = /^([A-Za-z_$][\w$]*)\s*(\()?/.exec(text);
    if (!rootFound) return null;
    const root = rootFound[1];
    if (rootFound[2]) {
      const closing = closingParenthesisOf(text, rootFound[0].length - 1);
      if (closing < 0) return null;
      const called = this.typeTheCall(context, root, 0, index);
      return { type: called.text, home: called.file, rest: text.slice(closing + 1) };
    }
    if (WORDS_FOR_THE_ENCLOSING_TYPE.has(root)) return { type: context.enclosingTypeName, home: context.file, rest: text.slice(root.length) };
    const typed = this.readRememberedDeclaredType(context, root, "", index);
    return { type: typed.text || (this.findTypesInScope(context, root).length ? root : ""), home: typed.file || context.file, rest: text.slice(root.length) };
  },

  typeTheChainText(context, expression, index) {
    const typedRoot = this.typeTheChainRoot(context, String(expression || "").trim().replace(/^(?:(?:await|new|yield)\s+)+/, ""), index);
    if (!typedRoot) return UNTYPED_CHAIN;
    let { type, home, rest: text } = typedRoot;
    let approximate = false;
    const createTypedSoFar = typeText => ({ text: typeText, file: home, approximate });
    while (type) {
      const chainStep = /^\s*[?!]*\.\s*([A-Za-z_$][\w$]*)\s*(\()?/.exec(text);
      if (!chainStep) break;
      const called = Boolean(chainStep[2]);
      let after = chainStep[0].length;
      let empty = true;
      if (called) {
        const closing = closingParenthesisOf(text, after - 1);
        if (closing < 0) return createTypedSoFar("");
        empty = !text.slice(after, closing).trim();
        after = closing + 1;
      }
      text = text.slice(after);
      const parsedType = parseType(type);
      if (!parsedType) return createTypedSoFar("");
      if (isInMemoryType(parsedType, context.file.diffDriver)) {
        if (!called) return createTypedSoFar("");
        if (!empty) approximate = true;
        continue;
      }
      ({ text: type, file: home } = this.findTypeGivenByAChainStep(parsedType, home || context.file, { member: chainStep[1], called, empty }, home));
    }
    return createTypedSoFar(/^[\s\])}:;{]*$/.test(text) ? type : "");
  },

  findTypeGivenByAChainStep(type, searchedFile, { member, called, empty }, home) {
    const typeDeclarations = this.findDeclarationsOfType(type, searchedFile);
    if (!typeDeclarations.length) return { text: "", file: home };
    const declaringFile = this.fileByPathMap.get(typeDeclarations[0].path);
    const declared = called ? this.findACallTargetDeclaringItsReturn(type, member, typeDeclarations[0].folder) : null;
    if (declared) return { text: replaceASelfTypeWithTheEnclosingType(declared.returns[0], declared.enclosingTypeName), file: declared.file };
    const field = !called || empty ? this.findRememberedFieldType(type.simple, member, declaringFile) : null;
    return field || { text: "", file: home };
  },

  findACallTargetDeclaringItsReturn(type, member, folder) {
    return this.findCappedCallTargetsInTypeAndImplementations(type.simple, member, folder).targets.map(id => this.methods[id]).find(target => target.returns && target.returns[0]);
  },

  findRememberedOrigin(method, name, index) {
    if (!this.originByMethodNameAndIndexMap) this.originByMethodNameAndIndexMap = new Map();
    return getOrReadAndRemember(this.originByMethodNameAndIndexMap, `${method.id}\u0000${name}\u0000${index}`, () => this.findOrigin(method, name, index));
  },

  findOrigin(method, name, index) {
    const file = method.file;
    const inMethod = /^[A-Za-z_$][\w$]*$/.test(name) ? this.findLinesOfMethodHolding(method, name) : this.listLinesOfMethod(method);
    const places = [inMethod.filter(at => at <= index).reverse(), this.findFieldLines(method), this.getOrReadLevelIndexes(file)];
    for (const indexes of places) {
      for (const at of indexes) {
        if (!(file.code[at] || "").includes(name)) continue;
        const found = this.findOriginOfTheNameAtTheLine(method, at, name);
        if (found) return { index: at, ...found };
      }
    }
    return null;
  },

  findOriginOfTheNameAtTheLine(method, at, name) {
    return this.findOriginAtTheLine(method, at, name, false);
  },

  findOriginOfTheOwnFieldAtTheLine(method, at, name) {
    return this.findOriginAtTheLine(method, at, name, true);
  },

  findOriginAtTheLine(method, at, name, own) {
    const file = method.file;
    const code = file.code[at] || "";
    if (!code.includes(name)) return null;
    const forms = readOriginForms(name, own);
    const looped = own || !/\bfor\b/.test(code) ? null : forms.looped.exec(code);
    if (looped) return { expression: looped[1], element: true };
    const destructured = own || !DESTRUCTURING_HINT_PATTERN.test(code) ? null : forms.destructured.exec(code);
    const fromADestructuring = destructured ? findTheOriginBoundInADestructuring(destructured, name) : null;
    if (fromADestructuring) return fromADestructuring;
    const assigned = code.includes("=") ? forms.assigned.exec(code) : null;
    if (assigned && assigned[1].trim()) return { expression: assigned[1] };
    if (own || !LAMBDA_HINT_PATTERN.test(code)) return null;
    const lambda = readLambdaParameterForm(name).exec(code);
    if (!lambda) return null;
    const from = findStatementStart(file.code, at, method.line - 1);
    const receiver = findReceiverExpressionBefore([...file.code.slice(from, at), code.slice(0, lambda.index)].join("\n"));
    return receiver ? { expression: receiver, element: true } : null;
  },

};
