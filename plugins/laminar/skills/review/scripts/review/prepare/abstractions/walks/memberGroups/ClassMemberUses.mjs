import { ABSTRACTION_KINDS, CALL_FORMS, createCodeLines, findDeclarationInLine, findDriver, findParameterTextAfterTheName, listLinesSpannedBy, MethodScope, readParameterTextOfTheHead, readParameterNamesOfAList, readDeclarations, readReceiverWord, readSignature, readVisibilityOfDeclaration, RELATION_KINDS, Scale, SourceText, VISIBILITIES, WORDS_FOR_THE_ENCLOSING_TYPE } from "../../../../../code/index.mjs";
import { appendTo } from "../../../../../collections/groupedLists.mjs";
import { CONSTRUCTOR_NAMES } from "../RebuiltValuesWalk.mjs";

const FIELD_KINDS = new Set([RELATION_KINDS.READS_FIELD, RELATION_KINDS.WRITES_FIELD]);

const A_TYPE_NAME_PATTERN = /^[A-Z]/;

const TYPE_NAME_IN_A_TEXT_PATTERN = /(?<![\w$.])[A-Z][\w$]*(?:\.[A-Z][\w$]*)*/g;

const ANNOTATION_PATTERN = /@[\w$.]+(?:\s*\([^()]*\))?/g;

const MAX_HEAD_LINES = 12;

