import { buildMemberReadPattern } from "../decisions/SameDecisionWalk.mjs";
import { readApplicationName, compareByPathAndLine, callsTheRoute, findDeployableFolder, findInnermostMethodAt, isADecisionLine, isAFileWithBehavior, isALanguageWordOrAnEverydayName, isAReliableRoute, readLanguageFamily, formatPlaceKey, formatDisplayNameOfMethod, searchWordOf } from "../../../../../code/index.mjs";
import { readNumberedLines } from "./EntryBoundaryFills.mjs";
import { findDeclarationsReadByTheLine, ImportedConstantLookup } from "./ConditionReading.mjs";

export const MAX_QUERY_PLACES = 3;
export const MAX_READ_PLACES = 6;
export const LINES_OF_CONTEXT = 6;
export const MIN_SEARCHED_NAME_LENGTH = 4;
export const MAX_INPUT_OBJECT_LINES = 20;

export const NOT_SEARCHED = Object.freeze({
  COMMON_NAME: "common name, not searched",
  SHORT_PATH: "short path, not searched",
});

const STOPS = Object.freeze({ QUERY: "query place limit", CALL: "call place limit", READ: "read place limit" });

const compareDecisionsFirst = (left, right) => Number(right.decision) - Number(left.decision) || compareByPathAndLine(left, right);

const keepOnceEach = places => [...new Map(places.map(place => [formatPlaceKey(place), place])).values()];

const isTooShortToSearch = name => name.length < MIN_SEARCHED_NAME_LENGTH;

const isNotWorthSearching = name => isTooShortToSearch(name) || isALanguageWordOrAnEverydayName(name);

const readLastLine = lines => (lines.length && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length);

const buildNothingFound = notSearched => ({ callers: [], notSearched, stopped: [] });

const NO_PLACES = Object.freeze({ notSearched: "", byApplication: [] });

const namesTheWord = (text, word) => new RegExp(`(?<![\\w$])${word}(?![\\w$])`).test(text);

const collectTypedVariables = (text, typeName) => [...String(text).matchAll(new RegExp(`\\$([A-Za-z_]\\w*)\\s*:\\s*\\[?\\s*${typeName}(?![\\w$])`, "g"))]
  .map(match => match[1]);

const findKeyColumn = (text, name) => {
  const match = new RegExp(`(?:^|[{,])\\s*(${name})\\s*(?::|(?=[,}]|$))`, "d").exec(text);
  return match ? match.indices[1][0] : -1;
};

const findTheOpenerOfTheObject = (lines, line, column) => {
  let depth = 0;
  for (let at = line; at >= Math.max(1, line - MAX_INPUT_OBJECT_LINES + 1); at--) {
    const text = String(lines[at - 1] ?? "");
    for (let index = (at === line ? column : text.length) - 1; index >= 0; index--) {
      if (text[index] === "}") depth++;
      else if (text[index] === "{" && depth === 0) return text.slice(0, index).trimEnd();
      else if (text[index] === "{") depth--;
    }
  }
  return null;
};

const declaresTheType = (opener, typeName) => new RegExp(`(?:type|interface|class|input)\\s+${typeName}(?![\\w$])`).test(opener);

const opensTheInputObject = (opener, typeName, variableNames) => (namesTheWord(opener, typeName) && !declaresTheType(opener, typeName))
  || variableNames.some(variable => new RegExp(`(?<![\\w$])${variable}\\s*[:=]$`).test(opener));

export function isAFieldOfTheInputObject(lines, line, name, typeName, variableNames) {
  const column = findKeyColumn(String(lines[line - 1] ?? ""), name);
  if (column < 0) return false;
  const opener = findTheOpenerOfTheObject(lines, line, column);
  return opener !== null && opensTheInputObject(opener, typeName, variableNames);
}

