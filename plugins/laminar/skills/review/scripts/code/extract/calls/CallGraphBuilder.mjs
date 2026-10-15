import { findClassRelationFinder } from "../finders/LanguageStrategies.mjs";
import { isAnExpressionQualifier } from "../../graph/relations/Reference.mjs";
import { THE_SUPERTYPE_RECEIVER, WORDS_FOR_THE_ENCLOSING_TYPE } from "../../inputs/source/names/LanguageWords.mjs";
import { describesOutsideCode } from "../../inputs/repository/RepositoryFileKinds.mjs";
import { SourceFile } from "../abstractions/module/generic/reading/SourceFile.mjs";
import { CallGraph, findTypesEnclosingTheSpan } from "./CallGraph.mjs";
import { ImportResolution } from "../abstractions/module/generic/imports/ImportResolution.mjs";
import { ReceiverTyping } from "../abstractions/method/generic/typing/ReceiverTyping.mjs";
import { OutsideNames } from "../abstractions/method/generic/outside/OutsideNames.mjs";
import { SourceLayout } from "./SourceLayout.mjs";
import { BodilessDeclarations } from "./BodilessDeclarations.mjs";
import { TypeParametersInScope } from "./scope/TypeParametersInScope.mjs";
import { findCallsOnLine } from "../abstractions/method/generic/calls/CallReading.mjs";
import { isABareTypeParameter, parseType, stripATypeParameter } from "../../inputs/source/text/TypeText.mjs";
import { countParameters, readParameterNamesOfAList, readReturnTypes, findTypeParameters, readTextWrappedBeforeTheName } from "../abstractions/method/generic/signatures/MethodSignatures.mjs";
import { isInsideAny, findLoopHolding, findLoopRegions, stopsTheLoop } from "../abstractions/method/generic/regions/LoopRegions.mjs";
import { findOnceGuardRegions } from "../abstractions/method/generic/regions/OnceGuards.mjs";
import { appendTo } from "../../../collections/groupedLists.mjs";
import { MethodScope } from "./scope/MethodScope.mjs";
import { FileLevelContexts } from "./scope/FileLevelContexts.mjs";
import { CallResolution } from "./resolution/CallResolution.mjs";
import { DeclarationLookups } from "./resolution/DeclarationLookups.mjs";
import { findParameterListAfterTheName } from "./scope/ParameterListText.mjs";
import { isAbstract } from "./resolution/AbstractTypes.mjs";
import { isTestPath } from "../../inputs/source/TestCode.mjs";
import { Scale } from "../../graph/abstractions/Scale.mjs";
import { findDriver } from "../../inputs/source/drivers/LanguageRegistry.mjs";
import { readFileName, readFileStem } from "../../../files/paths.mjs";
import { buildWholeWordPattern } from "../../inputs/source/text/PatternText.mjs";
import { endsADeclarationHead } from "../../inputs/source/declarations/DeclarationHeadReading.mjs";
import { holdsMembersOfItsOwn } from "../../inputs/source/declarations/SourceHeads.mjs";

const MAX_ANNOTATION_LINES = 6;

const ABSTRACT_HEAD_PATTERN = /\b(?:interface|abstract|trait|protocol)\b|\((?:[^)]*\b)?(?:ABC|Protocol|ABCMeta)\b/;

const TEMPLATE_LINE_PATTERN = /^\s*template\s*</;

const RETURN_STATEMENT_PATTERN = /\breturn\b\s*(.*?)\s*;?\s*$/;

function findTheReturnTypesOfAMethodReturningItself(code, index, endIndex) {
  let itself = false;
  for (let at = index + 1; at <= endIndex; at++) {
    const found = RETURN_STATEMENT_PATTERN.exec(code[at] || "");
    if (!found || !found[1]) continue;
    if (!WORDS_FOR_THE_ENCLOSING_TYPE.has(found[1]) || found[1] === THE_SUPERTYPE_RECEIVER) return undefined;
    itself = true;
  }
  return itself ? ["this"] : undefined;
}

const LAST_CALL_OF_A_LINE_PATTERN = /\)\s*[?!]*\.?\s*$/;

const readSavedMethod = ({ file, bodyLine, bodyCol, parameterNames, typeParameters, returnsParameter, ...kept }) => kept;

const joinTheTextWrappedBefore = (wrapped, before) => (wrapped ? `${wrapped} ${before.trim()}` : before);

