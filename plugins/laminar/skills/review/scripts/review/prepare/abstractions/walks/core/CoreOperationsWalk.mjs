import { CHANGE_KINDS, findDriver, readLanguageFamily, namesTheApiSpiTypeAsASupertype, Scale, readSignature } from "../../../../../code/index.mjs";
import { CoreFolders } from "./CoreFolders.mjs";
import { MethodCallers } from "../../references/MethodCallers.mjs";
import { ONLY_CALLS } from "../CallWalks.mjs";
import { FileLines, listLinesFromTo } from "../../lookups/FileLines.mjs";
import { groupBy } from "../../../../../collections/groupedLists.mjs";

export const MAX_NEIGHBOURS = 3;

const CHANGE_KINDS_BY_STRENGTH = [CHANGE_KINDS.CREATED, CHANGE_KINDS.BOUNDARY_CHANGED, CHANGE_KINDS.INTERNALS_CHANGED];

const isAChangedOperation = abstraction => abstraction.scale === Scale.METHOD.name && !abstraction.isTest && Boolean(abstraction.lines)
  && CHANGE_KINDS_BY_STRENGTH.includes(abstraction.changeKind) && Boolean(findDriver(abstraction.path));

const CONSTRUCTOR_NAMES = new Set(["constructor", "__init__", "init", "new", "initialize"]);

const isAnOperation = method => Boolean(method.enclosingTypeName) && method.name !== method.enclosingTypeName && !CONSTRUCTOR_NAMES.has(method.name);

const isWithinTheCore = (filePath, core) => core.folders.some(folder => filePath.startsWith(`${folder}/`));

const readCoreKey = core => core.folders.join("+");

const readBoundaryKey = boundary => `${boundary.path}:${boundary.line}`;

const readNumberedLines = (lines, from, to) => {
  const numbered = [];
  for (let line = from; line <= to; line++) numbered.push({ line, text: String(lines[line - 1] || "") });
  return numbered;
};

const readSpan = type => ({ name: type.name, path: type.path, from: type.line, to: type.to });

const findStrongest = kinds => CHANGE_KINDS_BY_STRENGTH.find(kind => kinds.includes(kind)) || kinds[0];

const countShared = (left, right) => left.filter(name => right.includes(name)).length;

const selectShownNeighbours = (ranked, typeNames) => {
  const sharing = ranked.filter(neighbour => countShared(neighbour.typeNames, typeNames) > 0);
  return (sharing.length ? sharing : ranked.slice(0, 1)).slice(0, MAX_NEIGHBOURS);
};

class FamilyCoreOperationsWalk {
  constructor(repositoryText, testCode, callGraph, startOf, references, callWalks) {
    this.fileLines = new FileLines(repositoryText);
    this.callGraph = callGraph;
    this.callWalks = callWalks;
    this.folders = new CoreFolders(callGraph, startOf);
    this.callers = new MethodCallers(repositoryText, testCode, callGraph, references);
    this.filesByPathMap = new Map((callGraph.files || []).map(file => [file.path, file]));
    this.operationsByCoreMap = new Map();
    this.typesByPathMap = groupBy(callGraph.types || [], type => type.path);
  }

  readFileLines(filePath) {
    return this.fileLines.readFileLines(filePath);
  }

  findEnclosingType(method) {
    return (this.typesByPathMap.get(method.path) || []).filter(type => type.name === method.enclosingTypeName)
      .sort((left, right) => Math.abs(left.line - method.line) - Math.abs(right.line - method.line))[0] || null;
  }

  findTypesNamed(name) {
    return (this.callGraph.types || []).filter(type => type.name === name);
  }

  findMethod(type, name) {
    const found = (this.callGraph.methodsByPathMap.get(type.path) || []).find(method => method.enclosingTypeName === type.name && method.name === name);
    if (found) return found;
    const known = (type.declaredByKeyMap || []).find(declaredMember => declaredMember.name === name);
    return known ? { id: null, path: type.path, name, enclosingTypeName: type.name, line: known.line, to: known.line, calls: [] } : null;
  }