export class EntryBoundaryCallers {
  constructor(repositoryText, testCode, callGraphOf, roots, references) {
    this.repositoryText = repositoryText;
    this.testCode = testCode;
    this.findCallGraph = callGraphOf;
    this.roots = roots;
    this.references = references;
    this.importedConstantLookup = new ImportedConstantLookup(repositoryText, testCode, roots, references);
  }

  isACallerPlace(place, applicationFolder) {
    const folder = findDeployableFolder(place.path, this.roots);
    return folder !== null && folder !== applicationFolder && !this.testCode.isTestPlace(place);
  }

  buildPlaceWithContext(place, decision) {
    const lines = this.repositoryText.readFileLines(place.path) || [];
    const around = Math.floor(LINES_OF_CONTEXT / 2);
    const method = isAFileWithBehavior(place.path) ? findInnermostMethodAt(this.findCallGraph(readLanguageFamily(place.path)), place.path, place.line) : null;
    const shown = readNumberedLines(lines, Math.max(1, place.line - around), Math.min(readLastLine(lines), place.line + around));
    const text = String(lines[place.line - 1] ?? place.text);
    const declaredAbove = decision ? findDeclarationsReadByTheLine(this.references, place.path, lines, place.line, shown) : [];
    return {
      path: place.path,
      line: place.line,
      text,
      displayName: method ? formatDisplayNameOfMethod(method) : "",
      decision,
      lines: shown,
      declaredAbove,
      declaredInAnotherFile: decision ? this.importedConstantLookup.findDeclaredLinesRead(place.path, lines, [{ line: place.line, text }, ...declaredAbove]) : [],
    };
  }

  buildCaller(application, reached, read, reachedStop) {
    const stopped = [];
    if (reached.length > MAX_QUERY_PLACES) stopped.push(`${reachedStop} in ${application}`);
    if (read.length > MAX_READ_PLACES) stopped.push(`${STOPS.READ} in ${application}`);
    return {
      caller: {
        application,
        reached: reached.slice(0, MAX_QUERY_PLACES).map(place => this.buildPlaceWithContext(place, false)),
        readPlaces: [...read].sort(compareDecisionsFirst).slice(0, MAX_READ_PLACES).map(place => this.buildPlaceWithContext(place, place.decision)),
      },
      stopped,
    };
  }

  groupByApplication(places) {
    const placesByApplicationMap = new Map();
    for (const place of places) {
      const application = readApplicationName(place.path, this.roots);
      if (!placesByApplicationMap.has(application)) placesByApplicationMap.set(application, []);
      placesByApplicationMap.get(application).push(place);
    }
    return [...placesByApplicationMap].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  }

  gatherCallers(builtCallers) {
    return { callers: builtCallers.map(builtCaller => builtCaller.caller), notSearched: "", stopped: builtCallers.flatMap(builtCaller => builtCaller.stopped) };
  }

  findCallerPlacesOfName(name, applicationFolder) {
    return keepOnceEach(this.references.findPlacesNamedAnywhere(name).filter(place => this.isACallerPlace(place, applicationFolder)));
  }

  readLineText(place) {
    return String(this.repositoryText.readFileLines(place.path)?.[place.line - 1] ?? place.text);
  }

  findApplication(place) {
    return readApplicationName(place.path, this.roots);
  }

  groupQueriesByApplication(queries, reads) {
    const readsOf = application => reads.filter(place => this.findApplication(place) === application);
    return this.groupByApplication(queries).map(([application, applicationQueries]) => ({ application, queries: applicationQueries.sort(compareByPathAndLine), reads: readsOf(application) }));
  }

  findGraphQlPlaces(name, applicationFolder) {
    if (isNotWorthSearching(name)) return { ...NO_PLACES, notSearched: NOT_SEARCHED.COMMON_NAME };
    const found = this.findCallerPlacesOfName(name, applicationFolder);
    const isAQueryPlace = place => this.references.lines.isAQueryPlaceOf(place, name);
    const queries = found.filter(isAQueryPlace);
    const memberRead = buildMemberReadPattern(name);
    const reads = found.filter(place => !isAQueryPlace(place) && memberRead.test(place.text))
      .map(place => ({ ...place, decision: isADecisionLine(place.text) }));
    return { notSearched: "", byApplication: this.groupQueriesByApplication(queries, reads) };
  }