function readHeadAroundTheName(file, index, name, parameters) {
  const text = file.code[index] || "";
  const nameAt = text.search(buildWholeWordPattern(name));
  const rest = parameters.text ? (file.code[parameters.endLine] || "").slice(parameters.endCol) : "";
  return {
    before: nameAt < 0 ? "" : joinTheTextWrappedBefore(readTextWrappedBeforeTheName(file.code, index, file.diffDriver), text.slice(0, nameAt)),
    after: rest.trim() ? rest : file.code[parameters.endLine + 1] || "",
    diffDriver: file.diffDriver,
  };
}

const isAnAnalyzableSource = source => !isTestPath(source.path) && Boolean(findDriver(source.path)) && !describesOutsideCode(source.path);

const liesInsideAKeptMethod = (declaration, kept) => kept.some(method => declaration.line > method.line && declaration.line <= method.to);

class CallGraphBuilder {
  constructor(family, sources) {
    this.family = family;
    this.files = sources.filter(isAnAnalyzableSource).map(source => new SourceFile(source.path, source.lines, source.declarations));
    this.fileByPathMap = new Map(this.files.map(file => [file.path, file]));
    this.types = [];
    this.typesByNameMap = new Map();
    this.methods = [];
    this.methodsByEnclosingTypeMap = new Map();
    this.topLevelByPathMap = new Map();
    this.topLevelByFolderMap = new Map();
    this.topLevelByModuleMap = new Map();
    this.supertypesByNameMap = new Map();
    this.subtypesByNameMap = new Map();
    this.declaredTypeByMethodAndNameMap = new Map();
    this.fieldTypeByEnclosingTypeAndNameMap = new Map();
    this.folderByImportPathMap = new Map();
    this.filesByFolderMap = new Map();
    for (const file of this.files) this.add(this.filesByFolderMap, file.folder, file);
    this.contextByFileAndEnclosingTypeMap = new Map();
    this.localByMethodAndNameMap = new Map();
    this.bodilessMembersByTypeDeclarationMap = new Map();
  }

  build() {
    for (const file of this.files) this.addTheDeclarationsOf(file);
    this.addStructuralImplementations();
    for (const method of this.methods) this.readCalls(method);
    const methods = this.methods.map(readSavedMethod);
    return new CallGraph({ family: this.family, methods, types: this.types.map(type => this.createSavedType(type)), files: this.files.map(file => this.collectImportsOfAFile(file)), typeParameters: this.readTypeParametersOfTheCallGraph() });
  }

  readTypeParametersOfTheCallGraph() {
    return { methods: this.methods.map(method => method.typeParameters), types: this.types.map(type => type.typeParameters) };
  }

  createSavedType(type) {
    const supertypes = [...(this.supertypesByNameMap.get(type.name) || [])].map(text => parseType(text)).filter(Boolean).map(parsed => parsed.simple);
    const abstract = isAbstract(type);
    const declared = abstract ? [...this.getOrReadBodilessMembers(type)].map(([name, index]) => ({ name, line: index + 1 })) : [];
    return { name: type.name, path: type.path, line: type.line, to: type.to, abstract, supertypes: [...new Set(supertypes)], declaredByKeyMap: declared };
  }

  addTheDeclarationsOf(file) {
    const typesOfFile = this.readTypesOf(file);
    for (const type of typesOfFile) this.addType(type);
    for (const method of this.readTopLevelMethodsOf(file, typesOfFile)) this.addMethod(method);
  }

  readTypesOf(file) {
    return file.declarations.filter(declaration => declaration.scale === Scale.CLASS.name && holdsMembersOfItsOwn(declaration))
      .map((declaration, position) => this.readType(file, declaration.line - 1, declaration.name, declaration.span.to - 1, position));
  }

  readTopLevelMethodsOf(file, typesOfFile) {
    const kept = [];
    for (const declaration of file.declarations.filter(declaration => declaration.scale === Scale.METHOD.name)) {
      if (liesInsideAKeptMethod(declaration, kept)) continue;
      const method = this.readMethod(file, declaration.line - 1, declaration, typesOfFile, declaration.span.to - 1, kept.length);
      if (!this.isABodilessDeclaration(method)) kept.push(method);
    }
    return kept;
  }

