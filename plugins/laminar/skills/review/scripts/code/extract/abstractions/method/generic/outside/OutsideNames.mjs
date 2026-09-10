import path from "node:path";
import { findMethodRelationFinder, readPackageScope } from "../../../../finders/LanguageStrategies.mjs";
import { formatBareGroupName, CALL_FORMS, CALL_STATUS, EXPRESSION_RECEIVER, formatFunctionGroupName, isAGroupOfTheFamily, namesAReceiver } from "../../../../../graph/relations/Reference.mjs";
import { namesAType } from "../../../../../inputs/source/names/NamingConventions.mjs";
import { WORDS_FOR_THE_ENCLOSING_TYPE } from "../../../../../inputs/source/names/LanguageWords.mjs";
import { findDeclarationIn } from "../../../variable/generic/types/DeclaredTypes.mjs";
import { parseType, stripATypeParameter } from "../../../../../inputs/source/text/TypeText.mjs";
import { isInMemoryType } from "../calls/InMemoryCalls.mjs";
import { readsAPath } from "../calls/CallReading.mjs";
import { escapeForAPattern } from "../../../../../inputs/source/text/PatternText.mjs";

const isADollarPrefixedLibraryName = name => /^\$/.test(name);

const readRepositoryTypeName = typeDeclaration => `${typeDeclaration.folder}.${typeDeclaration.name}`;

const isAnOriginToRead = (name, qualifier) => namesAReceiver(name) && qualifier !== EXPRESSION_RECEIVER;

