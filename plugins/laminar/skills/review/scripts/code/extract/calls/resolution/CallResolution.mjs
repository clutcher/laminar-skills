import { readImportConventions, findMethodRelationFinder, readPackageScope } from "../../finders/LanguageStrategies.mjs";
import { CALL_FORMS, CALL_STATUS, isAGroupOfTheFamily, RECEIVER_KINDS, chooseResolvedOrNotFoundStatus } from "../../../graph/relations/Reference.mjs";
import { namesAType } from "../../../inputs/source/names/NamingConventions.mjs";
import { THE_SUPERTYPE_RECEIVER, WORDS_FOR_THE_ENCLOSING_TYPE } from "../../../inputs/source/names/LanguageWords.mjs";
import { isVendored } from "../../../inputs/repository/RepositoryFileKinds.mjs";
import { readArgumentCount, readsAPath } from "../../abstractions/method/generic/calls/CallReading.mjs";
import { collectNestedTypeArguments, parseType, replaceASelfTypeWithTheEnclosingType, parseTypeArguments, stripAWildcardBound } from "../../../inputs/source/text/TypeText.mjs";
import { isInMemoryType, doesSomeTypeLeaveMemory, staysInMemoryByShape } from "../../abstractions/method/generic/calls/InMemoryCalls.mjs";
import { findMethodsOfTheNearestSupertype, walkSupertypeSteps } from "./SupertypeWalk.mjs";
import { capTheCallTargets, capTheTargetsOfATypeAndItsImplementations, collectEveryCallTarget, fansOutPastTheCap, readIds } from "./CallTargets.mjs";
import { findParameterListAfterTheName } from "../scope/ParameterListText.mjs";
import { isAbstract } from "./AbstractTypes.mjs";
import { findTypeParameters } from "../../abstractions/method/generic/signatures/MethodSignatures.mjs";

const CONSTRUCTOR_NAMES = ["constructor", "__init__", "init", "new", "initialize"];

const STATUSES_THAT_LEAVE_THE_REPOSITORY = new Set([CALL_STATUS.OUTSIDE, CALL_STATUS.UNKNOWN, CALL_STATUS.NO_IMPLEMENTATION, CALL_STATUS.MANY_IMPLEMENTATIONS,
  CALL_STATUS.STATIC, CALL_STATUS.MODULE, CALL_STATUS.CHAIN, CALL_STATUS.NONE]);

const isOutsideTheRepository = resolution => (resolution.targets.length === 0 || resolution.status === CALL_STATUS.NO_IMPLEMENTATION)
  && STATUSES_THAT_LEAVE_THE_REPOSITORY.has(resolution.status);

const leavesTheRepository = (call, resolution, diffDriver) => (resolution.targets.length === 0 || resolution.status === CALL_STATUS.NO_IMPLEMENTATION)
  && STATUSES_THAT_LEAVE_THE_REPOSITORY.has(resolution.status)
  && !staysInMemoryByShape(call, diffDriver);

const isAnUnqualifiedCallOnTheSupertypes = (receiver, qualifier) => receiver === THE_SUPERTYPE_RECEIVER && !qualifier;

const C_STYLE_CAST_PATTERN = /^\(\s*((?:[\w$]+\.)*[A-Z][\w$]*(?:\s*<[^()]*>)?(?:\s*\[\s*\])*)\s*\)\s*[\w$(]/;

const AS_CAST_PATTERN = /\s+as[?!]?\s+((?:[\w$]+\.)*[A-Za-z_][\w$]*(?:\s*<[^()]*>)?)\s*$/;

const CALL_BEFORE_PATTERN = /[\w$)\]>]\s*$/;

const WORD_BEFORE_A_VALUE_PATTERN = /(?:^|[^\w$.])(?:return|await|throw|yield|case|in|of|else|do|when)\s*$/;

function findOpening(code, closing) {
  let depth = 0;
  for (let at = closing; at >= 0; at--) {
    if (code[at] === ")") depth++;
    else if (code[at] === "(") { depth--; if (depth === 0) return at; }
  }
  return -1;
}

