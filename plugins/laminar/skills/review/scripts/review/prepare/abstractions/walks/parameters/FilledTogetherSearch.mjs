import { findInnermostMethodAt, readLanguageFamily, formatDisplayNameOfMethod, doesSpanHoldLine } from "../../../../../code/index.mjs";
import { listLinesFromTo } from "../../lookups/FileLines.mjs";

const isInsideTheOwnSpans = (place, own) => own.some(span => span.path === place.path && doesSpanHoldLine(span, place.line));

export class FilledTogetherSearch {
  constructor(repositoryText, testCode, callGraphOf, references, fileLines, typeAbstractions) {
    this.repositoryText = repositoryText;
    this.testCode = testCode;
    this.findCallGraph = callGraphOf;
    this.references = references;
    this.fileLines = fileLines;
    this.typeAbstractions = typeAbstractions;
  }

  findEnclosingMethod(place) {
    const callGraph = this.findCallGraph(readLanguageFamily(place.path));
    return findInnermostMethodAt(callGraph, place.path, place.line);
  }

  findPlacesNaming(type) {
    return this.references.findNamingPlaces(type.name, readLanguageFamily(type.path)).filter(place => this.typeAbstractions.isTheTypeInScopeAt(type, place.path));
  }

  findProductionPlacesOutsideTheOwnSpans(type, own) {
    return this.findPlacesNaming(type).filter(place => !this.testCode.isTestPlace(place) && !isInsideTheOwnSpans(place, own));
  }

  collectCallsOfOperations(type) {
    return type.operations.flatMap(operation => {
      const callGraph = this.findCallGraph(operation.family);
      return callGraph ? callGraph.readRepeatedCallers(operation.id).map(({ method, call }) => {
        const caller = callGraph.methods[method];
        return { path: caller.path, line: caller.calls[call].line, method: caller };
      }) : [];
    });
  }

  findBlocksFilledTogether(type, twins) {
    const own = [type, ...twins];
    const fillGroupsByPlaceMap = new Map();
    const hold = (named, place, method) => {
      const key = method ? `${method.path}:${method.line}` : place.path;
      if (!fillGroupsByPlaceMap.has(key)) fillGroupsByPlaceMap.set(key, { method, path: place.path, linesByNameMap: new Map() });
      const linesByTypeNameMap = fillGroupsByPlaceMap.get(key).linesByNameMap;
      if (!linesByTypeNameMap.has(named.name)) linesByTypeNameMap.set(named.name, []);
      linesByTypeNameMap.get(named.name).push(place.line);
    };
    for (const named of own) {
      for (const place of this.findProductionPlacesOutsideTheOwnSpans(named, own)) hold(named, place, this.findEnclosingMethod(place));
      for (const place of this.collectCallsOfOperations(named)) hold(named, place, place.method);
    }
    return [...fillGroupsByPlaceMap.values()]
      .filter(fillGroup => fillGroup.linesByNameMap.has(type.name) && fillGroup.linesByNameMap.size > 1)
      .map(fillGroup => this.buildTheBlockOfTheFillGroup(fillGroup));
  }

  buildTheBlockOfTheFillGroup({ method, path: filePath, linesByNameMap }) {
    const namedLines = [...linesByNameMap.values()].flat();
    return {
      displayName: method ? formatDisplayNameOfMethod(method) : "",
      path: filePath,
      from: method ? method.line : Math.min(...namedLines),
      to: method ? method.to : Math.max(...namedLines),
      names: [...linesByNameMap].map(([name, lines]) => ({ name, lines: [...new Set(lines)].sort((left, right) => left - right) })),
      lines: this.fileLines.readUntrimmedLinesInOrder(filePath, method ? listLinesFromTo(method.line, method.to) : namedLines),
    };
  }
}