const addsAnUnseenOrigin = (seen, method, name, qualifier) => {
  const key = `${method.id}\u0000${qualifier}\u0000${name}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
};

const buildTextualDeclarationPattern = name => {
  const word = escapeForAPattern(name);
  return new RegExp(`(?:^|[^\\w$.])(?:const|let|var|val|function|class|def|global|nonlocal)\\s+${word}(?![\\w$])|[{,(]\\s*${word}\\s*[,})=:]|(?<![\\w$.])${word}\\s*(?:=>|->)|^\\s*${word}\\s*(?:,[^=]*)?=(?!=)`);
};

const isDeclaredInTheText = (code, name) => {
  const declared = buildTextualDeclarationPattern(name);
  return code.some(line => line.includes(name) && declared.test(line));
};

export const OutsideNames = {
  findNamesOfAMemberOfAResult(method, qualifierTyping, name) {
    const named = qualifierTyping.result && qualifierTyping.result.text ? this.findNamesOfATypeText({ file: qualifierTyping.result.file || method.file, line: method.line }, qualifierTyping.result.text, false) : [];
    const names = named.length ? named : qualifierTyping.names.filter(qualifiedName => !isAGroupOfTheFamily(qualifiedName));
    return names.map(qualifiedName => `${qualifiedName}.${name}`);
  },

  findNamesOfAnOrigin(method, index, name, qualifier, seen, element = false) {
    if (!isAnOriginToRead(name, qualifier) || !addsAnUnseenOrigin(seen, method, name, qualifier)) return [];
    const file = method.file;
    if (WORDS_FOR_THE_ENCLOSING_TYPE.has(qualifier)) {
      const text = method.enclosingTypeName ? this.readFieldTypeText(method.enclosingTypeName, name, file) : "";
      if (text) return this.findNamesOfATypeText(method, text, element);
      const assigningLine = this.findTheEnclosingTypeLineAssigningTheField(method, name);
      return assigningLine ? this.findNamesOfAnExpression(method, assigningLine.at, assigningLine.found.expression, seen, element) : [];
    }
    if (qualifier) return this.findNamesOfAnOrigin(method, index, qualifier, "", seen).map(qualifierName => `${qualifierName}.${name}`);
    if (WORDS_FOR_THE_ENCLOSING_TYPE.has(name)) return [];
    const text = this.readDeclaredTypeText(method, name, "", index);
    if (text) return this.findNamesOfATypeText(method, text, element, index);
    const origin = this.findRememberedOrigin(method, name, index);
    if (origin) return this.findNamesOfAnExpression(method, origin.index, origin.expression, seen, element || Boolean(origin.element));
    const imported = file.findImport(name);
    if (imported && this.importsFromTheRepository(file, imported)) return this.findNamesOfARepositoryExport(file, imported, seen);
    if (imported) return this.findNamesOfAnOutsideImport(file, imported, "full");
    if (namesAType(name)) return this.typesByNameMap.has(name) ? [] : [this.readQualifiedTypeName(file, parseType(name))];
    return this.isARuntimeGlobal(method, name) ? [name] : [];
  },

  findTheEnclosingTypeLineAssigningTheField(method, name) {
    return this.findEnclosingTypeLines(method).map(at => ({ at, found: this.findOriginOfTheOwnFieldAtTheLine(method, at, name) })).find(({ found }) => found);
  },

  findNamesOfAPath(method, index, path) {
    const own = WORDS_FOR_THE_ENCLOSING_TYPE.has(path[0]);
    const head = own ? this.findNamesOfAnOrigin(method, index, path[1], path[0], new Set()) : this.findNamesOfAnOrigin(method, index, path[0], "", new Set());
    const rest = path.slice(own ? 2 : 1);
    for (let at = rest.length - 1; at >= 0; at--) {
      const typed = this.typeThePath(method, path.slice(0, path.length - rest.length + at), index);
      const named = typed.text ? this.findNamesOfATypeText(method, typed.text, false, index) : [];
      if (named.length) return named.map(typeName => [typeName, ...rest.slice(at)].join("."));
    }
    return head.map(headName => [headName, ...rest].join("."));
  },

  findNamesOfATypeText(context, text, element, index = context.line - 1) {
    const whole = element ? this.findElementTypeText(context, text) || (isInMemoryType(parseType(text), context.file.diffDriver) ? "" : text) : text;
    const shown = stripATypeParameter(whole, this.collectTypeParametersAtTheLine(context.file, index));
    const type = parseType(shown);
    if (!type || this.findDeclarationsOfType(type, context.file).length) return [];
    return [this.readQualifiedTypeName(context.file, type)];
  },

  findNamesOfAnExpression(context, index, expression, seen, element = false) {
    const text = String(expression || "").trim()
      .replace(/^(?:(?:await|new|yield|return|typeof|try)\s+|[(!]+\s*)+/, "")
      .replace(/^([A-Za-z_$][\w$]*)\s*<[^()]*>\s*\(/, "$1(");
    const found = /^([A-Za-z_$][\w$]*)\s*(?:[?!]*\.\s*([A-Za-z_$][\w$]*))?\s*(\()?/.exec(text);
    if (!found) return [];
    const [, root, member, called] = found;
    if (WORDS_FOR_THE_ENCLOSING_TYPE.has(root)) return member && !called ? this.findNamesOfAnOrigin(context, index, member, root, seen, element) : [];
    if (!member && /^\s*\(/.test(text.slice(root.length))) {
      const imported = context.file.findImport(root);
      if (imported && !this.importsFromTheRepository(context.file, imported)) return this.findNamesOfAnOutsideImport(context.file, imported, "full");
      return this.findNamesOfARepositoryResult(context, root, seen);
    }
    const originNames = this.findNamesOfAnOrigin(context, index, root, "", seen, element && !member);
    return member && !called ? originNames.map(rootName => `${rootName}.${member}`) : originNames;
  },

  findNamesOfARepositoryResult(context, name, seen) {
    const resolution = this.resolveBareCall(context, { form: CALL_FORMS.BARE, callee: name, receiver: "", qualifier: "", root: "", chained: false });
    if (resolution.constructedType) return this.findNamesOfATypeText(context, resolution.constructedType, false);
    const found = this.findTargetReturning(resolution.targets, 0);
    return found ? this.findNamesOfATypeText(found.targetMethod, found.returned, false) : [];
  },

  findNamesOfARepositoryExport(file, imported, seen) {
    const declared = this.findDeclarationOfAnImport(file, imported, new Set());
    if (!declared) return [];
    if (declared.kind === "outside") return declared.names;
    if (declared.kind === "value") return this.findNamesOfATypeText(this.getOrAddContext(declared.file, ""), declared.text, false);
    if (declared.kind !== "origin") return [];
    const context = this.getOrAddContext(declared.file, "");
    return this.findNamesOfAnExpression(context, declared.index, declared.expression, seen);
  },

  isARuntimeGlobal(method, name) {
    const file = method.file;
    if (!findMethodRelationFinder(file.diffDriver).hasRuntimeGlobals || isADollarPrefixedLibraryName(name)) return false;
    if (this.isAValueOfTheMethod(method, name) || file.imports(name) || this.typesByNameMap.has(name)) return false;
    if (method.enclosingTypeName && this.readFieldTypeText(method.enclosingTypeName, name, file)) return false;
    return !isDeclaredInTheText(file.code, name);
  },

  findOutsideNames(method, index, call, resolution, previousNames, chainedOnNoCall = false) {
    const file = method.file;
    const status = resolution.status;
    if (call.form === CALL_FORMS.NEW && resolution.constructedType) return [this.readQualifiedTypeName(file, parseType(resolution.constructedType))];
    if (status === CALL_STATUS.NO_IMPLEMENTATION || status === CALL_STATUS.MANY_IMPLEMENTATIONS) return this.findNamesOfARepositoryType(resolution.type, resolution.typeFile || file, call.callee);
    if (status === CALL_STATUS.MODULE) {
      const named = this.findNamesOfAnOutsideImport(file, file.findImport(resolution.root), "full");
      return named.length ? named : this.findNamesOfAnOrigin(method, index, resolution.root, "", new Set());
    }
    if (status === CALL_STATUS.NONE) return this.findNamesOfABareCall(method, index, call);
    if ((status === CALL_STATUS.OUTSIDE || status === CALL_STATUS.STATIC) && resolution.type) return [this.readQualifiedTypeName(resolution.typeFile || file, resolution.type)];
    if (status === CALL_STATUS.CHAIN) {
      const named = this.findNamesOfAChainRoot(method, call, resolution, previousNames);
      if (named.length || !chainedOnNoCall) return named;
      return this.findNamesOfAnOrigin(method, index, call.indexedName || call.root, call.indexedName ? "" : call.qualifier, new Set(), Boolean(call.indexedName));
    }
    if (status === CALL_STATUS.UNKNOWN) {
      const ofAPackage = this.findNamesOfAnOutsidePackageMember(file, call);
      if (ofAPackage.length) return ofAPackage;
      const made = this.findNamesOfAReceiverMadeOutside(method, index, call);
      if (made.length) return made;
      const ofAType = this.findNamesOfAMemberOfAType(method, index, call);
      if (ofAType.length) return ofAType;
      return readsAPath(call) ? this.findNamesOfAPath(method, index, call.path) : this.findNamesOfAnOrigin(method, index, call.receiver, call.qualifier, new Set());
    }
    return [];
  },

  findNamesOfAnOutsidePackageMember(file, call) {
    if (!readPackageScope(file.diffDriver).isReceiverAPackageMember(call) || WORDS_FOR_THE_ENCLOSING_TYPE.has(call.qualifier)) return [];
    const member = file.findImport(call.qualifier);
    return member && !this.importsFromTheRepository(file, member) ? [`${member.full}.${call.receiver}`] : [];
  },

  findNamesOfABareCall(method, index, call) {
    if (call.form !== CALL_FORMS.BARE && call.form !== CALL_FORMS.COMMAND) return [];
    const imported = method.file.findImport(call.callee);
    if (imported && !this.importsFromTheRepository(method.file, imported)) return this.findNamesOfAnOutsideImport(method.file, imported, "container");
    if (call.form === CALL_FORMS.BARE) {
      const origin = this.findRememberedOrigin(method, call.callee, index);
      const named = origin ? this.findNamesOfAnExpression(method, origin.index, origin.expression, new Set()) : [];
      if (named.length) return named;
      if (origin || imported || this.isAValueOfTheMethod(method, call.callee)) return [formatFunctionGroupName(this.family)];
    }
    const supertypes = this.callsItsOwnMembersBare(method) ? this.findOutsideSupertypesOfTheEnclosingType(method) : [];
    return supertypes.length ? supertypes : [formatBareGroupName(this.family)];
  },

  findOutsideSupertypesOfTheEnclosingType(method) {
    const typeDeclaration = this.findTypeDeclarationInTheFile(method, method.enclosingTypeName);
    return typeDeclaration ? this.findOutsideSupertypeNames(typeDeclaration) : [];
  },

  findNamesOfAReceiverMadeOutside(method, index, call) {
    const { receiver, qualifier } = call;
    if (!receiver || (qualifier && !WORDS_FOR_THE_ENCLOSING_TYPE.has(qualifier))) return [];
    const file = method.file;
    const places = WORDS_FOR_THE_ENCLOSING_TYPE.has(qualifier) ? [this.findEnclosingTypeLines(method)] : [this.listLinesOfMethod(method), this.findEnclosingTypeLines(method), this.getOrReadLevelIndexes(file)];
    for (const indexes of places) {
      const found = indexes.length ? findDeclarationIn(file.code, indexes, receiver, file.diffDriver) : null;
      if (!found) continue;
      return found.call && !found.type ? this.findNamesOfAnOutsideCall(file, found.call) : [];
    }
    return [];
  },

  findNamesOfAnOutsideCall(file, text) {
    const segments = text.split(".");
    if (segments.length < 2) return [];
    const [head, ...rest] = segments;
    const imported = file.findImport(head);
    if (imported) return this.findNamesOfAnOutsideImport(file, imported, "full").map(name => `${[name, ...rest].join(".")}()`);
    if (namesAType(head) && !this.typesByNameMap.has(head)) return [`${[this.readQualifiedTypeName(file, parseType(head)), ...rest].join(".")}()`];
    return [];
  },

  findNamesOfAChainRoot(method, call, resolution, previousNames) {
    const file = method.file;
    const root = resolution.root || "";
    if (root && resolution.type && !this.findTypesNamed(resolution.type.simple, file.path, file.folder).length) return [this.readQualifiedTypeName(file, resolution.type)];
    const imported = root && !resolution.type && !WORDS_FOR_THE_ENCLOSING_TYPE.has(root) && !this.typesByNameMap.has(root) && !this.isLocal(method, root) ? file.findImport(root) : null;
    const outside = imported ? this.findNamesOfAnOutsideImport(file, imported, "full") : [];
    return outside.length ? outside : previousNames;
  },

  findNamesOfAMemberOfAType(method, index, call) {
    const qualifierText = call.qualifier;
    if (!this.isAQualifierNamingAType(method, index, qualifierText)) return [];
    return this.findTypeNamesOfTheQualifier(method, qualifierText).map(name => `${name}.${call.receiver}`);
  },

  findTypeNamesOfTheQualifier(method, qualifierText) {
    const type = parseType(qualifierText);
    return this.findTypesNamed(qualifierText, method.path, method.file.folder).length
      ? this.findNamesOfARepositoryType(type, method.file)
      : [this.readQualifiedTypeName(method.file, type)];
  },

  isAQualifierNamingAType(method, index, qualifier) {
    if (!namesAReceiver(qualifier) || WORDS_FOR_THE_ENCLOSING_TYPE.has(qualifier)) return false;
    return namesAType(qualifier) && !this.readDeclaredTypeText(method, qualifier, "", index);
  },

  findNamesOfAnOutsideImport(file, imported, importField) {
    if (!imported || !imported[importField] || this.importsFromTheRepository(file, imported)) return [];
    return [imported[importField]];
  },

  readQualifiedTypeName(file, type) {
    const segments = type.qualified.split(".");
    const imported = file.findImport(segments[0]);
    return imported ? [imported.full, ...segments.slice(1)].join(".") : type.qualified;
  },

  findNamesOfARepositoryType(type, file, callee = "") {
    const typeDeclarations = type ? this.findDeclarationsOfType(type, file) : [];
    if (!typeDeclarations.length) return type ? [this.readQualifiedTypeName(file, type)] : [];
    const [typeDeclaration] = typeDeclarations;
    const outside = this.findOutsideSupertypeNames(typeDeclaration);
    const declarer = callee ? this.findRepositoryDeclarer(typeDeclaration, callee) : null;
    if (!declarer) return [...outside, readRepositoryTypeName(typeDeclaration)];
    const receiver = declarer === typeDeclaration ? [] : [readRepositoryTypeName(typeDeclaration)];
    return [readRepositoryTypeName(declarer), ...receiver, ...outside];
  },

  findOutsideSupertypeNames(typeDeclaration) {
    const key = `${typeDeclaration.path}\u0000${typeDeclaration.name}`;
    if (!this.outsideSupertypeNamesByTypeKeyMap) this.outsideSupertypeNamesByTypeKeyMap = new Map();
    if (!this.outsideSupertypeNamesByTypeKeyMap.has(key)) this.outsideSupertypeNamesByTypeKeyMap.set(key, this.findOutsideSupertypes(typeDeclaration));
    return this.outsideSupertypeNamesByTypeKeyMap.get(key);
  },

  findOutsideSupertypes(typeDeclaration) {
    const found = [];
    for (const { type, from, resolved } of this.listSupertypeDeclarationSteps(typeDeclaration)) {
      if (resolved) continue;
      const declaringFile = this.fileByPathMap.get(from.path);
      if (declaringFile) found.push(this.readQualifiedTypeName(declaringFile, type));
    }
    return found;
  },
};
