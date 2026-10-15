import { buildShortenedPlace, CHANGE_KINDS, findDiffDriver, findDriver, isTestPath, readLanguageFamily, readSignature, Scale } from "../../../../../code/index.mjs";
import { FileLines, listLinesFromTo } from "../../lookups/FileLines.mjs";
import { MethodCallers } from "../../references/MethodCallers.mjs";
import { readCarriedMember } from "../parameters/CarrierTypeSearch.mjs";
import { ParameterReads } from "../parameters/ParameterReads.mjs";
import { TypeAbstractions } from "../parameters/TypeAbstractions.mjs";
import { collectLoopIndexNames, findConstructionsWithAMadeUpValue, findLinesUsingTheName, findLookupsBy, findMemberFills, findTheLinePassingOut, isAMadeUpValue, resolveTheValue } from "./MatchingKeyLines.mjs";

export const KEY_ROLES = Object.freeze({ MADE: "made", CARRIED: "carried", MATCHED: "matched" });

const ROLE_ORDER = Object.values(KEY_ROLES);

export const MAX_MATCHING_KEY_PLACES = 16;

const isAJudgedMethod = abstraction => abstraction.scale === Scale.METHOD.name && !abstraction.isTest && abstraction.changeKind !== CHANGE_KINDS.REFERENCE
  && Boolean(abstraction.lines) && Boolean(findDriver(abstraction.path)) && !isTestPath(abstraction.path);

const readTypeKey = type => `${type.path}:${type.from}`;

const formatPlaceKey = place => `${place.path}:${place.line}`;

const compareByRoleAndPlace = (left, right) => ROLE_ORDER.indexOf(left.role) - ROLE_ORDER.indexOf(right.role)
  || (left.path < right.path ? -1 : left.path > right.path ? 1 : 0) || left.line - right.line;

const keepEachPlaceOnce = places => [...new Map(places.map(place => [`${formatPlaceKey(place)}:${place.member}`, place])).values()];

export class MatchingKeyWalk {
  constructor(repositoryText, testCode, callGraphOf, references, codeGraph) {
    this.fileLines = new FileLines(repositoryText);
    this.repositoryText = repositoryText;
    this.testCode = testCode;
    this.findCallGraph = callGraphOf;
    this.references = references;
    this.typeAbstractions = new TypeAbstractions(codeGraph, this.fileLines);
    this.reads = new ParameterReads(repositoryText, testCode, callGraphOf, references, this.typeAbstractions);
    this.callersByFamilyMap = new Map();
    this.keysByTypeMap = new Map();
  }

  findMatchingKeys(abstraction) {
    if (!isAJudgedMethod(abstraction)) return [];
    const callGraph = this.findCallGraph(readLanguageFamily(abstraction.path));
    const method = callGraph ? (callGraph.methodsByPathMap.get(abstraction.path) || []).find(found => found.name === abstraction.name && found.line >= abstraction.lines.from && found.line <= abstraction.lines.to) : null;
    if (!method) return [];
    return this.listRequestTypesOf(method).flatMap(type => this.getOrFindTheKeysOf(type));
  }

  listRequestTypesOf(method) {
    const signature = readSignature(this.fileLines.readFileLines(method.path), method, findDiffDriver(method.path) || "");
    const typeNames = [...new Set(signature.parameters.flatMap(parameter => parameter.typeNames))];
    return typeNames.map(name => this.typeAbstractions.findTheProductionTypeInScope(name, method.path)).filter(type => type && type.members.length);
  }

  getOrFindTheKeysOf(type) {
    const key = readTypeKey(type);
    if (!this.keysByTypeMap.has(key)) this.keysByTypeMap.set(key, this.findTheKeysOf(type));
    return this.keysByTypeMap.get(key);
  }

  findTheKeysOf(type) {
    const operations = this.reads.findOperations(type);
    const callers = this.listCallersOutside(operations);
    return type.members.flatMap(member => {
      const copies = this.findCopiesIntoAResult(type, operations, member);
      if (!copies.length) return [];
      const carried = copies.map(copy => copy.place);
      const fromTheCallers = callers.flatMap(caller => this.findMadeAndMatchedIn(caller, type, member, carried));
      if (!fromTheCallers.length) return [];
      const resultNames = new Set(copies.map(copy => copy.resultName));
      const places = keepEachPlaceOnce([...fromTheCallers, ...carried, ...this.findPositionsMatchedInside(operations, type, resultNames)]);
      return [{ key: `${type.name}.${member}`, places: places.sort(compareByRoleAndPlace).slice(0, MAX_MATCHING_KEY_PLACES) }];
    });
  }