function castTypeBefore(code, closing, diffDriver) {
  if (code[closing] !== ")") return "";
  const opening = findOpening(code, closing);
  if (opening < 0) return "";
  const before = code.slice(0, opening);
  const inside = code.slice(opening + 1, closing).trim();
  if (findMethodRelationFinder(diffDriver).castsAfterADot) return /\.\s*$/.test(before) && inside !== "type" ? inside : "";
  if (CALL_BEFORE_PATTERN.test(before) && !WORD_BEFORE_A_VALUE_PATTERN.test(before)) return "";
  const cStyle = findMethodRelationFinder(diffDriver).cStyleCasts ? C_STYLE_CAST_PATTERN.exec(inside) : null;
  if (cStyle) return cStyle[1];
  const asCast = AS_CAST_PATTERN.exec(inside);
  return asCast ? asCast[1] : "";
}

const makesPossibleTypesApproximate = call => call.args !== 0;

const approximateCopyOf = possibleTypes => Object.assign([...possibleTypes], { approximate: true, container: possibleTypes.container, file: possibleTypes.file });

const markCarriedPossibleTypes = (call, carried) => (carried.approximate || !makesPossibleTypesApproximate(call) ? carried : approximateCopyOf(carried));

export const CallResolution = {
  findPreviousResult(method, index, call, resultsOfLine) {
    if (call.form !== CALL_FORMS.DOTTED || !call.chained) return null;
    if (call.indexedName) {
      const typed = this.readRememberedDeclaredType(method, call.indexedName, "", index);
      const home = typed.file || method.file;
      const element = typed.text ? this.findElementTypeText({ file: home }, typed.text) : "";
      return element ? { text: element, file: home } : null;
    }
    const cast = call.receiverAt >= 0 ? castTypeBefore(method.file.code[index] || "", call.receiverAt, method.file.diffDriver) : "";
    if (cast) return { text: cast, file: method.file };
    return resultsOfLine.get(call.receiverAt) || null;
  },

  buildResolvedCall(method, index, call, loop, once, previous, previousNames, qualifierTyping = null) {
    const member = qualifierTyping && qualifierTyping.result && qualifierTyping.result.text ? this.findMemberTyped(qualifierTyping.result, call.receiver) : null;
    const typed = member ? this.resolveTypedCall(method, call, parseType(member.text), call.receiver, member.file)
      : previous && previous.possibleTypes ? this.findCallOnOneOfThePossibleTypes(method, call, previous.possibleTypes, "")
      : previous && previous.text ? this.resolveTypedCall(method, call, parseType(previous.text), "", previous.file) : null;
    const byChain = !typed || (!typed.targets.length && typed.status !== CALL_STATUS.IN_MEMORY) ? this.resolveCallByForm(method, index, call) : null;
    const read = typed && (typed.targets.length || typed.status === CALL_STATUS.IN_MEMORY || !byChain.targets.length) ? { ...typed, root: byChain ? byChain.root : typed.root } : byChain;
    const resolution = !read.targets.length && previous && previous.generated && isOutsideTheRepository(read) ? this.createOutcome([], CALL_STATUS.GENERATED, RECEIVER_KINDS.CLASS) : read;
    const { targets } = resolution;
    const end = !once && leavesTheRepository(call, resolution, method.file.diffDriver);
    const argumentCount = readArgumentCount(method.file.code[index], call);
    const named = isOutsideTheRepository(resolution) ? this.findOutsideNames(method, index, call, resolution, previousNames || [], previousNames === null) : [];
    const names = named.length || !qualifierTyping || !isOutsideTheRepository(resolution) ? named : this.findNamesOfAMemberOfAResult(method, qualifierTyping, call.receiver);
    return {
      names: names.filter(name => !isAGroupOfTheFamily(name)),
      read: {
        line: index + 1,
        col: call.col,
        callee: call.callee,
        receiver: call.receiver || "",
        form: call.form,
        loop,
        targets,
        status: resolution.status,
        ...(argumentCount === null ? {} : { args: argumentCount }),
        ...(end ? { end: true } : {}),
        ...(end && names.length ? { on: names } : {}),
        ...(once ? { once: true } : {}),
      },
      result: this.findResult(method, call, resolution),
    };
  },

  findResult(method, call, resolution) {
    if (call.form === CALL_FORMS.NEW) return this.readTypeOfAConstructedResult(resolution, method.file, call.callee);
    const returned = this.findTypeOfACallResult(resolution, 0, method.file, targetMethod => this.resolveTheTypeArgumentReturnedBy(targetMethod, resolution));
    if (returned) return returned;
    if (resolution.targets.length) return null;
    if (resolution.status === CALL_STATUS.GENERATED && !resolution.type) return { generated: true };
    if (resolution.status === CALL_STATUS.NOT_FOUND || resolution.status === CALL_STATUS.GENERATED) return this.findMemberResult(method, call, resolution);
    if (!resolution.type) return null;
    const typeFile = resolution.typeFile || method.file;
    if (findMethodRelationFinder(method.file.diffDriver).resultsComeFromInterfaces && resolution.status !== CALL_STATUS.IN_MEMORY) return this.findInterfaceResult(resolution.type, typeFile, call.callee);
    if (resolution.status === CALL_STATUS.NO_IMPLEMENTATION || resolution.status === CALL_STATUS.MANY_IMPLEMENTATIONS) return this.findDeclaredResult({ ...resolution, typeFile }, call.callee);
    if (resolution.carried) return { possibleTypes: markCarriedPossibleTypes(call, resolution.carried), file: resolution.carried.file || method.file };
    if (resolution.status === CALL_STATUS.IN_MEMORY) return this.findPossibleContainerTypes(method, call, resolution.type, typeFile);
    return null;
  },

  resolveTheTypeArgumentReturnedBy(targetMethod, resolution) {
    return targetMethod.returnsParameter && resolution.type ? this.findTypeArgument(targetMethod, resolution) : "";
  },

  findTypeArgument(targetMethod, resolution) {
    const typeDeclaration = this.findTypeDeclarationInTheFile(targetMethod, targetMethod.enclosingTypeName);
    const at = typeDeclaration ? typeDeclaration.typeParameters.indexOf(targetMethod.returnsParameter) : -1;
    if (at < 0) return "";
    const found = parseTypeArguments(resolution.type.text)[at] || "";
    return stripAWildcardBound(found).trim();
  },

  findMemberResult(method, call, resolution) {
    const typeDeclarations = resolution.type ? this.findDeclarationsOfType(resolution.type, resolution.typeFile || method.file)
      : resolution.root && this.typesByNameMap.has(resolution.root) ? this.findTypesNamed(resolution.root, method.path, method.file.folder) : [];
    if (!typeDeclarations.length) return null;
    const declaringFile = this.fileByPathMap.get(typeDeclarations[0].path);
    const text = call.args === 0 && declaringFile ? this.readFieldTypeText(typeDeclarations[0].name, call.callee, declaringFile) : "";
    if (text) return { text, file: declaringFile };
    return this.findOutsideSupertypes(typeDeclarations[0]).length ? null : { generated: true };
  },

  findPossibleContainerTypes(method, call, type, typeFile) {
    const possibleTypes = collectNestedTypeArguments(type.text);
    if (!doesSomeTypeLeaveMemory(possibleTypes, method.file.diffDriver)) return null;
    const containerTypes = [type.text, ...possibleTypes];
    containerTypes.approximate = makesPossibleTypesApproximate(call);
    containerTypes.container = type.text;
    containerTypes.file = typeFile;
    return { possibleTypes: containerTypes, file: typeFile };
  },

  resolveCallByForm(method, index, call) {
    if (call.form === CALL_FORMS.COMMAND) return this.resolveBareFunctions(method, call, RECEIVER_KINDS.NONE);
    if (call.form === CALL_FORMS.NEW) return this.resolveAConstructorCall(method, call.callee, call.scope || "");
    if (call.form === CALL_FORMS.BARE) return this.resolveBareCall(method, call);
    return this.resolveDottedCall(method, index, call);
  },

  createOutcome(targets, status, receiverKind, extra = {}) {
    return { targets, status, receiverKind, ...extra };
  },

  createResolvedOrNotFoundOutcome(targets, receiverKind, extra = {}) {
    return this.createOutcome(targets, chooseResolvedOrNotFoundStatus(targets), receiverKind, extra);
  },

  resolveBareFunctions(method, call, receiverKind) {
    const sameFile = (this.topLevelByPathMap.get(method.path) || []).filter(topLevelMethod => topLevelMethod.name === call.callee);
    const found = sameFile.length || !findMethodRelationFinder(method.file.diffDriver).functionsOfTheFolderAreInScope
      ? sameFile
      : (this.topLevelByFolderMap.get(method.file.folder) || []).filter(topLevelMethod => topLevelMethod.name === call.callee);
    const targets = readIds(capTheCallTargets(found));
    return this.createOutcome(targets, targets.length ? CALL_STATUS.RESOLVED : CALL_STATUS.NONE, receiverKind);
  },

  resolveBareCall(method, call) {
    if (this.declaresALocalFunction(method, call.callee)) return this.createOutcome([], CALL_STATUS.LOCAL_FUNCTION, RECEIVER_KINDS.NONE);
    for (const typeName of method.enclosingTypeName ? [method.enclosingTypeName, ...this.findEnclosingTypeNames(method)] : []) {
      const inType = this.findCappedCallTargetsDeclaredInType(typeName, call.callee, method.file.folder);
      if (inType.length) return this.createOutcome(inType, CALL_STATUS.RESOLVED, RECEIVER_KINDS.NONE);
      const inherited = this.callsItsOwnMembersBare(method) ? this.findInheritedMethodsNamed({ ...method, enclosingTypeName: typeName }, call.callee) : [];
      if (inherited.length) return this.createOutcome(readIds(capTheCallTargets(inherited)), CALL_STATUS.RESOLVED, RECEIVER_KINDS.NONE);
    }
    const functions = this.resolveBareFunctions(method, call, RECEIVER_KINDS.NONE);
    if (functions.targets.length || this.isAValueOfTheMethod(method, call.callee)) return functions;
    const onADeclaredMember = this.resolveABareCallOnADeclaredMember(method, call);
    if (onADeclaredMember) return onADeclaredMember;
    const imported = this.findImportedDeclaration(method.file, call.callee) || this.findWildcardDeclaration(method.file, call.callee);
    const byImport = imported ? this.resolveAFoundDeclaration(method, call.callee, imported) : null;
    if (byImport) return byImport;
    if (this.findTypesInScope(method, call.callee).length) return this.resolveAConstructorCall(method, call.callee);
    return functions;
  },

  callsItsOwnMembersBare(method) {
    return Boolean(method.enclosingTypeName) && findMethodRelationFinder(method.file.diffDriver).callsOwnMembersBare;
  },

  resolveABareCallOnADeclaredMember(method, call) {
    if (!this.callsItsOwnMembersBare(method)) return null;
    for (const typeName of [method.enclosingTypeName, ...this.findEnclosingTypeNames(method)]) {
      const typeDeclaration = this.findTypeDeclarationInTheFile(method, typeName);
      const declarer = typeDeclaration ? this.findRepositoryDeclarer(typeDeclaration, call.callee) : null;
      if (!declarer) continue;
      const implemented = this.findImplementations(typeName).flatMap(subtype => this.findMethodsOfTheTypeNamed(subtype, call.callee));
      const typed = { type: parseType(declarer.name), typeFile: this.fileByPathMap.get(declarer.path) };
      if (fansOutPastTheCap(implemented)) return this.createOutcome([], CALL_STATUS.MANY_IMPLEMENTATIONS, RECEIVER_KINDS.INTERFACE, typed);
      if (implemented.length) return this.createOutcome(implemented.map(implementingMethod => implementingMethod.id), CALL_STATUS.RESOLVED, RECEIVER_KINDS.INTERFACE, typed);
      return this.createOutcome([], CALL_STATUS.NO_IMPLEMENTATION, RECEIVER_KINDS.INTERFACE, typed);
    }
    return null;
  },

  findDeclaredResult(resolution, callee) {
    const typeDeclarations = resolution.type ? this.findDeclarationsOfType(resolution.type, resolution.typeFile) : [];
    const declarer = typeDeclarations.length ? this.findRepositoryDeclarer(typeDeclarations[0], callee) : null;
    const index = declarer ? this.getOrReadBodilessMembers(declarer).get(callee) : undefined;
    if (index === undefined) return null;
    const file = this.fileByPathMap.get(declarer.path);
    const typeParameters = new Set([...declarer.typeParameters, ...findTypeParameters(file.code[index] || "", callee)]);
    const returns = this.returnsOf(file, index, callee, findParameterListAfterTheName(file.code, index, callee), typeParameters);
    const text = returns ? returns[0] : "";
    if (!text) return null;
    return { text: replaceASelfTypeWithTheEnclosingType(text, declarer.name), file };
  },

  resolveAFoundDeclaration(method, name, found) {
    if (found.kind === "function") return this.createOutcome(capTheCallTargets(found.targets), CALL_STATUS.RESOLVED, RECEIVER_KINDS.NONE);
    if (found.kind === "function value") return this.createOutcome([], CALL_STATUS.RESOLVED, RECEIVER_KINDS.NONE);
    if (found.kind === "type") return { ...this.resolveAConstructorCall(this.getOrAddContext(this.fileByPathMap.get(found.typeDeclaration.path), ""), found.typeDeclaration.name), typeFile: this.fileByPathMap.get(found.typeDeclaration.path) };
    return null;
  },

  findInheritedMethodsNamed(method, name) {
    const steps = walkSupertypeSteps(method.enclosingTypeName, { readName: typeName => typeName, listSupertypes: typeName => this.supertypesByNameMap.get(typeName), resolve: type => type.simple });
    return findMethodsOfTheNearestSupertype(steps, resolved => this.findOwnMethodsNamed(resolved, name, method.file.folder));
  },

  resolveAConstructorCall(method, typeName, scope = "") {
    const typeDeclarations = scope ? this.findTypesInAScope(method.file, typeName, scope) : this.findTypesNamed(typeName, method.path, method.file.folder);
    if (!typeDeclarations.length) {
      const constructed = scope ? `${scope}.${typeName}` : typeName;
      const type = parseType(constructed);
      const status = isInMemoryType(type, method.file.diffDriver) ? CALL_STATUS.IN_MEMORY : CALL_STATUS.OUTSIDE;
      return this.createOutcome([], status, RECEIVER_KINDS.OUTSIDE, { type, constructedType: constructed });
    }
    const found = [typeName, ...CONSTRUCTOR_NAMES]
      .flatMap(name => this.findMethodsOfTheTypeNamed(typeName, name));
    return this.createResolvedOrNotFoundOutcome(readIds(capTheCallTargets(found)), RECEIVER_KINDS.CLASS, { constructedType: typeName });
  },

  resolveDottedCall(method, index, call) {
    if (call.chained || !call.receiver) return this.resolveChainedCall(method, index, call);
    const receiver = call.receiver;
    if (WORDS_FOR_THE_ENCLOSING_TYPE.has(receiver) && !call.qualifier) return isAnUnqualifiedCallOnTheSupertypes(receiver, call.qualifier) ? this.resolveACallOnTheSupertypes(method, call) : this.resolveACallOnTheEnclosingType(method, call);
    const typed = readsAPath(call) ? this.typeThePath(method, call.path, index) : this.readRememberedDeclaredType(method, receiver, call.qualifier, index);
    if (typed.text) return this.resolveTypedCall(method, call, parseType(typed.text), receiver, typed.file || method.file);
    const possibleTypes = call.qualifier ? [] : this.inferElementTypesOfTheVariable(method, receiver, index);
    const onAPossibleType = possibleTypes.length ? this.findCallOnOneOfThePossibleTypes(method, call, possibleTypes, receiver) : null;
    if (onAPossibleType) return onAPossibleType;
    if (this.typesByNameMap.has(receiver)) {
      return this.createResolvedOrNotFoundOutcome(this.findCappedCallTargetsDeclaredInType(receiver, call.callee, method.file.folder), RECEIVER_KINDS.STATIC, { root: receiver });
    }
    if (this.doesTheReceiverNameAType(method, call)) return this.createOutcome([], CALL_STATUS.STATIC, RECEIVER_KINDS.STATIC, { type: parseType(receiver), root: receiver });
    if (!call.qualifier && !this.isAParameterOf(method, receiver) && method.file.imports(receiver)) return this.resolveACallOnAModule(method, receiver, call);
    return this.createOutcome([], CALL_STATUS.UNKNOWN, RECEIVER_KINDS.UNKNOWN, { root: receiver });
  },

  doesTheReceiverNameAType(method, call) {
    return namesAType(call.receiver) && !readPackageScope(method.file.diffDriver).isReceiverAPackageMember(call);
  },

  findCallOnOneOfThePossibleTypes(method, call, possibleTypes, receiver) {
    const home = possibleTypes.file || method.file;
    for (const possibleType of possibleTypes) {
      const type = parseType(possibleType);
      const typeDeclarations = type && !isInMemoryType(type, method.file.diffDriver) ? this.findDeclarationsOfType(type, home) : [];
      if (typeDeclarations.length && this.findCappedCallTargetsInTypeAndImplementations(type.simple, call.callee, typeDeclarations[0].folder).targets.length) return this.resolveTypedCall(method, call, type, receiver, home);
    }
    if (possibleTypes.container) {
      const container = parseType(possibleTypes.container);
      const outcome = this.createOutcome([], CALL_STATUS.IN_MEMORY, RECEIVER_KINDS.OUTSIDE, { type: container, root: receiver });
      return { ...outcome, carried: possibleTypes };
    }
    const outside = possibleTypes.filter(possibleType => { const type = parseType(possibleType); return type && !isInMemoryType(type, method.file.diffDriver) && !this.findDeclarationsOfType(type, home).length; });
    if (!possibleTypes.approximate && outside.length === 1 && possibleTypes.length === 1) return this.resolveTypedCall(method, call, parseType(outside[0]), receiver, home);
    return null;
  },

  resolveChainedCall(method, index, { root, qualifier, callee }) {
    if (isAnUnqualifiedCallOnTheSupertypes(root, qualifier) && method.enclosingTypeName) return this.resolveACallOnTheSupertypes(method, { callee });
    if (!root) return this.createOutcome([], CALL_STATUS.CHAIN, RECEIVER_KINDS.CHAIN);
    const isAType = namesAType(root) && !this.readDeclaredTypeText(method, root, qualifier, index);
    if (isAType) return this.createOutcome([], CALL_STATUS.CHAIN, RECEIVER_KINDS.STATIC, { root, type: parseType(root) });
    const text = WORDS_FOR_THE_ENCLOSING_TYPE.has(root) ? "" : this.readDeclaredTypeText(method, root, qualifier, index);
    const type = text ? parseType(text) : null;
    const status = type && isInMemoryType(type, method.file.diffDriver) ? CALL_STATUS.IN_MEMORY : CALL_STATUS.CHAIN;
    return this.createOutcome([], status, RECEIVER_KINDS.CHAIN, { root, type });
  },

  resolveACallOnTheEnclosingType(method, call) {
    if (!method.enclosingTypeName) return this.createOutcome([], CALL_STATUS.NONE, RECEIVER_KINDS.CLASS);
    return this.resolveACallOnTypes(method, call, [method.enclosingTypeName]);
  },

  resolveACallOnTheSupertypes(method, call) {
    if (!method.enclosingTypeName) return this.createOutcome([], CALL_STATUS.NONE, RECEIVER_KINDS.CLASS);
    return this.resolveACallOnTypes(method, call, [...(this.supertypesByNameMap.get(method.enclosingTypeName) || [])]);
  },

  resolveACallOnTypes(method, call, typeNames) {
    const targets = typeNames.flatMap(typeName => this.findCappedCallTargetsDeclaredInType(typeName, call.callee, method.file.folder));
    return this.createResolvedOrNotFoundOutcome(capTheCallTargets(targets), RECEIVER_KINDS.CLASS);
  },

  resolveACallOnAModule(method, receiver, call) {
    const imported = method.file.findImport(receiver);
    const outside = imported && !this.importsFromTheRepository(method.file, imported);
    const found = outside ? [] : this.findModuleFunctionsNamed(method.file, receiver, call.callee);
    const targets = readIds(capTheCallTargets(found));
    if (!targets.length && !outside) {
      const inTheModule = this.resolveACallOnAnImportedDeclaration(method, receiver, call);
      if (inTheModule) return { ...inTheModule, root: receiver };
    }
    return this.createOutcome(targets, targets.length ? CALL_STATUS.RESOLVED : CALL_STATUS.MODULE, RECEIVER_KINDS.MODULE, { root: receiver });
  },

  resolveACallOnAnImportedDeclaration(method, receiver, call) {
    const declared = this.findImportedDeclaration(method.file, receiver);
    if (!declared) return null;
    if (declared.kind === "value") return this.resolveTypedCall(method, call, parseType(declared.text), receiver, declared.file);
    if (declared.kind === "type") {
      return this.createResolvedOrNotFoundOutcome(this.findCappedCallTargetsDeclaredInType(declared.typeDeclaration.name, call.callee, declared.typeDeclaration.folder), RECEIVER_KINDS.STATIC);
    }
    if (declared.kind === "module") return this.findACallInAnImportedModule(method, receiver, call, declared.files);
    return null;
  },

  findACallInAnImportedModule(method, receiver, call, moduleFiles) {
    for (const moduleFile of moduleFiles) {
      const inside = this.findTheDeclarationThroughTheFile(moduleFile, call.callee, new Set());
      const resolved = inside ? this.resolveAFoundDeclaration(method, call.callee, inside) : null;
      if (resolved) return this.qualifyATypeByItsModuleReceiver(method, receiver, call, inside, resolved);
    }
    return null;
  },

  qualifyATypeByItsModuleReceiver(method, receiver, call, inside, resolved) {
    if (inside.kind !== "type" || !findMethodRelationFinder(method.file.diffDriver).typeOfAnImportedModuleIsQualified) return resolved;
    return { ...resolved, constructedType: `${receiver}.${call.callee}`, typeFile: method.file };
  },

  findModuleFunctionsNamed(file, word, name) {
    const topLevel = readImportConventions(file.diffDriver).importsNameFolders ? this.findTopLevelOfTheImportedFolder(file, word) : this.findOwnTopLevelOfTheModule(word);
    return topLevel.filter(topLevelMethod => topLevelMethod.name === name);
  },

  findOwnTopLevelOfTheModule(word) {
    return (this.topLevelByModuleMap.get(word) || []).filter(topLevelMethod => !isVendored(topLevelMethod.path));
  },

  findTopLevelOfTheImportedFolder(file, word) {
    const folder = this.findFolderOfImport(file.readImportedPath(word));
    return folder === null ? [] : this.topLevelByFolderMap.get(folder) || [];
  },

  resolveTypedCall(method, call, type, receiver, typeFile = method.file) {
    if (!type) return this.createOutcome([], CALL_STATUS.UNKNOWN, RECEIVER_KINDS.UNKNOWN, { root: receiver });
    if (isInMemoryType(type, method.file.diffDriver)) return this.createOutcome([], CALL_STATUS.IN_MEMORY, RECEIVER_KINDS.OUTSIDE, { type, root: receiver, typeFile });
    const typeDeclarations = this.findDeclarationsOfType(type, typeFile);
    if (!typeDeclarations.length) return this.createOutcome([], CALL_STATUS.OUTSIDE, RECEIVER_KINDS.OUTSIDE, { type, root: receiver, typeFile });
    const abstract = typeDeclarations.some(isAbstract);
    const inType = this.findCappedCallTargetsInTypeAndImplementations(type.simple, call.callee, typeDeclarations[0].folder);
    const receiverKind = abstract ? RECEIVER_KINDS.INTERFACE : RECEIVER_KINDS.CLASS;
    const throughTheSupertypes = !abstract && !inType.targets.length ? this.resolveACallThroughTheSupertypes(typeDeclarations[0], call, receiverKind, { type, root: receiver, typeFile }) : null;
    if (throughTheSupertypes) return throughTheSupertypes;
    const declaredWithABody = abstract && !inType.implemented && inType.targets.length > 0 && inType.targets.every(id => this.hasABody(this.methods[id]));
    const status = inType.fanOut ? CALL_STATUS.FAN_OUT
      : declaredWithABody ? CALL_STATUS.RESOLVED
      : abstract && !inType.implemented && this.isImplementedImplicitly(type.simple, typeDeclarations, call.callee) ? CALL_STATUS.GENERATED
      : abstract && !inType.implemented ? CALL_STATUS.NO_IMPLEMENTATION
        : chooseResolvedOrNotFoundStatus(inType.targets);
    return this.createOutcome(inType.targets, status, receiverKind, { type, root: receiver, typeFile });
  },

  resolveACallThroughTheSupertypes(typeDeclaration, call, receiverKind, typed) {
    const inherited = this.findMethodsInheritedBy(typeDeclaration, call.callee);
    if (inherited.length) return this.createOutcome(readIds(capTheCallTargets(inherited)), CALL_STATUS.RESOLVED, receiverKind, typed);
    if (this.findOutsideSupertypes(typeDeclaration).length) return this.createOutcome([], CALL_STATUS.NO_IMPLEMENTATION, receiverKind, typed);
    return null;
  },

  isImplementedImplicitly(typeName, typeDeclarations, callee) {
    const implementations = this.findConcreteImplementations(typeName);
    if (!this.isAHierarchyWhollyInTheRepository(typeDeclarations, implementations)) return false;
    return implementations.every(typeDeclaration => this.readFieldTypeText(typeDeclaration.name, callee, this.fileByPathMap.get(typeDeclaration.path)));
  },

  isAHierarchyWhollyInTheRepository(typeDeclarations, implementations) {
    return this.haveTheirWholeHierarchyInTheRepository(typeDeclarations)
      && implementations.length > 0 && this.haveTheirWholeHierarchyInTheRepository(implementations);
  },

  haveTheirWholeHierarchyInTheRepository(typeDeclarations) {
    return typeDeclarations.every(typeDeclaration => this.findOutsideSupertypes(typeDeclaration).length === 0);
  },

  findConcreteImplementations(typeName) {
    return this.findImplementations(typeName).flatMap(name => (this.typesByNameMap.get(name) || []).filter(typeDeclaration => !isAbstract(typeDeclaration)));
  },

  findInterfaceResult(type, typeFile, callee) {
    const pending = this.findDeclarationsOfType(type, typeFile).slice();
    const seen = new Set();
    while (pending.length) {
      const typeDeclaration = pending.shift();
      if (seen.has(typeDeclaration) || !typeDeclaration.interfaceResults) continue;
      seen.add(typeDeclaration);
      const results = typeDeclaration.interfaceResults.resultsByMethodMap.get(callee);
      if (results && results[0]) return { text: results[0], file: this.fileByPathMap.get(typeDeclaration.path) };
      for (const name of typeDeclaration.interfaceResults.embedded) {
        const embedded = parseType(name);
        if (embedded) pending.push(...this.findDeclarationsOfType(embedded, this.fileByPathMap.get(typeDeclaration.path)));
      }
    }
    return null;
  },

  findCappedCallTargetsDeclaredInType(typeName, name, folder) {
    return readIds(capTheCallTargets(this.findOwnMethodsNamed(typeName, name, folder)));
  },

  findCappedCallTargetsInTypeAndImplementations(typeName, name, folder) {
    const declared = this.findOwnMethodsNamed(typeName, name, folder);
    const implemented = this.findImplementations(typeName).flatMap(subtype => this.findMethodsOfTheTypeNamed(subtype, name));
    return {
      targets: readIds(capTheTargetsOfATypeAndItsImplementations(declared, implemented)),
      fanOut: fansOutPastTheCap(collectEveryCallTarget(declared, implemented)),
      implemented: implemented.length > 0,
    };
  },
};
