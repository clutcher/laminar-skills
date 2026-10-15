import { buildWholeWordPattern, findDriver, isAnEntryBoundaryRole, isTestPath, readLanguageFamily, readSignature, ROLE_KINDS, Scale } from "../../../../../code/index.mjs";

const MIN_WIRED_TYPES = 2;

const isAMethod = abstraction => String(abstraction.scale) === Scale.METHOD.name;

const readMethodOfTheSignature = method => ({ name: method.name, line: method.place.startLine, to: method.place.endLine, returns: [...method.signature.returnTypes] });

const formatTypeListKey = typeNames => typeNames.join(",");

export const formatWiredTypeNames = typeNames => (typeNames.length > 1
  ? `${typeNames.slice(0, -1).join(", ")} and ${typeNames[typeNames.length - 1]}`
  : typeNames.join(""));

export class TopClassWiring {
  constructor(graph, repositoryAbstractions, readFileLines) {
    this.graph = graph;
    this.repositoryAbstractions = repositoryAbstractions;
    this.readFileLines = readFileLines;
  }

  hasAnEntryBoundaryRole(filePath) {
    return this.graph.findAbstractionsIn(filePath).some(abstraction => abstraction.roles.some(isAnEntryBoundaryRole));
  }

  findEntryMethodsWiredTo(topPath, namedBelow, languageFamily) {
    const topTypeLists = this.findMethodsNaming(topPath, namedBelow).flatMap(method => this.readTypeListsOfTheSignature(method, { withTheResult: true }));
    const topKeys = new Set(topTypeLists.map(formatTypeListKey));
    if (!topKeys.size) return [];
    return this.listEntryMethods(languageFamily).flatMap(entryMethod => {
      const shared = entryMethod.typeLists.find(typeNames => topKeys.has(formatTypeListKey(typeNames)));
      return shared ? [{ method: entryMethod.method, typeNames: shared }] : [];
    });
  }

  findMethodsNaming(filePath, name) {
    const lines = this.readFileLines(filePath);
    const namePattern = buildWholeWordPattern(name);
    const namesTheClass = method => lines.slice(method.place.startLine - 1, method.place.endLine).some(line => namePattern.test(line));
    return this.graph.findAbstractionsIn(filePath).filter(abstraction => isAMethod(abstraction) && abstraction.place && namesTheClass(abstraction));
  }

  listEntryMethods(languageFamily) {
    if (!this.entryMethods) {
      this.entryMethods = this.graph.findAbstractionsWithRole(ROLE_KINDS.ENTRY_BOUNDARY)
        .filter(abstraction => isAMethod(abstraction) && abstraction.place && !isTestPath(abstraction.place.file))
        .map(method => ({ method, typeLists: this.readTypeListsOfTheSignature(method, { withTheResult: false }) }))
        .filter(entryMethod => entryMethod.typeLists.length);
    }
    return this.entryMethods.filter(entryMethod => readLanguageFamily(entryMethod.method.place.file) === languageFamily);
  }

  readTypeListsOfTheSignature(method, { withTheResult }) {
    const driver = findDriver(method.place.file);
    const signature = readSignature(this.readFileLines(method.place.file), readMethodOfTheSignature(method), driver ? driver.diffDriver : "");
    const typeLists = [...signature.parameters.map(parameter => parameter.typeNames), ...(withTheResult ? [signature.returnNames] : [])];
    return typeLists
      .map(typeNames => typeNames.filter(typeName => this.repositoryAbstractions.findDeclaringPath(typeName, "")))
      .filter(typeNames => typeNames.length >= MIN_WIRED_TYPES);
  }
}
