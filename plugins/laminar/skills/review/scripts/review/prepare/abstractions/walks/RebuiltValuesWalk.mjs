import { CALL_FORMS, CALL_STATUS, changesTheCode, createCodeLines, findDriver, isGeneratedFile, readLanguageFamily, readParameterNamesOfAList, readParameterTextOfTheHead, readSignature, Scale, WORDS_FOR_THE_ENCLOSING_TYPE } from "../../../../code/index.mjs";
import { MethodCallers } from "../references/MethodCallers.mjs";
import { FileLines, listLinesFromTo } from "../lookups/FileLines.mjs";
import { groupBy } from "../../../../collections/groupedLists.mjs";

export const MAX_SIBLINGS = 3;

export const MAX_REBUILT_METHOD_LINES = 40;

export const MAX_VALUE_TYPE_LINES = 30;

const MAX_HELPER_DEPTH = 3;

const CONSTRUCTOR_NAMES = new Set(["constructor", "__init__", "init", "new", "initialize", "__construct"]);

const BUILDER_NAME_PATTERN = /Builder$/;

const ENCLOSING_TYPE_ACCESS_PATTERN = /(?:\$this\s*->|(?<![\w$.])(?:this|self)\s*(?:\?\.|\.|->))\s*([A-Za-z_$][\w$]*)/g;

const STATUSES_OF_AN_OUTSIDE_CALL = new Set([CALL_STATUS.NO_IMPLEMENTATION, CALL_STATUS.MANY_IMPLEMENTATIONS]);

const A_TYPE_NAME_PATTERN = /^[A-Z]/;

const isAChangedMethod = abstraction => abstraction.scale === Scale.METHOD.name && !abstraction.isTest && Boolean(abstraction.lines)
  && changesTheCode(abstraction.changeKind) && Boolean(findDriver(abstraction.path)) && !CONSTRUCTOR_NAMES.has(abstraction.name) && abstraction.name !== abstraction.enclosingTypeName;

const isAnOperationOfAType = method => Boolean(method.enclosingTypeName) && method.name !== method.enclosingTypeName && !CONSTRUCTOR_NAMES.has(method.name);


const readLastSegment = name => String(name).split(/\.|::/).pop();

const ANNOTATION_OR_MODIFIER_PATTERN = /@[\w$.]+(?:\([^)]*\))?|\b(?:final|readonly|const|mut|ref|in|out|vararg)\s+|&/g;

const OUTER_TYPE_NAME_PATTERN = /[A-Za-z_$][\w$]*(?:(?:\.|::)[A-Za-z_$][\w$]*)*/;

const readOuterTypeName = typeText => readLastSegment((OUTER_TYPE_NAME_PATTERN.exec(String(typeText || "").replace(ANNOTATION_OR_MODIFIER_PATTERN, " ")) || [""])[0]);

const buildWholeNamePattern = name => new RegExp(`(?<![\\w$.])${name.replace(/[$]/g, "\\$")}(?![\\w$])`);

const isNestedIn = (inner, outer) => inner.path === outer.path && inner.line > outer.line && inner.to <= outer.to;

const formatMethodDisplayName = method => `${method.enclosingTypeName}#${method.name}`;

class FamilyRebuiltValuesWalk {
  constructor(repositoryText, testCode, callGraph, references, codeGraph) {
    this.fileLines = new FileLines(repositoryText);
    this.callGraph = callGraph;
    this.codeGraph = codeGraph;
    this.callers = new MethodCallers(repositoryText, testCode, callGraph, references);
    this.typesByPathMap = groupBy(callGraph.types || [], type => type.path);
    this.typesByNameMap = groupBy(callGraph.types || [], type => type.name);
    this.methodsByEnclosingTypeMap = groupBy(callGraph.methods.filter(method => method.enclosingTypeName), method => method.enclosingTypeName);
    this.codeByPathMap = new Map();
  }

  readFileLines(filePath) {
    return this.fileLines.readFileLines(filePath);
  }

  readCode(filePath) {
    if (!this.codeByPathMap.has(filePath)) this.codeByPathMap.set(filePath, createCodeLines(this.readFileLines(filePath), filePath).code);
    return this.codeByPathMap.get(filePath);
  }

  readDiffDriver(filePath) {
    const driver = findDriver(filePath);
    return driver ? driver.diffDriver : "";
  }

  readSignatureOf(method) {
    return readSignature(this.readFileLines(method.path), method, this.readDiffDriver(method.path));
  }

  readParameterNames(method) {
    const driver = findDriver(method.path);
    const text = readParameterTextOfTheHead(this.readFileLines(method.path), method, Math.max(method.to, method.line));
    return driver && text ? readParameterNamesOfAList(text, driver) : [];
  }

  findEnclosingType(method) {
    return (this.typesByPathMap.get(method.path) || []).filter(type => type.name === method.enclosingTypeName && type.line <= method.line && type.to >= method.line)
      .sort((left, right) => right.line - left.line)[0] || null;
  }

  findDeclaredType(name, nearPath) {
    const known = (this.typesByNameMap.get(name) || []).filter(type => !isGeneratedFile(type.path, this.readFileLines(type.path)));
    return known.find(type => type.path === nearPath) || known[0] || null;
  }

