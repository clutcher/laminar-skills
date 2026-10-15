import { compareByPathAndLine, formatPlaceKey, readLanguageFamily } from "../../../../../code/index.mjs";
import { FileLines } from "../../lookups/FileLines.mjs";
import { namesTheTypeOrItsElement, ParameterReads } from "../parameters/ParameterReads.mjs";
import { TypeAbstractions } from "../parameters/TypeAbstractions.mjs";

export const MAX_FILES_NAMING_A_TWIN = 5;

export const MAX_MAPPINGS_SHOWN = 6;

const toDeclaredType = type => ({ name: type.name, path: type.place.file, from: type.place.startLine, to: type.place.endLine });

const keepTheFirstPlaceOfEachFile = places => {
  const firstPlacesByPathMap = new Map();
  for (const place of [...places].sort(compareByPathAndLine)) if (!firstPlacesByPathMap.has(place.path)) firstPlacesByPathMap.set(place.path, place);
  return [...firstPlacesByPathMap.values()];
};

const returnsTheType = (method, typeName) => (method.returns || []).some(typeText => namesTheTypeOrItsElement(typeText, typeName));

const isDeclaredInside = (method, type) => method.path === type.path && type.from < method.line && method.line <= type.to;

const formatMethodKey = method => `${method.path}:${method.line}`;

export class NearTwinEvidence {
  constructor({ codeGraph, repositoryText, testCode, callGraphOf, references, moduleRootOf }) {
    this.testCode = testCode;
    this.findCallGraph = callGraphOf;
    this.references = references;
    this.moduleRootOf = moduleRootOf;
    this.typeAbstractions = new TypeAbstractions(codeGraph, new FileLines(repositoryText));
    this.reads = new ParameterReads(repositoryText, testCode, callGraphOf, references, this.typeAbstractions);
  }

  readTheEvidenceOfThePair(lead, twin) {
    const leadType = this.typeAbstractions.readType(toDeclaredType(lead.type));
    const twinType = this.typeAbstractions.readType(toDeclaredType(twin.type));
    return {
      namedInOtherModules: [this.findFilesOfOtherModulesNaming(leadType), this.findFilesOfOtherModulesNaming(twinType)],
      mapped: this.findTheMappingsBetween(leadType, twinType),
    };
  }

  placeInItsModule(place) {
    return { ...place, moduleRoot: this.moduleRootOf(place.path) };
  }

  findFilesOfOtherModulesNaming(type) {
    const ownModuleRoot = this.moduleRootOf(type.path);
    const namesTheType = this.typeAbstractions.isTheOnlyTypeOfItsName(type) ? () => true : place => this.typeAbstractions.isTheTypeInScopeAt(type, place.path);
    const namingPlaces = this.references.findNamingPlaces(type.name, readLanguageFamily(type.path))
      .filter(place => !this.testCode.isTestPlace(place) && this.moduleRootOf(place.path) !== ownModuleRoot && namesTheType(place));
    const firstPlaces = keepTheFirstPlaceOfEachFile(namingPlaces);
    return {
      typeName: type.name,
      places: firstPlaces.slice(0, MAX_FILES_NAMING_A_TWIN).map(place => this.placeInItsModule(place)),
      leftOut: Math.max(0, firstPlaces.length - MAX_FILES_NAMING_A_TWIN),
    };
  }

  findTheMappingsBetween(one, other) {
    const mappings = [...this.findTheMappingsFrom(one, other), ...this.findTheMappingsFrom(other, one)];
    const unique = [...new Map(mappings.map(mapping => [formatPlaceKey(mapping.head), mapping])).values()]
      .sort((left, right) => compareByPathAndLine(left.head, right.head));
    return { names: [one.name, other.name], mappings: unique.slice(0, MAX_MAPPINGS_SHOWN), leftOut: Math.max(0, unique.length - MAX_MAPPINGS_SHOWN) };
  }

  findTheMappingsFrom(source, target) {
    const operations = this.reads.findOperationsTaking(source);
    const found = operations.map(operation => this.readTheMappingOfTheOperation(operation, source, target)).filter(Boolean);
    const seen = new Set(operations.map(operation => formatMethodKey(operation.method)));
    const ownMethods = this.listTheMethodsDeclaredInside(source).filter(method => !seen.has(formatMethodKey(method)) && returnsTheType(method, target.name));
    return [...found, ...ownMethods.map(method => this.buildTheMapping(method, method.line))];
  }

  listTheMethodsDeclaredInside(type) {
    const callGraph = this.findCallGraph(readLanguageFamily(type.path));
    return callGraph ? (callGraph.methodsByPathMap.get(type.path) || []).filter(method => isDeclaredInside(method, type)) : [];
  }

  readTheMappingOfTheOperation(operation, source, target) {
    const { method } = operation;
    if (returnsTheType(method, target.name)) return this.buildTheMapping(method, method.line);
    const { readPlaces } = this.reads.findOperation(operation, source.members, source.name);
    const buildingRead = readPlaces.find(place => place.path === method.path && place.methodLine === method.line && (this.reads.findTheConstructionOfTheRead(place) || {}).typeName === target.name);
    return buildingRead ? this.buildTheMapping(method, buildingRead.line) : null;
  }

  buildTheMapping(method, builtLine) {
    const head = this.placeInItsModule(this.references.buildPlace(method.path, method.line));
    return builtLine === method.line ? { head } : { head, built: this.references.buildPlace(method.path, builtLine) };
  }
}
