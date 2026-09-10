import { buildShortenedPlace, compareByPathAndLine, DEFAULT_NAME_MATCHED_TARGETS,readLanguageFamily, REFERENCE_FORMS, Scale } from "../../../../code/index.mjs";
import { NAMING_KINDS, ReferenceLines } from "./ReferenceLines.mjs";
import { ReferenceTargets } from "./ReferenceTargets.mjs";
import { AbstractionLookup } from "../lookups/AbstractionLookup.mjs";

const WORD_RUN_PATTERN = /[A-Za-z_$][\w$]*/g;

const holdsTheWord = (text, word) => (text.match(WORD_RUN_PATTERN) || []).includes(word);

const buildPlaceKey = reference => `${reference.place.file}\u0000${reference.place.startLine}`;

const constructs = (target, abstraction) => target.scale === Scale.METHOD && target.parent === abstraction && target.name === abstraction.name;

const isOrConstructs = abstraction => target => target === abstraction || constructs(target, abstraction);

export class ReferencePlaces {
  constructor(graph, linesOf, nameMatchedTargets = DEFAULT_NAME_MATCHED_TARGETS) {
    this.graph = graph;
    this.readFileLines = linesOf;
    this.lines = new ReferenceLines(graph);
    this.targets = new ReferenceTargets(graph, nameMatchedTargets);
    this.abstractionLookup = new AbstractionLookup(graph);
  }

  buildPlace(filePath, line) {
    return buildShortenedPlace(filePath, line, (this.readFileLines(filePath) || [])[line - 1] ?? "");
  }

  collectPlaces(references) {
    const seen = new Set();
    const places = [];
    for (const reference of references) {
      const key = buildPlaceKey(reference);
      if (seen.has(key)) continue;
      seen.add(key);
      places.push(this.buildPlace(reference.place.file, reference.place.startLine));
    }
    return places;
  }

  findNamingReferences(name, family) {
    return this.graph.findWalkedReferencesNamed(name).filter(reference => NAMING_KINDS.has(reference.kind) && readLanguageFamily(reference.place.file) === family);
  }

  findDeclarationPlacesReadAtLines(filePath, lines, name) {
    const targets = lines.flatMap(line => this.lines.findReferencesAtLine(filePath, line))
      .filter(reference => reference.name === name && NAMING_KINDS.has(reference.kind))
      .flatMap(reference => this.targets.findEveryTarget(reference));
    const places = [...new Set(targets)].map(target => this.buildPlace(target.place.file, target.place.startLine));
    return places.sort(compareByPathAndLine);
  }

  findReferencesReaching(abstraction, targetsOf) {
    return this.graph.findWalkedReferencesNamed(abstraction.name)
      .filter(reference => NAMING_KINDS.has(reference.kind) && targetsOf(reference).some(isOrConstructs(abstraction)));
  }

  findPlacesReaching(abstraction) {
    return this.collectPlaces(this.findReferencesReaching(abstraction, reference => this.targets.findTargets(reference)));
  }

  findPlacesThatMayReach(abstraction) {
    return this.collectPlaces(this.findReferencesReaching(abstraction, reference => this.targets.findEveryTarget(reference)));
  }

  collectProductionPathsNaming(name, family, testCode) {
    return new Set(this.findNamingPlaces(name, family).filter(place => !testCode.isTestPlace(place)).map(place => place.path));
  }

  findNamingPlaces(name, family) {
    return this.collectPlaces(this.findNamingReferences(name, family));
  }

  findPlacesNamed(name, family) {
    return this.collectPlaces(this.graph.findWalkedReferencesNamed(name).filter(reference => readLanguageFamily(reference.place.file) === family));
  }

  findMemberReadPlaces(name) {
    return this.collectPlaces(this.graph.findWalkedReferencesNamed(name).filter(reference => NAMING_KINDS.has(reference.kind) && reference.receiver));
  }

  findPlacesNamedAnywhere(name) {
    return this.collectPlaces(this.graph.findWalkedReferencesNamed(name));
  }

  findRoutePlacesHolding(word) {
    if (!this.routeReferences) this.routeReferences = this.graph.walkedReferences.filter(reference => reference.form === REFERENCE_FORMS.ROUTE);
    return this.collectPlaces(this.routeReferences.filter(reference => holdsTheWord(reference.name, word)));
  }

}