  findMethodOfAbstraction(abstraction) {
    const method = this.callGraph.findMethodDeclaredAt(abstraction.path, abstraction.lines.from);
    if (method) return method;
    const abstractType = (this.typesByPathMap.get(abstraction.path) || []).find(type => type.abstract && abstraction.lines.from >= type.line && abstraction.lines.from <= type.to);
    const known = abstractType ? this.findMethod(abstractType, abstraction.name) : null;
    return known && known.line === abstraction.lines.from ? known : null;
  }

  findSharedCore(paths) {
    return this.folders.findCores(paths[0]).find(core => paths.every(filePath => isWithinTheCore(filePath, core))) || null;
  }

  findImplementation(apiSpiType, name) {
    for (const type of (this.callGraph.types || []).filter(type => !type.abstract && namesTheApiSpiTypeAsASupertype(type, apiSpiType))) {
      const core = this.findSharedCore([apiSpiType.path, type.path]);
      if (core) return { implementation: type, core, implementationMethod: this.findMethod(type, name) };
    }
    return null;
  }

  findApiSpiType(type, name) {
    for (const supertype of type.supertypes) {
      for (const apiSpiType of this.findTypesNamed(supertype).filter(namedType => namedType.abstract)) {
        const apiSpiMethod = this.findMethod(apiSpiType, name);
        const core = apiSpiMethod ? this.findSharedCore([apiSpiType.path, type.path]) : null;
        if (core) return { apiSpiType, apiSpiMethod, core };
      }
    }
    return null;
  }

  findOperation(method) {
    if (!isAnOperation(method)) return null;
    const enclosingType = this.findEnclosingType(method);
    if (!enclosingType) return null;
    if (enclosingType.abstract) {
      const found = this.findImplementation(enclosingType, method.name);
      if (!found || !found.implementationMethod) return null;
      return { boundary: enclosingType, implementation: found.implementation, core: found.core, name: method.name, methods: [method, found.implementationMethod] };
    }
    const foundApiSpi = this.findApiSpiType(enclosingType, method.name);
    if (foundApiSpi) return { boundary: foundApiSpi.apiSpiType, implementation: enclosingType, core: foundApiSpi.core, name: method.name, methods: [foundApiSpi.apiSpiMethod, method] };
    const core = this.folders.findCores(method.path)[0];
    return core ? { boundary: enclosingType, implementation: null, core, name: method.name, methods: [method] } : null;
  }

  reachesTheOperation(callerPath, operation) {
    const typePaths = [operation.boundary.path, ...(operation.implementation ? [operation.implementation.path] : [])];
    const file = this.filesByPathMap.get(callerPath);
    return Boolean(file) && typePaths.some(typePath => file.imports.includes(typePath));
  }

  findCallersOutside(operation) {
    return operation.methods.filter(method => method.id !== null)
      .flatMap(method => this.callers.findCallers(method).callers)
      .filter(caller => !isWithinTheCore(caller.path, operation.core) && this.reachesTheOperation(caller.path, operation));
  }

  readSignatureOfOperation(operation) {
    const known = operation.methods[operation.methods.length - 1];
    const driver = findDriver(known.path);
    return readSignature(this.readFileLines(known.path), known, driver ? driver.diffDriver : "");
  }

  collectCalledOperations(core) {
    const key = readCoreKey(core);
    if (!this.operationsByCoreMap.has(key)) {
      const operationsByKeyMap = new Map();
      for (const method of this.callGraph.methods.filter(method => isWithinTheCore(method.path, core))) {
        const operation = this.findOperation(method);
        if (!operation || readCoreKey(operation.core) !== key || !this.findCallersOutside(operation).length) continue;
        const operationKey = `${readBoundaryKey(operation.boundary)}#${operation.name}`;
        if (!operationsByKeyMap.has(operationKey)) operationsByKeyMap.set(operationKey, { ...operation, signature: this.readSignatureOfOperation(operation) });
      }
      this.operationsByCoreMap.set(key, [...operationsByKeyMap.values()]);
    }
    return this.operationsByCoreMap.get(key);
  }