  listOwnMethods(enclosingType) {
    return (this.methodsByEnclosingTypeMap.get(enclosingType.name) || []).filter(method => method.path === enclosingType.path && isAnOperationOfAType(method));
  }

  isABuilder(enclosingType) {
    if (BUILDER_NAME_PATTERN.test(enclosingType.name)) return true;
    const ownMethods = this.listOwnMethods(enclosingType);
    const returningItself = ownMethods.filter(method => readLastSegment((method.returns || [])[0] || "") === enclosingType.name);
    return ownMethods.length > 1 && returningItself.length * 2 >= ownMethods.length;
  }

  isWithinTheValueType(type, value) {
    return type.name === value.name || isNestedIn(type, value);
  }

  findValueType(method, enclosingType) {
    const signature = this.readSignatureOf(method);
    const valueName = readOuterTypeName((method.returns || [])[0]);
    if (!valueName || valueName === enclosingType.name || !signature.returnNames.includes(valueName)) return null;
    const parameter = signature.parameters.find(parameter => readOuterTypeName(parameter.typeText) === valueName);
    if (!parameter) return null;
    const value = this.findDeclaredType(valueName, method.path);
    if (!value || isNestedIn(enclosingType, value)) return null;
    return { value, parameterType: parameter.typeText };
  }

  readFieldNames(enclosingType) {
    const known = this.codeGraph.findAbstractionsDeclaredAt(enclosingType.path, enclosingType.line).find(abstraction => abstraction.scale.name === Scale.CLASS.name);
    return known ? known.members.map(member => member.name) : [];
  }

  readBodyCode(method) {
    return this.readCode(method.path).slice(method.line - 1, method.to);
  }

  readsAField(method, enclosingType) {
    const ownMethodNames = new Set(this.listOwnMethods(enclosingType).map(ownMethod => ownMethod.name));
    const parameterNames = new Set(this.readParameterNames(method));
    const code = this.readBodyCode(method);
    const readsThroughTheEnclosingType = code.some(line => [...line.matchAll(ENCLOSING_TYPE_ACCESS_PATTERN)].some(found => !ownMethodNames.has(found[1])));
    if (readsThroughTheEnclosingType) return true;
    const bareFieldPatterns = this.readFieldNames(enclosingType).filter(name => !parameterNames.has(name)).map(buildWholeNamePattern);
    return code.slice(1).some(line => bareFieldPatterns.some(pattern => pattern.test(line)));
  }

  findOwnCallees(method, enclosingType) {
    const ownMethods = this.listOwnMethods(enclosingType);
    const callees = new Map();
    for (const call of method.calls || []) {
      const resolved = call.targets.map(target => this.callGraph.methods[target]).filter(targetMethod => targetMethod && targetMethod.enclosingTypeName === enclosingType.name && targetMethod.path === enclosingType.path);
      const named = call.targets.length || !(call.form === CALL_FORMS.BARE || WORDS_FOR_THE_ENCLOSING_TYPE.has(call.receiver))
        ? [] : ownMethods.filter(ownMethod => ownMethod.name === call.callee);
      for (const callee of [...resolved, ...named]) callees.set(callee.id, callee);
    }
    callees.delete(method.id);
    return [...callees.values()];
  }

  worksOnlyOnItsInputs(method, enclosingType, depth = 0, visited = new Set()) {
    if (visited.has(method.id)) return true;
    visited.add(method.id);
    if (depth > MAX_HELPER_DEPTH || this.readsAField(method, enclosingType)) return false;
    return this.findOwnCallees(method, enclosingType).every(callee => this.worksOnlyOnItsInputs(callee, enclosingType, depth + 1, visited));
  }

  describeOutsideCall(call, value) {
    const targets = call.targets.map(target => this.callGraph.methods[target]).filter(Boolean);
    if (targets.length) {
      const outside = targets.filter(target => !this.isWithinTheValueTypeNamed(target.enclosingTypeName, target.path, value));
      return outside.length ? formatMethodDisplayName(outside[0]) : null;
    }
    if (call.status === CALL_STATUS.IN_MEMORY || call.form === CALL_FORMS.NEW) return null;
    if (A_TYPE_NAME_PATTERN.test(call.receiver)) {
      const receiverType = this.findDeclaredType(readLastSegment(call.receiver), value.path);
      return receiverType && !this.isWithinTheValueType(receiverType, value) ? `${call.receiver}.${call.callee}` : null;
    }
    return STATUSES_OF_AN_OUTSIDE_CALL.has(call.status) ? `${call.receiver ? `${call.receiver}.` : ""}${call.callee}` : null;
  }

  isWithinTheValueTypeNamed(enclosingTypeName, enclosingTypePath, value) {
    const type = (this.typesByPathMap.get(enclosingTypePath) || []).find(declaredType => declaredType.name === enclosingTypeName);
    return Boolean(type) && this.isWithinTheValueType(type, value);
  }