  readType(file, index, name, endIndex, position = 0) {
    const head = this.readHeadText(file, index, endIndex);
    const supertypes = file.driver.listSupertypes(head);
    const typeParameters = findTypeParameters(`${this.findTemplateLineBefore(file, index)} ${head}`, name);
    const classRelations = findClassRelationFinder(file.diffDriver);
    const isAStructuralInterface = classRelations.isAStructuralInterface(file.raw[index] || "");
    const type = {
      id: this.types.length + position,
      name,
      path: file.path,
      folder: file.folder,
      line: index + 1,
      to: endIndex + 1,
      supertypes,
      typeParameters,
      abstract: ABSTRACT_HEAD_PATTERN.test(head),
      interfaceMethods: isAStructuralInterface ? classRelations.findInterfaceMethods(file.code, index, endIndex) : [],
      interfaceResults: isAStructuralInterface ? classRelations.findInterfaceResults(file.code, index, endIndex, findParameterListAfterTheName) : null,
      underlying: classRelations.findUnderlyingType(file.code[index]),
    };
    return type;
  }

  addType(type) {
    this.types.push(type);
    this.add(this.typesByNameMap, type.name, type);
    for (const supertype of type.supertypes) this.addSupertype(type.name, supertype);
  }

  addSupertype(subtype, supertype) {
    this.addToSet(this.supertypesByNameMap, subtype, supertype);
    this.addToSet(this.subtypesByNameMap, supertype, subtype);
  }

  findTemplateLineBefore(file, index) {
    const before = file.code[index - 1] || "";
    return TEMPLATE_LINE_PATTERN.test(before) ? before : "";
  }

  readHeadText(file, index, endIndex) {
    const lines = [];
    for (let at = index; at <= Math.min(endIndex, index + MAX_ANNOTATION_LINES - 1); at++) {
      lines.push(file.raw[at] || "");
      if (endsADeclarationHead(file.code[at] || "")) break;
    }
    return lines.join(" ").split("{")[0];
  }

  readDeclarationScope(file, index, declaration, typesOfFile) {
    const enclosing = findTypesEnclosingTheSpan(typesOfFile, file.path, { from: index + 1, to: index + 1 });
    const enclosingType = enclosing[enclosing.length - 1];
    const typeName = declaration.declaredScope ? declaration.declaredScope.split(/\.|::/).pop() : enclosingType ? enclosingType.name : "";
    const typeParameters = findTypeParameters(`${this.findTemplateLineBefore(file, index)} ${file.code[index] || ""}`, declaration.name);
    const typeParametersInScope = new Set([...typeParameters, ...enclosing.flatMap(type => type.typeParameters)]);
    return { enclosingType, enclosingTypeName: typeName, typeParameters, typeParametersInScope };
  }

  readMethod(file, index, declaration, typesOfFile, end, position = 0) {
    const parameters = findParameterListAfterTheName(file.code, index, declaration.name);
    const { enclosingType, enclosingTypeName: typeName, typeParameters, typeParametersInScope } = this.readDeclarationScope(file, index, declaration, typesOfFile);
    const method = {
      id: this.methods.length + position,
      path: file.path,
      line: index + 1,
      to: end + 1,
      name: declaration.name,
      enclosingTypeName: typeName,
      calls: [],
      file,
      bodyLine: parameters.text ? parameters.endLine : index,
      bodyCol: parameters.text ? parameters.endCol : 0,
      parameterNames: parameters.text ? readParameterNamesOfAList(parameters.text, file.driver) : [],
      ...(parameters.text ? { parameterCount: countParameters(parameters.text) } : {}),
      typeParameters,
      returns: this.returnsOf(file, index, declaration.name, parameters, typeParametersInScope) || (typeName ? findTheReturnTypesOfAMethodReturningItself(file.code, index, end) : undefined),
    };
    const returnedParameter = method.returns || typeParameters.length ? undefined : this.findReturnedTypeParameter(file, index, declaration.name, parameters, enclosingType);
    if (returnedParameter) method.returnsParameter = returnedParameter;
    return method;
  }

  addMethod(method) {
    const { file, enclosingTypeName: typeName } = method;
    this.methods.push(method);
    if (typeName) {
      this.add(this.methodsByEnclosingTypeMap, typeName, method);
      return;
    }
    this.add(this.topLevelByPathMap, file.path, method);
    this.add(this.topLevelByFolderMap, file.folder, method);
    this.add(this.topLevelByModuleMap, readFileStem(file.path), method);
    this.add(this.topLevelByModuleMap, readFileName(file.folder), method);
  }