  readDisplayName(operation) {
    return `${operation.boundary.name}#${operation.name}`;
  }

  producesItsOwnType(operation, other) {
    const ownNames = [operation.boundary.name, ...(operation.implementation ? [operation.implementation.name] : [])];
    return ownNames.includes(other.boundary.name) || (other.implementation && ownNames.includes(other.implementation.name))
      || other.signature.returnNames.some(name => ownNames.includes(name));
  }

  findOwnOutput(operations, core) {
    const others = this.collectCalledOperations(core);
    const found = [];
    for (const operation of operations) {
      const signature = this.readSignatureOfOperation(operation);
      for (const other of others) {
        if (this.producesItsOwnType(operation, other)) continue;
        const taken = signature.parameters.find(parameter => other.signature.returnNames.some(name => parameter.typeNames.includes(name)));
        if (taken) found.push({ operation: this.readDisplayName(operation), parameterType: taken.typeText, resultOf: this.readDisplayName(other) });
      }
    }
    return found;
  }

  collectHelperIds(ids, type) {
    const reached = new Set(ids.filter(id => id !== null));
    const follows = step => ONLY_CALLS(step) && step.callee.path === type.path && step.callee.enclosingTypeName === type.name;
    for (const step of this.callWalks.walkCallsDown(this.callGraph, [...reached].map(id => this.callGraph.methods[id]), { follows })) {
      if (step.relation) reached.add(step.callee.id);
    }
    return [...reached];
  }

  readImplementationLines(type, methodIds) {
    const helperLines = this.collectHelperIds(methodIds, type).flatMap(id => listLinesFromTo(this.callGraph.methods[id].line, this.callGraph.methods[id].to));
    return this.fileLines.readUntrimmedLinesInOrder(type.path, [type.line, ...helperLines]);
  }

  readHeadLines(type, methods) {
    return this.fileLines.readUntrimmedLinesInOrder(type.path, [type.line, ...methods.map(method => method.line)]);
  }

  readApiSpiLines(boundary, implementation) {
    return implementation ? readNumberedLines(this.readFileLines(boundary.path), boundary.line, boundary.to) : [];
  }

  buildNeighbour(operations) {
    const [first] = operations;
    const implementation = first.implementation;
    const implementedMethods = operations.map(operation => operation.methods[operation.methods.length - 1]);
    return {
      name: first.boundary.name,
      path: first.boundary.path,
      from: first.boundary.line,
      to: first.boundary.to,
      implementation: implementation ? readSpan(implementation) : null,
      interfaceLines: this.readApiSpiLines(first.boundary, implementation),
      implementationLines: this.readHeadLines(implementation || first.boundary, implementedMethods),
      typeNames: [...new Set(operations.flatMap(operation => operation.signature.typeNames))],
    };
  }

  listNeighbours(boundary, core, typeNames) {
    const operationsByBoundaryMap = new Map();
    for (const operation of this.collectCalledOperations(core)) {
      const key = readBoundaryKey(operation.boundary);
      if (key === readBoundaryKey(boundary)) continue;
      if (!operationsByBoundaryMap.has(key)) operationsByBoundaryMap.set(key, []);
      operationsByBoundaryMap.get(key).push(operation);
    }
    return [...operationsByBoundaryMap.values()].map(operations => this.buildNeighbour(operations))
      .sort((left, right) => countShared(right.typeNames, typeNames) - countShared(left.typeNames, typeNames)
        || left.path.localeCompare(right.path) || left.from - right.from);
  }