  listCallsOutsideTheValue(method, value) {
    const described = new Map();
    for (const call of method.calls || []) {
      const callee = this.describeOutsideCall(call, value);
      if (callee && !described.has(`${callee}:${call.line}`)) described.set(`${callee}:${call.line}`, { callee, line: call.line });
    }
    return [...described.values()];
  }

  readMethodLines(method) {
    const fileLines = this.readFileLines(method.path);
    const lastShownLine = Math.min(method.to, method.line + MAX_REBUILT_METHOD_LINES - 1, fileLines.length);
    return listLinesFromTo(method.line, lastShownLine).map(line => ({ line, text: String(fileLines[line - 1] ?? "") }));
  }

  readValueTypeLines(value) {
    const known = this.codeGraph.findAbstractionsDeclaredAt(value.path, value.line).find(abstraction => abstraction.scale.name === Scale.CLASS.name);
    const memberLines = known ? known.members.map(member => member.line) : [];
    const childLines = known ? this.codeGraph.listChildren(known).filter(child => child.place && child.scale.name !== Scale.VARIABLE.name).map(child => child.place.startLine) : [];
    return this.fileLines.readUntrimmedLinesInOrder(value.path, [value.line, ...memberLines, ...childLines]).slice(0, MAX_VALUE_TYPE_LINES);
  }

  readCallerPlaces(method) {
    const fileLinesOf = filePath => this.readFileLines(filePath);
    return this.callers.findCallers(method).callers.map(caller => {
      const callingMethod = caller.id === null ? null : this.callGraph.methods[caller.id];
      return {
        id: caller.id,
        displayName: callingMethod ? formatMethodDisplayName(callingMethod) : caller.path,
        path: caller.path,
        line: caller.line,
        text: String(fileLinesOf(caller.path)[caller.line - 1] ?? ""),
      };
    });
  }

  isASiblingShape(siblingMethod, value) {
    return readOuterTypeName((siblingMethod.returns || [])[0]) === value.name
      && this.readSignatureOf(siblingMethod).parameters.some(parameter => readOuterTypeName(parameter.typeText) === value.name);
  }

  findSiblings(method, enclosingType, value, callerPlaces) {
    const siblings = new Map();
    for (const caller of callerPlaces.filter(place => place.id !== null)) {
      for (const callee of this.findOwnCallees(this.callGraph.methods[caller.id], enclosingType)) {
        if (callee.id !== method.id && !siblings.has(callee.id) && this.isASiblingShape(callee, value)) siblings.set(callee.id, callee);
      }
    }
    return [...siblings.values()].slice(0, MAX_SIBLINGS).map(sibling => ({
      displayName: formatMethodDisplayName(sibling),
      path: sibling.path,
      from: sibling.line,
      to: sibling.to,
      callsOutside: this.listCallsOutsideTheValue(sibling, value),
      lines: this.readMethodLines(sibling),
    }));
  }

  findRebuiltValue(abstraction) {
    const method = this.callGraph.findMethodDeclaredAt(abstraction.path, abstraction.lines.from);
    if (!method || !isAnOperationOfAType(method)) return null;
    const enclosingType = this.findEnclosingType(method);
    if (!enclosingType || this.isABuilder(enclosingType)) return null;
    const found = this.findValueType(method, enclosingType);
    if (!found || !this.worksOnlyOnItsInputs(method, enclosingType)) return null;
    const { value, parameterType } = found;
    const callerPlaces = this.readCallerPlaces(method);
    return {
      abstractionIds: [abstraction.id],
      displayName: formatMethodDisplayName(method),
      name: method.name,
      path: method.path,
      from: method.line,
      to: method.to,
      changeKind: abstraction.changeKind,
      parameterType,
      value: { name: value.name, path: value.path, from: value.line, to: value.to, lines: this.readValueTypeLines(value) },
      callsOutside: this.listCallsOutsideTheValue(method, value),
      callers: callerPlaces.map(({ id, ...place }) => place),
      siblings: this.findSiblings(method, enclosingType, value, callerPlaces),
      lines: this.readMethodLines(method),
    };
  }
}

export class RebuiltValuesWalk {
  constructor(repositoryText, testCode, callGraphOf, references, codeGraph) {
    this.repositoryText = repositoryText;
    this.testCode = testCode;
    this.findCallGraph = callGraphOf;
    this.references = references;
    this.codeGraph = codeGraph;
    this.familyWalkByFamilyMap = new Map();
  }

  getOrBuildFamilyWalk(family) {
    if (!this.familyWalkByFamilyMap.has(family)) {
      const callGraph = this.findCallGraph(family);
      this.familyWalkByFamilyMap.set(family, callGraph ? new FamilyRebuiltValuesWalk(this.repositoryText, this.testCode, callGraph, this.references, this.codeGraph) : null);
    }
    return this.familyWalkByFamilyMap.get(family);
  }

  findRelations(abstractions) {
    return abstractions.filter(isAChangedMethod).map(abstraction => {
      const familyWalk = this.getOrBuildFamilyWalk(readLanguageFamily(abstraction.path));
      return familyWalk ? familyWalk.findRebuiltValue(abstraction) : null;
    }).filter(Boolean);
  }
}