  returnsOf(file, index, name, parameters, typeParametersInScope) {
    const found = readReturnTypes(readHeadAroundTheName(file, index, name, parameters)).map(text => stripATypeParameter(text, typeParametersInScope));
    return found.some(Boolean) ? found : undefined;
  }

  findReturnedTypeParameter(file, index, name, parameters, enclosingType) {
    if (!enclosingType || !enclosingType.typeParameters.length) return undefined;
    const [first] = readReturnTypes(readHeadAroundTheName(file, index, name, parameters));
    const type = first ? parseType(first) : null;
    return isABareTypeParameter(type, new Set(enclosingType.typeParameters)) ? type.simple : undefined;
  }

  add(map, key, value) {
    appendTo(map, key, value);
  }

  addToSet(map, key, value) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  }

  addStructuralImplementations() {
    const interfaces = this.types.filter(type => type.interfaceMethods.length);
    if (!interfaces.length) return;
    const namesByEnclosingTypeMap = new Map();
    for (const [typeName, methods] of this.methodsByEnclosingTypeMap) namesByEnclosingTypeMap.set(typeName, new Set(methods.map(method => method.name)));
    for (const type of interfaces) {
      for (const [typeName, names] of namesByEnclosingTypeMap) {
        if (typeName === type.name || !type.interfaceMethods.every(name => names.has(name))) continue;
        this.addSupertype(typeName, type.name);
      }
    }
  }

  readCalls(method) {
    const { file } = method;
    const callsByIndexMap = new Map();
    const readCallsAt = index => {
      if (!callsByIndexMap.has(index)) {
        callsByIndexMap.set(index, findCallsOnLine(file.code[index], file.diffDriver, index === method.bodyLine ? method.bodyCol : 0, file.chainHeads[index]));
      }
      return callsByIndexMap.get(index);
    };
    const lastIndex = method.to - 1;
    const shape = { code: file.code, firstIndex: method.bodyLine, toIndex: lastIndex, diffDriver: file.diffDriver, callsAt: readCallsAt };
    const regions = findLoopRegions(shape);
    const guards = findOnceGuardRegions({ ...shape, isLocal: name => this.isLocal(method, name) });
    let carried = null;
    for (let index = method.bodyLine; index <= lastIndex; index++) {
      const resultsByColumnMap = new Map();
      const namesByColumnMap = new Map();
      if (file.chainHeads[index] && carried) { resultsByColumnMap.set(-1, carried.result); namesByColumnMap.set(-1, carried.names); }
      for (const call of readCallsAt(index)) {
        const once = isInsideAny(guards, index, call.col);
        const loop = this.findLoop(file, regions, index, call);
        const previous = this.findPreviousResult(method, index, call, resultsByColumnMap);
        const previousNames = call.chained && namesByColumnMap.has(call.receiverAt) ? namesByColumnMap.get(call.receiverAt) : null;
        const qualifierTyping = isAnExpressionQualifier(call.qualifier) && call.qualifierAt >= 0 ? { result: resultsByColumnMap.get(call.qualifierAt) || null, names: namesByColumnMap.get(call.qualifierAt) || [] } : null;
        const { read, result, names } = this.buildResolvedCall(method, index, call, once ? null : loop, once, previous, previousNames, qualifierTyping);
        method.calls.push(read);
        if (call.closing >= 0) { resultsByColumnMap.set(call.closing, result); namesByColumnMap.set(call.closing, names); }
      }
      const text = (file.code[index] || "").trimEnd();
      if (!text.trim()) continue;
      const last = LAST_CALL_OF_A_LINE_PATTERN.exec(text);
      carried = last ? { result: resultsByColumnMap.get(last.index) || null, names: namesByColumnMap.get(last.index) || [] } : null;
    }
  }

  findLoop(file, regions, index, call) {
    const loop = findLoopHolding(regions, index, call.col);
    if (!loop || stopsTheLoop({ code: file.code, diffDriver: file.diffDriver, lineIndex: index, col: call.col, loop: loop, regions })) return null;
    return { head: loop.head + 1, form: loop.form };
  }
}

Object.assign(CallGraphBuilder.prototype, ImportResolution, ReceiverTyping, OutsideNames, SourceLayout, TypeParametersInScope, MethodScope, CallResolution, FileLevelContexts, DeclarationLookups, BodilessDeclarations);

export const buildCallGraph = (family, sources) => new CallGraphBuilder(family, sources).build();