  collectInputObjectVariablesIn(queries, typeName, application) {
    return [...new Set(queries.filter(place => this.findApplication(place) === application)
      .flatMap(place => collectTypedVariables(this.readLineText(place), typeName)))];
  }

  readsOfTheInputField(named, name, typeName, queries) {
    return named.filter(place => !this.references.lines.isAQueryPlaceOf(place, name)
      && isAFieldOfTheInputObject(this.repositoryText.readFileLines(place.path) || [], place.line, name, typeName, this.collectInputObjectVariablesIn(queries, typeName, this.findApplication(place))));
  }

  findDecisionMarkedReadsOfTheInputField(named, name, typeName, queries) {
    return this.readsOfTheInputField(named, name, typeName, queries).map(place => this.addTheDecisionMark(place));
  }

  addTheDecisionMark(place) {
    return { ...place, decision: isADecisionLine(this.readLineText(place)) };
  }

  findInputFieldPlaces(name, typeName, applicationFolder) {
    if (isNotWorthSearching(name)) return { ...NO_PLACES, notSearched: NOT_SEARCHED.COMMON_NAME };
    const typed = this.findCallerPlacesOfName(typeName, applicationFolder);
    const named = this.findCallerPlacesOfName(name, applicationFolder);
    const queries = typed.filter(place => this.references.lines.isAQueryPlaceOf(place, typeName));
    const reads = this.findDecisionMarkedReadsOfTheInputField(named, name, typeName, queries);
    return { notSearched: "", byApplication: this.groupQueriesByApplication(queries, reads) };
  }

  collectCallersOfPlaces(found) {
    if (found.notSearched) return buildNothingFound(found.notSearched);
    return this.gatherCallers(found.byApplication.map(({ application, queries, reads }) => this.buildCaller(application, queries, reads, STOPS.QUERY)));
  }

  findGraphQlCallers(name, applicationFolder) {
    return this.collectCallersOfPlaces(this.findGraphQlPlaces(name, applicationFolder));
  }

  findInputFieldCallers(name, typeName, applicationFolder) {
    return this.collectCallersOfPlaces(this.findInputFieldPlaces(name, typeName, applicationFolder));
  }

  findDecisionPlacesOfTheEnclosingMethod(place) {
    const callGraph = this.findCallGraph(readLanguageFamily(place.path));
    const method = findInnermostMethodAt(callGraph, place.path, place.line);
    if (!method) return [];
    const lines = this.repositoryText.readFileLines(place.path) || [];
    const places = [];
    for (let line = method.line; line <= method.to; line++) {
      const text = String(lines[line - 1] ?? "");
      if (line !== place.line && isADecisionLine(text)) places.push({ path: place.path, line, text, decision: true });
    }
    return places;
  }

  findRestCallers(route, applicationFolder) {
    if (!isAReliableRoute(route)) return buildNothingFound(NOT_SEARCHED.SHORT_PATH);
    const calls = keepOnceEach(this.references.findRoutePlacesHolding(searchWordOf(route)).filter(place => this.isACallerPlace(place, applicationFolder)))
      .filter(place => callsTheRoute(this.repositoryText.readFileLines(place.path)?.[place.line - 1] ?? place.text, route));
    return this.gatherCallers(this.groupByApplication(calls).map(([application, applicationCalls]) => {
      const sorted = applicationCalls.sort(compareByPathAndLine);
      const reads = keepOnceEach(sorted.flatMap(place => this.findDecisionPlacesOfTheEnclosingMethod(place)));
      return this.buildCaller(application, sorted, reads, STOPS.CALL);
    }));
  }
}
