import { buildFieldWritePattern, findDeployableFolder, findInnermostMethodAt, isAFileWithBehavior, isAnEntryBoundaryRole, isTestPath, readLanguageFamily, formatDisplayNameOfMethod, Scale } from "../../../../../code/index.mjs";
import { readFileName } from "../../../../../files/paths.mjs";
import { findConditionCalls, ImportedConstantLookup, readNumberedLines } from "./ConditionReading.mjs";

export const MAX_FILL_PLACES = 2;
export const MAX_SLICE_LINES = 40;

const THE_SCHEMA_FAMILY = readLanguageFamily("schema.graphqls");

const LINES_AROUND_A_BARE_PLACE = 3;
const MAX_LINES_FROM_A_MAPPING_TO_ITS_METHOD = 4;

export { readNumberedLines };

const capitalize = name => name.charAt(0).toUpperCase() + name.slice(1);

const namesTheType = (method, filePath, typeName) => [method ? method.enclosingTypeName : "", readFileName(filePath)]
  .some(name => String(name || "").toLowerCase().includes(typeName.toLowerCase()));

const compareByTheTypeNameFirst = typeName => (left, right) => Number(namesTheType(right.method, right.path, typeName)) - Number(namesTheType(left.method, left.path, typeName))
  || (left.path < right.path ? -1 : left.path > right.path ? 1 : 0) || left.from - right.from;

export class EntryBoundaryFills {
  constructor(repositoryText, testCode, callGraphOf, roots, references, codeGraph) {
    this.codeGraph = codeGraph;
    this.repositoryText = repositoryText;
    this.findCallGraph = callGraphOf;
    this.roots = roots;
    this.references = references;
    this.methodsByNameMap = new Map();
    this.importedConstantLookup = new ImportedConstantLookup(repositoryText, testCode, roots, references);
  }

  isProducerCode(filePath, applicationFolder) {
    return findDeployableFolder(filePath, this.roots) === applicationFolder && !isTestPath(filePath)
      && isAFileWithBehavior(filePath);
  }

  listCodeFamilies() {
    return this.repositoryText.listFamilies().filter(family => family !== THE_SCHEMA_FAMILY && this.findCallGraph(family));
  }

  findMethodsNamed(family, name) {
    const key = `${family}\u0000${name}`;
    if (!this.methodsByNameMap.has(key)) this.methodsByNameMap.set(key, this.findCallGraph(family).methods.filter(method => method.name === name));
    return this.methodsByNameMap.get(key);
  }

  mapsTheSchemaField(place, name) {
    return this.codeGraph.findAbstractionsIn(place.path).some(abstraction => abstraction.scale === Scale.METHOD
      && abstraction.roles.some(role => isAnEntryBoundaryRole(role) && role.facts.schemaMapping
        && role.facts.schemaMapping.line === place.line && role.facts.schemaMapping.names.includes(name)));
  }

  findMethodBelowAMapping(family, place) {
    return (this.findCallGraph(family).methodsByPathMap.get(place.path) || [])
      .filter(method => method.line > place.line && method.line <= place.line + MAX_LINES_FROM_A_MAPPING_TO_ITS_METHOD)
      .sort((left, right) => left.line - right.line)[0] || null;
  }

  fillOfMethod(method) {
    const lines = this.repositoryText.readFileLines(method.path) || [];
    const to = Math.min(method.to, method.line + MAX_SLICE_LINES - 1);
    return { displayName: formatDisplayNameOfMethod(method), path: method.path, from: method.line, to, method, lines: readNumberedLines(lines, method.line, to) };
  }

  fillAround(filePath, line) {
    const lines = this.repositoryText.readFileLines(filePath) || [];
    const from = Math.max(1, line - LINES_AROUND_A_BARE_PLACE);
    const to = Math.min(lines.length, line + LINES_AROUND_A_BARE_PLACE);
    return { displayName: "", path: filePath, from, to, method: null, lines: readNumberedLines(lines, from, to) };
  }

  findResolvers(family, field, applicationFolder) {
    const named = this.findMethodsNamed(family, field.name).filter(method => this.isProducerCode(method.path, applicationFolder));
    const mapped = this.references.findPlacesNamed(field.name, family)
      .filter(place => this.isProducerCode(place.path, applicationFolder) && this.mapsTheSchemaField(place, field.name))
      .map(place => this.findMethodBelowAMapping(family, place)).filter(Boolean);
    return [...named, ...mapped].map(method => this.fillOfMethod(method));
  }

  findTheSetters(family, field, typeName, applicationFolder) {
    const places = [field.name, `set${capitalize(field.name)}`]
      .flatMap(word => this.references.findPlacesNamed(word, family))
      .filter(place => this.isProducerCode(place.path, applicationFolder) && buildFieldWritePattern(field.name).test(place.text));
    return places.map(place => ({ place, method: findInnermostMethodAt(this.findCallGraph(family), place.path, place.line) }))
      .filter(({ place, method }) => namesTheType(method, place.path, typeName));
  }

  fillOfTheSetter({ place, method }) {
    return method ? this.fillOfMethod(method) : this.fillAround(place.path, place.line);
  }

  addTheConditionCalls(fill) {
    const fileLines = this.repositoryText.readFileLines(fill.path) || [];
    const conditionCalls = findConditionCalls(this.findCallGraph(readLanguageFamily(fill.path)), this.references, fileLines, fill)
      .map(call => ({ ...call, declaredInAnotherFile: this.importedConstantLookup.findDeclaredLinesReadByTheConditions(call.path, fileLines, call.lines) }));
    return { ...fill, declaredInAnotherFile: this.importedConstantLookup.findDeclaredLinesReadByTheConditions(fill.path, fileLines, fill.lines), conditionCalls };
  }

  fillsOf(field, typeName, applicationFolder) {
    const families = this.listCodeFamilies();
    const resolvers = families.flatMap(family => this.findResolvers(family, field, applicationFolder));
    const found = resolvers.length ? resolvers : families.flatMap(family => this.findTheSetters(family, field, typeName, applicationFolder).map(setter => this.fillOfTheSetter(setter)));
    const once = [...new Map(found.map(fill => [`${fill.path}:${fill.from}`, fill])).values()];
    return once.sort(compareByTheTypeNameFirst(typeName)).slice(0, MAX_FILL_PLACES).map(({ method, ...kept }) => this.addTheConditionCalls(kept));
  }
}
