import { readLastSegment } from "../../../inputs/source/names/QualifiedNames.mjs";
import { readImportConventions, findMethodRelationFinder } from "../../finders/LanguageStrategies.mjs";
import { namesAType } from "../../../inputs/source/names/NamingConventions.mjs";
import { isVendored } from "../../../inputs/repository/RepositoryFileKinds.mjs";
import { findTypesEnclosingTheSpanInnermostFirst } from "../CallGraph.mjs";
import { findMethodsOfTheNearestSupertype, walkSupertypeSteps } from "./SupertypeWalk.mjs";

const readQualifierOfAType = type => (type.qualified.includes(".") ? type.qualified.slice(0, type.qualified.lastIndexOf(".")) : "");

export const DeclarationLookups = {
  findSupertypeDeclaration(type, subtype) {
    return this.findTypesNamed(type.simple, subtype.path, subtype.folder).filter(inner => inner.name === type.simple)[0];
  },

  listSupertypeDeclarationSteps(typeDeclaration, resolve = (type, subtype) => this.findSupertypeDeclaration(type, subtype)) {
    return walkSupertypeSteps(typeDeclaration, { readName: stepDeclaration => stepDeclaration.name, listSupertypes: stepDeclaration => stepDeclaration.supertypes, resolve });
  },

  findRepositoryDeclarer(typeDeclaration, name) {
    if (this.declaresTheMember(typeDeclaration, name)) return typeDeclaration;
    for (const { resolved } of this.listSupertypeDeclarationSteps(typeDeclaration)) {
      if (resolved && this.declaresTheMember(resolved, name)) return resolved;
    }
    return null;
  },

  declaresTheMember(typeDeclaration, name) {
    return this.findMethodsOfTheTypeDeclarationNamed(typeDeclaration, name).length > 0
      || this.getOrReadBodilessMembers(typeDeclaration).has(name);
  },

  isAScopeImportedFromOutside(file, scope) {
    const imported = file.findImport(scope.split(".")[0]);
    return Boolean(imported) && !this.importsFromTheRepository(file, imported);
  },

  findTypesInAScope(file, name, scope) {
    if (this.isAScopeImportedFromOutside(file, scope)) return [];
    const outers = this.findTypesNamed(readLastSegment(scope, "."), file.path, file.folder);
    const typeDeclarations = this.findOwnTypesNamed(name);
    if (outers.length) return typeDeclarations.filter(typeDeclaration => outers.some(outer => outer.path === typeDeclaration.path && outer.line <= typeDeclaration.line && outer.to >= typeDeclaration.to));
    return this.namesAModuleOfTheRepository(scope) ? this.findTypesNamed(name, file.path, file.folder) : [];
  },

  findTypeDeclarationInTheFile(method, typeName) {
    return this.findTypesNamed(typeName, method.path, method.file.folder).find(typeDeclaration => typeDeclaration.path === method.path);
  },

  findOwnTypesNamed(name) {
    return (this.typesByNameMap.get(name) || []).filter(typeDeclaration => !isVendored(typeDeclaration.path));
  },

  findTypesInScope(method, name) {
    const typeDeclarations = this.findOwnTypesNamed(name);
    const inFile = typeDeclarations.filter(typeDeclaration => typeDeclaration.path === method.path);
    if (inFile.length) return inFile;
    return findMethodRelationFinder(method.file.diffDriver).typesInFolderAreInScope ? typeDeclarations.filter(typeDeclaration => typeDeclaration.folder === method.file.folder) : [];
  },

  findEnclosingTypeNames(method) {
    if (!this.typesByPathMap) {
      this.typesByPathMap = new Map();
      for (const type of this.types) this.add(this.typesByPathMap, type.path, type);
    }
    return findTypesEnclosingTheSpanInnermostFirst(this.typesByPathMap.get(method.path) || [], method.path, { from: method.line, to: method.to })
      .filter(type => type.name !== method.enclosingTypeName)
      .map(type => type.name);
  },

  findMethodsInheritedBy(typeDeclaration, name) {
    const steps = this.listSupertypeDeclarationSteps(typeDeclaration, (type, subtype) => this.findFirstDeclarationOfTheTypeSeenFrom(type, subtype));
    return findMethodsOfTheNearestSupertype(steps, resolved => (resolved ? this.findMethodsOfTheTypeDeclarationNamed(resolved, name) : []));
  },

  findFirstDeclarationOfTheTypeSeenFrom(type, fromDeclaration) {
    return this.findDeclarationsOfType(type, this.fileByPathMap.get(fromDeclaration.path))[0];
  },

  findMethodsOfTheTypeDeclarationNamed(typeDeclaration, name) {
    return this.findMethodsOfTheTypeNamed(typeDeclaration.name, name).filter(method => method.path === typeDeclaration.path);
  },

  findDeclarationsOfType(type, file) {
    const qualifier = readQualifierOfAType(type);
    if (qualifier && file) return this.findDeclarationsOfAQualifiedType(type, file, qualifier);
    return this.findTypesNamedNear(type.simple, file);
  },

  findDeclarationsOfAQualifiedType(type, file, qualifier) {
    if (readImportConventions(file.diffDriver).importsNameFolders) return this.findTypesInTheImportedFolder(type.simple, file, qualifier);
    if (namesAType(readLastSegment(qualifier, "."))) return this.findTypesInAScope(file, type.simple, qualifier);
    return this.findTypesNamedNear(type.simple, file);
  },

  findTypesNamedNear(name, file) {
    return file ? this.findTypesNamed(name, file.path, file.folder, file) : this.findTypesNamed(name, "", "");
  },

  findTypesInTheImportedFolder(name, file, qualifier) {
    const typeDeclarations = this.findOwnTypesNamed(name);
    if (!typeDeclarations.length) return typeDeclarations;
    const home = this.findFolderOfImport(file.readImportedPath(qualifier));
    return home === null ? [] : typeDeclarations.filter(typeDeclaration => typeDeclaration.folder === home);
  },

  findTypesNamed(name, filePath, folder, file = null) {
    const typeDeclarations = this.findOwnTypesNamed(name);
    if (!typeDeclarations.length) return typeDeclarations;
    const inFile = typeDeclarations.filter(typeDeclaration => typeDeclaration.path === filePath);
    if (inFile.length) return inFile;
    const byImport = typeDeclarations.length > 1 ? this.findDeclarationsByImport(typeDeclarations, file || this.fileByPathMap.get(filePath), name) : [];
    if (byImport.length) return byImport;
    const inFolder = typeDeclarations.filter(typeDeclaration => typeDeclaration.folder === folder);
    return inFolder.length ? inFolder : typeDeclarations;
  },

  findDeclarationsByImport(typeDeclarations, file, name) {
    const imported = file ? file.findImport(name) : null;
    if (!imported || !this.importsFromTheRepository(file, imported)) return [];
    const paths = this.readPathsTheImportStandsFor(file, imported);
    return typeDeclarations.filter(typeDeclaration => paths.has(typeDeclaration.path));
  },

  readPathsTheImportStandsFor(file, imported) {
    const files = this.findFilesOfAnImport(file, imported);
    const standsFor = files.length ? files : this.findFilesOfTheImportAsAModule(file, imported);
    return new Set(standsFor.map(importedFile => importedFile.path));
  },

  findMethodsOfTheTypeNamed(typeName, name) {
    return (this.methodsByEnclosingTypeMap.get(typeName) || []).filter(method => method.name === name);
  },

  findOwnMethodsNamed(typeName, name, folder) {
    const all = this.findMethodsOfTheTypeNamed(typeName, name);
    const near = all.filter(method => method.file.folder === folder);
    return near.length ? near : all;
  },

  findImplementations(typeName) {
    const found = [];
    const seen = new Set([typeName]);
    const pending = [typeName];
    while (pending.length) {
      for (const subtype of this.subtypesByNameMap.get(pending.shift()) || []) {
        if (seen.has(subtype)) continue;
        seen.add(subtype);
        found.push(subtype);
        pending.push(subtype);
      }
    }
    return found;
  },
};