  findCopiesIntoAResult(type, operations, member) {
    const readsOfTheMember = operations.flatMap(operation => operation.readPlaces.filter(place => place.member === member));
    const readWithoutAPlace = operations.some(operation => operation.reads.includes(member) && !operation.readPlaces.some(place => place.member === member));
    if (!readsOfTheMember.length || readWithoutAPlace) return [];
    const copies = readsOfTheMember.map(place => this.readTheCopy(type, place));
    return copies.every(Boolean) ? copies : [];
  }

  readTheCopy(type, readPlace) {
    const construction = this.reads.findTheConstructionOfTheRead(readPlace);
    if (!construction || construction.typeName === type.name) return null;
    const result = this.typeAbstractions.findTheProductionTypeInScope(construction.typeName, readPlace.path);
    const copiedAs = result ? readCarriedMember(construction, result.members) : "";
    return copiedAs ? { place: this.placeOf(readPlace.path, readPlace.line, KEY_ROLES.CARRIED, copiedAs), resultName: result.name } : null;
  }

  findCallersOf(callGraph, operation) {
    if (!this.callersByFamilyMap.has(callGraph.family)) this.callersByFamilyMap.set(callGraph.family, new MethodCallers(this.repositoryText, this.testCode, callGraph, this.references));
    return this.callersByFamilyMap.get(callGraph.family).findCallers(callGraph.methods[operation.id]).callers;
  }

  listCallersOutside(operations) {
    const operationIds = new Set(operations.map(operation => `${operation.family}:${operation.id}`));
    const callersById = new Map();
    for (const operation of operations) {
      const callGraph = this.findCallGraph(operation.family);
      if (!callGraph) continue;
      for (const caller of this.findCallersOf(callGraph, operation)) {
        const id = `${operation.family}:${caller.id}`;
        if (caller.id === null || operationIds.has(id) || callersById.has(id)) continue;
        callersById.set(id, callGraph.methods[caller.id]);
      }
    }
    return [...callersById.values()];
  }

  readBody(method) {
    const lines = this.fileLines.readFileLines(method.path);
    return listLinesFromTo(method.line, method.to).map(line => ({ line, text: String(lines[line - 1] ?? "") }));
  }

  findMadeAndMatchedIn(caller, type, member, carried) {
    const body = this.readBody(caller);
    const loopIndexNames = collectLoopIndexNames(body);
    const made = findMemberFills(body, type, member)
      .map(fill => ({ fill, value: resolveTheValue(body, fill, loopIndexNames) }))
      .filter(({ value }) => isAMadeUpValue(value.text, loopIndexNames));
    if (!made.length) return [];
    const madeLines = new Set(made.flatMap(({ fill, value }) => [fill.line, value.line]));
    const keptLines = made.flatMap(({ value }) => (value.name ? findLinesUsingTheName(body, value.name) : []));
    const copiedAs = [...new Set(carried.map(place => place.member))];
    const matched = findLookupsBy(body.filter(({ line }) => !madeLines.has(line)), copiedAs);
    if (!matched.length) return [];
    return [
      ...[...madeLines, ...keptLines.map(({ line }) => line)].map(line => this.placeOf(caller.path, line, KEY_ROLES.MADE, member)),
      ...matched.map(({ line }) => this.placeOf(caller.path, line, KEY_ROLES.MATCHED, copiedAs.join(", "))),
    ];
  }

  findPositionsMatchedInside(operations, type, resultNames) {
    return operations.filter(operation => operation.hasBody).flatMap(operation => {
      const body = operation.lines;
      const findTheType = name => (name === type.name || resultNames.has(name) ? null : this.typeAbstractions.findTheProductionTypeInScope(name, operation.path));
      return findConstructionsWithAMadeUpValue(body, collectLoopIndexNames(body), findTheType)
        .filter(position => position.collection)
        .flatMap(position => this.placePositionMatchedInside(operation, body, position));
    });
  }

  placePositionMatchedInside(operation, body, position) {
    const passedOut = findTheLinePassingOut(body, position.collection, position.line);
    if (!passedOut) return [];
    const matched = findLookupsBy(body.filter(({ line }) => line > passedOut.line), [position.member]);
    if (!matched.length) return [];
    return [
      this.placeOf(operation.path, position.line, KEY_ROLES.MADE, position.member),
      this.placeOf(operation.path, passedOut.line, KEY_ROLES.CARRIED, position.member),
      ...matched.map(({ line }) => this.placeOf(operation.path, line, KEY_ROLES.MATCHED, position.member)),
    ];
  }

  placeOf(filePath, line, role, member) {
    const lines = this.fileLines.readFileLines(filePath);
    return { ...buildShortenedPlace(filePath, line, String(lines[line - 1] ?? "")), role, member };
  }
}
