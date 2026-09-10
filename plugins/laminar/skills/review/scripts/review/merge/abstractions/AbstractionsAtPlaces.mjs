import path from "node:path";
import { readApplicationName, CODE_GRAPH_FILE, CodeGraph, findDeployableRoots, findInnermostHolding, findNamedPlaces, Scale } from "../../../code/index.mjs";
import { readJsonFileIfPresent } from "../../../files/jsonFile.mjs";
import { CoveringTests } from "./CoveringTests.mjs";

export const METHOD_MARK = "#";

const THE_COVERING_TEST_FIELD = "test";

const NAMED_PLACE_FIELDS = Object.freeze(["abstractionPlace", "entry", "exit", THE_COVERING_TEST_FIELD]);

const NAMED_PLACE_LIST_FIELDS = Object.freeze(["takenBy", "branches"]);

export const stripLeadingDotSlash = file => String(file || "").replace(/^\.\//, "");

export const buildPlaceKey = place => `${stripLeadingDotSlash(place.file)}::${place.displayName || ""}`;

export const buildFileAndLineKey = (file, line) => `${stripLeadingDotSlash(file)}:${Number(line)}`;

export const collectQuotedPlaceKeys = findings => new Set(findings.flatMap(finding => finding.quotes || [])
  .map(quote => `${stripLeadingDotSlash(quote.file)}:${quote.line}`));

const readScaleOfDisplayName = displayName => String(displayName).includes(METHOD_MARK) ? Scale.METHOD.name : Scale.CLASS.name;

export class AbstractionsAtPlaces {
  constructor(runFolder, repository, abstractions) {
    this.runFolder = runFolder;
    this.repository = repository;
    this.abstractionsByPathMap = new Map();
    for (const abstraction of abstractions) {
      if (!this.abstractionsByPathMap.has(abstraction.path)) this.abstractionsByPathMap.set(abstraction.path, []);
      this.abstractionsByPathMap.get(abstraction.path).push(abstraction);
    }
  }

  readAbstractionsIn(file) {
    if (!this.abstractionsByPathMap.has(file)) {
      this.abstractionsByPathMap.set(file, this.repository ? findNamedPlaces(this.readCodeGraph(), file, readApplicationName(file, this.listApplicationRoots())) : []);
    }
    return this.abstractionsByPathMap.get(file);
  }

  readCodeGraph() {
    if (!this.graph) this.graph = CodeGraph.createFromJSON(readJsonFileIfPresent(path.join(this.runFolder, CODE_GRAPH_FILE), new CodeGraph().toJSON()));
    return this.graph;
  }

  readCoveringTests() {
    if (!this.tests) this.tests = new CoveringTests(this.readCodeGraph(), (file, line) => this.findAbstractionAt(file, line));
    return this.tests;
  }

  listApplicationRoots() {
    if (!this.roots) this.roots = findDeployableRoots(this.repository);
    return this.roots;
  }

  findAbstractionAt(file, line) {
    return findInnermostHolding(this.readAbstractionsIn(stripLeadingDotSlash(file)), line, abstraction => abstraction);
  }

  resolveCoveringTestAt(file, line) {
    const abstraction = this.findAbstractionAt(file, line);
    if (!abstraction || abstraction.scale !== Scale.METHOD.name) return { displayName: this.readDisplayNameAt(file, line) };
    const tests = this.readCoveringTests().findTestsReaching(stripLeadingDotSlash(file), abstraction);
    if (tests.length === 1) return { displayName: tests[0].displayName };
    if (tests.length > 1) return { displayName: abstraction.displayName, calledByTests: tests.map(test => test.displayName) };
    return { displayName: abstraction.displayName };
  }

  readDisplayNameAt(file, line) {
    const abstraction = this.findAbstractionAt(file, line);
    return abstraction ? abstraction.displayName : `${stripLeadingDotSlash(file)}:${line}`;
  }

  readScaleAt(file, line, displayName) {
    const abstraction = this.findAbstractionAt(file, line);
    return abstraction && abstraction.scale ? abstraction.scale : readScaleOfDisplayName(displayName);
  }

  resolveReferencedPlaceAt(file, line, displayNameAt = (normalized, at) => this.readDisplayNameAt(normalized, at)) {
    const normalized = stripLeadingDotSlash(file);
    return { file: normalized, line, displayName: displayNameAt(normalized, line) };
  }

  resolveReferencedPlace(place, displayNameAt) {
    if (!place || !place.file) return place;
    return { ...place, ...this.resolveReferencedPlaceAt(place.file, Number(place.line) || 0, displayNameAt) };
  }

  resolveCoveringTestPlace(place) {
    if (!place || !place.file) return place;
    const { calledByTests, ...withoutCallers } = place;
    const file = stripLeadingDotSlash(place.file);
    const line = Number(place.line) || 0;
    const covering = this.resolveCoveringTestAt(file, line);
    return { ...withoutCallers, file, line, ...covering };
  }

  resolveReferencedPlaceOfItsField(field, place) {
    return field === THE_COVERING_TEST_FIELD ? this.resolveCoveringTestPlace(place) : this.resolveReferencedPlace(place);
  }

  resolveReferencedPlaces(possibleFinding) {
    const referenced = {};
    for (const field of NAMED_PLACE_FIELDS) if (possibleFinding[field]) referenced[field] = this.resolveReferencedPlaceOfItsField(field, possibleFinding[field]);
    for (const field of NAMED_PLACE_LIST_FIELDS) if (possibleFinding[field]) referenced[field] = [].concat(possibleFinding[field]).map(place => this.resolveReferencedPlace(place));
    return referenced;
  }
}