const RESULT_AFTER_THE_PARAMETERS_PATTERN = /^\s*(?:->|:)\s*([^{=]+?)\s*[:{=]?\s*$/;

const readLastSegment = name => String(name || "").split(/\.|::|->/).pop().replace(/^#/, "");

const isInsideSpan = (line, span) => line >= span.from && line <= span.to;

const sortedOnce = names => [...new Set(names)].sort();

const isAConstructorOf = (method, className) => CONSTRUCTOR_NAMES.has(method.name) || (Boolean(className) && method.name === className);

const createScopeReading = () => Object.assign(Object.create(MethodScope), {
  localByMethodAndNameMap: new Map(),
  listLinesOfMethod: listLinesSpannedBy,
  add: appendTo,
});

export class ClassMemberUses {
  constructor(codeGraph, callGraph, readFileLines) {
    this.codeGraph = codeGraph;
    this.callGraph = callGraph;
    this.readFileLines = readFileLines;
    this.codeByPathMap = new Map();
    this.declarationsByPathMap = new Map();
    this.scope = createScopeReading();
  }

  readCode(filePath) {
    if (!this.codeByPathMap.has(filePath)) this.codeByPathMap.set(filePath, createCodeLines(this.readFileLines(filePath) || [], filePath).code);
    return this.codeByPathMap.get(filePath);
  }

  readDeclarationsOf(filePath) {
    if (!this.declarationsByPathMap.has(filePath)) {
      const driver = findDriver(filePath);
      const lines = this.readFileLines(filePath);
      this.declarationsByPathMap.set(filePath, driver && lines ? readDeclarations(SourceText.createForFile(filePath, lines, driver)) : []);
    }
    return this.declarationsByPathMap.get(filePath);
  }

  isExposed(method) {
    const driver = findDriver(method.path);
    const declaration = this.readDeclarationsOf(method.path).find(tag => tag.line === method.line && tag.scale === Scale.METHOD.name && tag.name === method.name);
    return !driver || !declaration || readVisibilityOfDeclaration(driver, declaration, method.name) !== VISIBILITIES.PRIVATE;
  }

  readDiffDriver(filePath) {
    const driver = findDriver(filePath);
    return driver ? driver.diffDriver : "";
  }

  readClass(classAbstraction) {
    const isAFile = classAbstraction.kind === ABSTRACTION_KINDS.FILE;
    const className = isAFile ? "" : classAbstraction.name;
    const span = { from: classAbstraction.lines.from, to: classAbstraction.lines.to };
    const ownMethods = this.listOwnMethods(classAbstraction.path, className, span);
    const methods = ownMethods.filter(method => !isAConstructorOf(method, className));
    const constructors = ownMethods.filter(method => isAConstructorOf(method, className));
    const selfWords = this.readSelfWords(classAbstraction.path, methods, className);
    const methodNames = new Set(ownMethods.map(method => method.name));
    const fields = this.findFields({ path: classAbstraction.path, span, isAFile, ownMethods, constructors, selfWords, methodNames });
    const fieldByNameMap = new Map(fields.map(field => [field.name, field]));
    const methodUses = methods.map(method => this.readMethodUses(method, { className, fieldByNameMap, selfWords, methodNames }));
    return {
      name: classAbstraction.name,
      path: classAbstraction.path,
      from: span.from,
      to: span.to,
      isAFile,
      fields,
      methods: methodUses.map(method => (method.exposed ? { ...method, types: this.addTheNestedTypes(method.types) } : method)),
    };
  }

  listOwnMethods(filePath, className, span) {
    return (this.callGraph.methodsByPathMap.get(filePath) || [])
      .filter(method => (className ? method.enclosingTypeName === className : !method.enclosingTypeName && isInsideSpan(method.line, span)))
      .sort((left, right) => left.line - right.line);
  }

  readSelfWords(filePath, methods, className) {
    const lines = this.readFileLines(filePath) || [];
    const receiverWords = methods.map(method => readReceiverWord(lines, method, this.readDiffDriver(filePath))).filter(Boolean);
    return new Set([...WORDS_FOR_THE_ENCLOSING_TYPE, ...receiverWords, ...(className ? [className] : [])]);
  }

  readMethodSpans(methods) {
    return methods.map(method => ({ from: method.line, to: method.to }));
  }

  findFields({ path: filePath, span, isAFile, ownMethods, constructors, selfWords, methodNames }) {
    const methodSpans = this.readMethodSpans(ownMethods.filter(method => !constructors.includes(method)));
    const outsideEveryMethod = line => !methodSpans.some(methodSpan => isInsideSpan(line, methodSpan));
    const lineByNameMap = new Map();
    const remember = (name, line) => { if (name && !methodNames.has(name) && !lineByNameMap.has(name)) lineByNameMap.set(name, line); };
    const declared = this.codeGraph.findAbstractionsDeclaredAt(filePath, span.from).find(abstraction => abstraction.scale.name === Scale.CLASS.name);
    if (declared && !isAFile) for (const member of declared.members || []) remember(member.name, member.line);
    for (const variable of this.codeGraph.findAbstractionsIn(filePath)) {
      if (variable.scale.name !== Scale.VARIABLE.name || variable.kind === ABSTRACTION_KINDS.LOCAL || !variable.place) continue;
      const line = variable.place.startLine;
      if (isInsideSpan(line, span) && outsideEveryMethod(line) && (isAFile ? this.liesOutsideEveryType(filePath, line) : true)) remember(variable.name, line);
    }
    if (!isAFile) {
      for (const reference of this.codeGraph.findWalkedReferencesIn(filePath)) {
        const line = reference.place.startLine;
        if (FIELD_KINDS.has(reference.kind) && selfWords.has(reference.receiver) && (isInsideSpan(line, span) || ownMethods.some(method => isInsideSpan(line, { from: method.line, to: method.to })))) remember(reference.name, line);
      }
    }
    return [...lineByNameMap].map(([name, line]) => this.describeField(filePath, name, line, constructors)).sort((left, right) => left.line - right.line);
  }

  liesOutsideEveryType(filePath, line) {
    return !(this.callGraph.types || []).some(type => type.path === filePath && isInsideSpan(line, { from: type.line, to: type.to }));
  }

  describeField(filePath, name, line, constructors) {
    const lines = this.readFileLines(filePath) || [];
    const typeText = this.readFieldTypeText(filePath, name, line, constructors);
    return { name, line, text: String(lines[line - 1] ?? "").trim(), typeText, typeNames: this.readTypeKeys(typeText) };
  }

  readFieldTypeText(filePath, name, line, constructors) {
    const diffDriver = this.readDiffDriver(filePath);
    const found = findDeclarationInLine(String(this.readCode(filePath)[line - 1] || ""), name, diffDriver);
    if (found && found.type) return found.type;
    const alias = found && found.alias;
    const constructor = constructors.find(method => isInsideSpan(line, { from: method.line, to: method.to }));
    if (!alias || !constructor) return "";
    const parameterText = readParameterTextOfTheHead(this.readFileLines(filePath) || [], constructor, Math.max(constructor.to, constructor.line));
    const fromParameter = parameterText ? findDeclarationInLine(parameterText, alias, diffDriver) : null;
    return fromParameter && fromParameter.type ? fromParameter.type : "";
  }

  readParameterNames(method) {
    const driver = findDriver(method.path);
    const text = readParameterTextOfTheHead(this.readFileLines(method.path) || [], method, Math.max(method.to, method.line));
    return driver && text ? readParameterNamesOfAList(text, driver) : [];
  }

  createScopedMethod(method) {
    return { id: `${method.path}:${method.line}`, line: method.line, to: method.to, parameterNames: this.readParameterNames(method), file: { code: this.readCode(method.path), diffDriver: this.readDiffDriver(method.path) } };
  }

  readFieldUses(method, { fieldByNameMap, selfWords }) {
    const scoped = this.createScopedMethod(method);
    const span = { from: method.line, to: method.to };
    const reads = [];
    const writes = [];
    for (const reference of this.codeGraph.findWalkedReferencesIn(method.path)) {
      const line = reference.place.startLine;
      if (!FIELD_KINDS.has(reference.kind) || !isInsideSpan(line, span) || !fieldByNameMap.has(reference.name)) continue;
      const throughTheClass = selfWords.has(reference.receiver);
      if (!throughTheClass && (reference.receiver || this.scope.isAValueOfTheMethod(scoped, reference.name))) continue;
      (reference.kind === RELATION_KINDS.WRITES_FIELD ? writes : reads).push(reference.name);
    }
    return { reads: sortedOnce(reads), writes: sortedOnce(writes) };
  }

  readOwnCallees(method, { methodNames, selfWords }) {
    const calls = [];
    const ownTargets = new Set((this.callGraph.methodsByPathMap.get(method.path) || []).filter(other => methodNames.has(other.name)).map(other => other.id));
    for (const call of method.calls || []) {
      const resolvedToOwn = call.targets.some(target => ownTargets.has(target));
      const namedOwn = !call.targets.length && methodNames.has(call.callee) && (call.form === CALL_FORMS.BARE || selfWords.has(call.receiver));
      if ((resolvedToOwn || namedOwn) && call.callee !== method.name) calls.push({ callee: call.callee, line: call.line });
    }
    for (const reference of this.codeGraph.findWalkedReferencesIn(method.path)) {
      const line = reference.place.startLine;
      if (line <= method.line || line > method.to || reference.kind === RELATION_KINDS.CALLS) continue;
      if (methodNames.has(reference.name) && reference.name !== method.name && (!reference.receiver || selfWords.has(reference.receiver))) calls.push({ callee: reference.name, line });
    }
    return calls;
  }

  readCalledTypes(method, { className, fieldByNameMap, methodNames }) {
    const names = [];
    for (const call of method.calls || []) {
      for (const target of call.targets.map(id => this.callGraph.methods[id]).filter(Boolean)) {
        if (target.enclosingTypeName && this.isDeclaredInTheRepository(target.enclosingTypeName)) names.push(target.enclosingTypeName);
      }
      const receiverField = fieldByNameMap.get(readLastSegment(call.receiver));
      if (receiverField) names.push(...receiverField.typeNames);
      const receiverNamesAType = A_TYPE_NAME_PATTERN.test(call.receiver || "");
      if (call.form === CALL_FORMS.NEW) names.push(...this.readTypeKeys(receiverNamesAType ? `${call.receiver}.${call.callee}` : call.callee));
      else if (call.form === CALL_FORMS.BARE && A_TYPE_NAME_PATTERN.test(call.callee) && !methodNames.has(call.callee)) names.push(...this.readTypeKeys(call.callee));
      else if (receiverNamesAType) names.push(...this.readTypeKeys(call.receiver));
    }
    return sortedOnce(names.filter(name => name && name !== className));
  }

  isDeclaredInTheRepository(typeName) {
    return (this.callGraph.types || []).some(type => type.name === typeName);
  }

  readTypeKeys(text) {
    const qualifiedNames = String(text || "").replace(ANNOTATION_PATTERN, " ").match(TYPE_NAME_IN_A_TEXT_PATTERN) || [];
    return sortedOnce(qualifiedNames.filter(qualified => this.isDeclaredInTheRepository(qualified.split(".")[0])));
  }

  listNestedTypes(typeKey) {
    const outerTypes = (this.callGraph.types || []).filter(type => type.name === readLastSegment(typeKey));
    return (this.callGraph.types || []).filter(inner => outerTypes.some(outer => inner !== outer && inner.path === outer.path && inner.line > outer.line && inner.to <= outer.to));
  }

  addTheNestedTypes(typeKeys) {
    return sortedOnce([...typeKeys, ...typeKeys.flatMap(typeKey => this.listNestedTypes(typeKey).flatMap(inner => [inner.name, `${typeKey}.${inner.name}`]))]);
  }

  readResultTypeNamesAfterTheParameters(method) {
    const lines = this.readFileLines(method.path) || [];
    const head = lines.slice(method.line - 1, Math.min(method.to, method.line - 1 + MAX_HEAD_LINES)).join("\n");
    const parameterText = findParameterTextAfterTheName(head, method.name);
    if (parameterText === null) return [];
    const opening = head.indexOf(`(${parameterText})`);
    const after = opening < 0 ? "" : head.slice(opening + parameterText.length + 2).split(/[{;\n]/)[0];
    const found = RESULT_AFTER_THE_PARAMETERS_PATTERN.exec(after);
    return found ? this.readTypeKeys(found[1]) : [];
  }

  readMethodUses(method, context) {
    const lines = this.readFileLines(method.path) || [];
    const signature = readSignature(lines, method, this.readDiffDriver(method.path));
    const takes = signature.parameters.map(parameter => parameter.typeText);
    const returns = (method.returns || []).filter(Boolean);
    const callsTypes = this.readCalledTypes(method, context);
    const ownCalls = this.readOwnCallees(method, context);
    return {
      id: method.id,
      name: method.name,
      from: method.line,
      to: method.to,
      exposed: this.isExposed(method),
      ...this.readFieldUses(method, context),
      takes,
      returns,
      types: sortedOnce([...[...takes, ...returns].flatMap(text => this.readTypeKeys(text)), ...this.readResultTypeNamesAfterTheParameters(method), ...callsTypes].filter(name => name !== context.className)),
      callsTypes,
      callees: sortedOnce(ownCalls.map(call => call.callee)),
      ownCalls,
    };
  }
}