  buildRelation(operationsOfTheBoundary) {
    const [{ operation }] = operationsOfTheBoundary;
    const operations = [...new Map(operationsOfTheBoundary.map(boundaryOperation => [boundaryOperation.operation.name, boundaryOperation.operation])).values()];
    const typeNames = [...new Set(operations.flatMap(boundaryOperation => this.readSignatureOfOperation(boundaryOperation).typeNames))];
    const neighbours = this.listNeighbours(operation.boundary, operation.core, typeNames);
    const implementationType = operation.implementation || operation.boundary;
    return {
      abstractionIds: [...new Set(operationsOfTheBoundary.map(boundaryOperation => boundaryOperation.abstraction.id))],
      displayName: operation.boundary.name,
      name: operation.boundary.name,
      path: operation.boundary.path,
      from: operation.boundary.line,
      to: operation.boundary.to,
      changeKind: findStrongest(operationsOfTheBoundary.map(boundaryOperation => boundaryOperation.abstraction.changeKind)),
      core: { level: operation.core.level, folders: operation.core.folders, importedBy: operation.core.importedBy },
      implementation: operation.implementation ? readSpan(operation.implementation) : null,
      operations: operations.map(boundaryOperation => ({ displayName: this.readDisplayName(boundaryOperation), path: boundaryOperation.methods[0].path, from: boundaryOperation.methods[0].line, to: boundaryOperation.methods[0].to })),
      ownOutput: this.findOwnOutput(operations, operation.core),
      interfaceLines: this.readApiSpiLines(operation.boundary, operation.implementation),
      implementationLines: this.readImplementationLines(implementationType, operations.map(boundaryOperation => boundaryOperation.methods[boundaryOperation.methods.length - 1].id)),
      neighbourCount: neighbours.length,
      neighbours: selectShownNeighbours(neighbours, typeNames).map(({ typeNames: shared, ...kept }) => kept),
    };
  }

  findRelations(abstractions) {
    const operationsByBoundaryMap = new Map();
    for (const abstraction of abstractions) {
      const method = this.findMethodOfAbstraction(abstraction);
      if (!method) continue;
      const operation = this.findOperation(method);
      if (!operation || !this.findCallersOutside(operation).length) continue;
      const key = readBoundaryKey(operation.boundary);
      if (!operationsByBoundaryMap.has(key)) operationsByBoundaryMap.set(key, []);
      operationsByBoundaryMap.get(key).push({ abstraction, operation });
    }
    return [...operationsByBoundaryMap.values()].map(operationsOfTheBoundary => this.buildRelation(operationsOfTheBoundary));
  }
}

export class CoreOperationsWalk {
  constructor(repositoryText, testCode, callGraphOf, startOf, references, callWalks) {
    this.repositoryText = repositoryText;
    this.testCode = testCode;
    this.findCallGraph = callGraphOf;
    this.startOf = startOf;
    this.references = references;
    this.callWalks = callWalks;
    this.familyWalkByFamilyMap = new Map();
  }

  getOrBuildFamilyWalk(family) {
    if (!this.familyWalkByFamilyMap.has(family)) {
      const callGraph = this.findCallGraph(family);
      this.familyWalkByFamilyMap.set(family, callGraph ? new FamilyCoreOperationsWalk(this.repositoryText, this.testCode, callGraph, this.startOf, this.references, this.callWalks) : null);
    }
    return this.familyWalkByFamilyMap.get(family);
  }

  findRelations(abstractions) {
    const abstractionsByFamilyMap = new Map();
    for (const abstraction of abstractions.filter(isAChangedOperation)) {
      const family = readLanguageFamily(abstraction.path);
      if (!abstractionsByFamilyMap.has(family)) abstractionsByFamilyMap.set(family, []);
      abstractionsByFamilyMap.get(family).push(abstraction);
    }
    return [...abstractionsByFamilyMap].flatMap(([family, changedAbstractions]) => {
      const familyWalk = this.getOrBuildFamilyWalk(family);
      return familyWalk ? familyWalk.findRelations(changedAbstractions) : [];
    });
  }
}
