import { Abstraction, ABSTRACTION_KINDS, formatAbstractionId, isPlacedInSource, isTheClassOfAFile } from "./abstractions/Abstraction.mjs";
import { ABSTRACTION_CHANGE_KINDS } from "../inputs/change/AbstractionChange.mjs";
import { Evidence, EVIDENCE_KINDS } from "./Evidence.mjs";
import { readKindOfAResolvedReference, Reference } from "./relations/Reference.mjs";
import { Relation, RELATION_KINDS } from "./relations/Relation.mjs";
import { Scale } from "./abstractions/Scale.mjs";
import { parseReferencesFromJSON, convertReferencesToJSON } from "./WalkedReferenceConverter.mjs";
import { appendTo } from "../../collections/groupedLists.mjs";
import { CallGraphAbstractions } from "./CallGraphAbstractions.mjs";

export class DuplicateAbstraction extends Error {}

const LIFTED_BY = "CodeGraph";


const DECLARED_SCALES = [Scale.CLASS, Scale.METHOD, Scale.VARIABLE];

const KINDS_WITH_NO_DECLARATION = new Set([ABSTRACTION_KINDS.FILE, ABSTRACTION_KINDS.LOCAL]);

const isGoneAfterTheChange = abstraction => Boolean(abstraction.change) && abstraction.change.kind === ABSTRACTION_CHANGE_KINDS.REMOVED;

const hasADeclarationInTheSource = abstraction => !KINDS_WITH_NO_DECLARATION.has(abstraction.kind) && isPlacedInSource(abstraction);

const isAPlacedClassOfAFile = type => Boolean(type.place) && isTheClassOfAFile(type);

const isPlacedAtADeclaredScale = abstraction => isPlacedInSource(abstraction) && DECLARED_SCALES.includes(abstraction.scale);

const compareByPlace = (left, right) => (left.place.file < right.place.file ? -1 : left.place.file > right.place.file ? 1 : 0) || left.place.startLine - right.place.startLine;

export class CodeGraph {
  #relationsFromByAbstractionMap = new Map();
  #relationsToByAbstractionMap = new Map();
  #relationsByReferenceMap = new Map();
  #unresolvedFromByAbstractionMap = new Map();
  #referencesFromByAbstractionMap = new Map();
  #liftedIndexByScaleMap = new Map();
  #walkedIndex = null;
  #walkedPositionByReferenceMap = new Map();
  #possibleTargetsByWalkedReferenceMap = new Map();
  #abstractionsByNameMap = null;
  #abstractionsByFileMap = null;
  #fileClassByFileMap = null;

  constructor() {
    this.system = new Abstraction({ id: formatAbstractionId(Scale.SYSTEM, null, "."), scale: Scale.SYSTEM, name: "." });
    this.abstractionsByIdMap = new Map([[this.system.id, this.system]]);
    this.abstractionsByScaleMap = new Map(Scale.ALL.map(scale => [scale, []]));
    this.abstractionsByScaleMap.get(Scale.SYSTEM).push(this.system);
    this.references = [];
    this.walkedReferences = [];
    this.relations = [];
    this.unresolved = [];
    this.callGraphAbstractions = new CallGraphAbstractions();
  }

  add(abstraction, parent = this.system) {
    if (this.abstractionsByIdMap.has(abstraction.id)) throw new DuplicateAbstraction(`the graph already holds ${abstraction.id}`);
    parent.add(abstraction);
    this.abstractionsByIdMap.set(abstraction.id, abstraction);
    this.abstractionsByScaleMap.get(abstraction.scale).push(abstraction);
    this.#liftedIndexByScaleMap.clear();
    this.#abstractionsByFileMap = null;
    this.#fileClassByFileMap = null;
    this.#abstractionsByNameMap = null;
    return abstraction;
  }

  chooseFreeId(id) {
    if (!this.abstractionsByIdMap.has(id)) return id;
    let number = 2;
    while (this.abstractionsByIdMap.has(`${id}~${number}`)) number++;
    return `${id}~${number}`;
  }

  findAbstractionAt(id) {
    return this.abstractionsByIdMap.get(id) || null;
  }

  listAbstractionsAt(scale) {
    return [...this.abstractionsByScaleMap.get(scale)];
  }

  listAbstractionsDeclaredAfterTheChangeInPlaceOrder() {
    return this.#listAbstractionsDeclaredInTheSource()
      .filter(abstraction => !isGoneAfterTheChange(abstraction))
      .sort(compareByPlace);
  }

  listWalkedFiles() {
    return [...new Set(this.abstractionsByScaleMap.get(Scale.CLASS).filter(isTheClassOfAFile).map(type => type.place.file))];
  }

  listChildren(abstraction) {
    return [...abstraction.children];
  }

  recordReference(reference) {
    this.references.push(reference);
    appendTo(this.#referencesFromByAbstractionMap, reference.from, reference);
    return reference;
  }

  recordWalkedReference(reference) {
    this.#walkedPositionByReferenceMap.set(reference, this.walkedReferences.length);
    this.walkedReferences.push(reference);
    this.#walkedIndex = null;
    return reference;
  }

  recordCall(call, walked = null) {
    if (walked) {
      const position = this.#walkedPositionByReferenceMap.get(walked);
      this.#walkedPositionByReferenceMap.delete(walked);
      this.#walkedPositionByReferenceMap.set(call, position);
      this.walkedReferences[position] = call;
      this.#walkedIndex = null;
    } else {
      this.recordWalkedReference(call);
    }
    appendTo(this.#referencesFromByAbstractionMap, call.from, call);
    return call;
  }

  isWalked(reference) {
    return this.#walkedPositionByReferenceMap.has(reference);
  }

  resolveWalked(reference, { to = null, possibleTargets = [] }) {
    if (to) return this.relate(new Relation({ kind: readKindOfAResolvedReference(reference), from: reference.from, to, place: reference.place, evidence: new Evidence({ kind: EVIDENCE_KINDS.NAME_MATCHED, foundBy: reference.foundBy }), reference }));
    this.#possibleTargetsByWalkedReferenceMap.set(reference, possibleTargets);
    return this.leaveUnresolved(reference, possibleTargets);
  }

  findWalkedResolution(reference) {
    const [relation] = this.findRelationsWithReference(reference);
    if (relation) return { to: relation.to };
    return this.#possibleTargetsByWalkedReferenceMap.has(reference) ? { possibleTargets: this.#possibleTargetsByWalkedReferenceMap.get(reference) } : null;
  }

  resolveCall(reference, { targets, evidence }) {
    if (!targets.length && !reference.isAMethodReference()) return this.leaveUnresolved(reference);
    for (const target of targets) this.relate(new Relation({ kind: RELATION_KINDS.CALLS, from: reference.from, to: target, place: reference.place, evidence, reference }));
    return null;
  }

  readCallResolution(reference) {
    const relations = this.findRelationsWithReference(reference);
    return { targets: relations.map(relation => relation.to), evidence: relations.length ? relations[0].evidence : null };
  }

  findDeclaredAfterTheChangeNamed(name, scale) {
    if (!this.#abstractionsByNameMap) {
      this.#abstractionsByNameMap = new Map();
      for (const abstraction of this.listAbstractionsDeclaredAfterTheChangeInPlaceOrder()) appendTo(this.#abstractionsByNameMap, abstraction.name, abstraction);
    }
    return (this.#abstractionsByNameMap.get(name) || []).filter(abstraction => abstraction.scale === scale);
  }

  findAbstractionsIn(file) {
    return this.#readAbstractionsAtADeclaredScaleByFile().get(file) || [];
  }

  findAbstractionsDeclaredAt(file, line) {
    return this.findAbstractionsIn(file).filter(abstraction => abstraction.place.startLine === line);
  }

  findDeclaredAt(file, line, scale) {
    return this.findAbstractionsDeclaredAt(file, line).find(abstraction => abstraction.scale === scale && abstraction.kind !== ABSTRACTION_KINDS.LOCAL) || null;
  }

  findFileClassAt(file) {
    return this.#readFileClassByFile().get(file) || null;
  }

  findFolderRoles(file) {
    const fileClass = this.findFileClassAt(file);
    const module = fileClass ? fileClass.findAncestorAt(Scale.MODULE) : null;
    return module ? module.roles : [];
  }

  findRolesOfTheFile(file) {
    const fileClass = this.findFileClassAt(file);
    return fileClass ? fileClass.roles : [];
  }

  findAbstractionsWithRole(kind) {
    return [...this.abstractionsByIdMap.values()].filter(abstraction => abstraction.hasRole(kind));
  }

  findFrameworksOfApplication(applicationFolder) {
    const application = this.findAbstractionAt(formatAbstractionId(Scale.APPLICATION, null, applicationFolder || "."));
    return application ? application.frameworks.map(framework => framework.name) : [];
  }

  findWalkedReferencesNamed(name) {
    return this.#readWalkedIndex().referencesByNameMap.get(name) || [];
  }

  findWalkedReferencesIn(file) {
    return this.#readWalkedIndex().referencesByFileMap.get(file) || [];
  }

  findReferencesFrom(abstraction) {
    return [...(this.#referencesFromByAbstractionMap.get(abstraction) || [])];
  }

  relate(relation) {
    this.relations.push(relation);
    appendTo(this.#relationsFromByAbstractionMap, relation.from, relation);
    appendTo(this.#relationsToByAbstractionMap, relation.to, relation);
    if (relation.reference) appendTo(this.#relationsByReferenceMap, relation.reference, relation);
    this.#liftedIndexByScaleMap.clear();
    return relation;
  }

  leaveUnresolved(reference, possibleTargets = []) {
    const unresolvedReference = Object.freeze({ reference, possibleTargets: Object.freeze([...possibleTargets]) });
    this.unresolved.push(unresolvedReference);
    appendTo(this.#unresolvedFromByAbstractionMap, reference.from, unresolvedReference);
    return unresolvedReference;
  }

  findRelationsFrom(abstraction) {
    return [...(this.#relationsFromByAbstractionMap.get(abstraction) || [])];
  }

  findRelationsTo(abstraction) {
    return [...(this.#relationsToByAbstractionMap.get(abstraction) || [])];
  }

  findRelationsWithReference(reference) {
    return [...(this.#relationsByReferenceMap.get(reference) || [])];
  }

  findUnresolvedFrom(abstraction) {
    return [...(this.#unresolvedFromByAbstractionMap.get(abstraction) || [])];
  }

  listLifted(scale) {
    return [...this.#readLiftedIndexAt(scale).relations];
  }

  findLiftedFrom(abstraction, scale = abstraction.scale) {
    return [...(this.#readLiftedIndexAt(scale).from.get(abstraction) || [])];
  }

  findLiftedTo(abstraction, scale = abstraction.scale) {
    return [...(this.#readLiftedIndexAt(scale).to.get(abstraction) || [])];
  }

  walk(walker) {
    return walker.walk(this);
  }

  findChanged() {
    return [...this.abstractionsByIdMap.values()].filter(abstraction => abstraction.change);
  }

  toJSON() {
    return {
      system: this.system.id,
      abstractions: [...this.abstractionsByIdMap.values()].map(abstraction => abstraction.toJSON()),
      references: this.references.map(reference => reference.toJSON()),
      walkedReferences: convertReferencesToJSON(this.walkedReferences, reference => (reference.isAReadCall() ? null : this.findWalkedResolution(reference)), reference => this.readCallResolution(reference)),
      relations: this.relations.filter(relation => !this.isWalked(relation.reference)).map(relation => relation.toJSON()),
      unresolved: this.unresolved.filter(unresolvedReference => !this.isWalked(unresolvedReference.reference)).map(unresolvedReference => ({ reference: unresolvedReference.reference.id, possibleTargets: unresolvedReference.possibleTargets.map(possibleTarget => possibleTarget.id) })),
      languages: this.callGraphAbstractions.toJSON(),
    };
  }

  static createFromJSON(saved) {
    const graph = new CodeGraph();
    const findAbstractionAt = id => graph.findAbstractionAt(id);
    for (const abstraction of saved.abstractions) {
      if (abstraction.id === graph.system.id) continue;
      graph.add(Abstraction.createFromJSON(abstraction), abstraction.parent ? findAbstractionAt(abstraction.parent) : graph.system);
    }
    const referencesByIdMap = new Map();
    for (const reference of saved.references) referencesByIdMap.set(reference.id, graph.recordReference(Reference.createFromJSON(reference, findAbstractionAt)));
    for (const { reference, call, to, possibleTargets } of parseReferencesFromJSON(saved.walkedReferences || [], findAbstractionAt)) {
      if (call) { graph.recordCall(reference); graph.resolveCall(reference, call); continue; }
      graph.recordWalkedReference(reference);
      if (to || possibleTargets) graph.resolveWalked(reference, { to, possibleTargets });
    }
    for (const relation of saved.relations) graph.relate(Relation.createFromJSON(relation, findAbstractionAt, id => referencesByIdMap.get(id)));
    for (const unresolvedReference of saved.unresolved) graph.leaveUnresolved(referencesByIdMap.get(unresolvedReference.reference), unresolvedReference.possibleTargets.map(findAbstractionAt));
    graph.callGraphAbstractions.readSaved(saved.languages || [], findAbstractionAt);
    return graph;
  }

  #listAbstractionsDeclaredInTheSource() {
    return DECLARED_SCALES.flatMap(scale => this.abstractionsByScaleMap.get(scale)).filter(hasADeclarationInTheSource);
  }

  #readAbstractionsAtADeclaredScaleByFile() {
    if (!this.#abstractionsByFileMap) {
      this.#abstractionsByFileMap = new Map();
      for (const abstraction of this.abstractionsByIdMap.values()) if (isPlacedAtADeclaredScale(abstraction)) appendTo(this.#abstractionsByFileMap, abstraction.place.file, abstraction);
    }
    return this.#abstractionsByFileMap;
  }

  #readFileClassByFile() {
    if (!this.#fileClassByFileMap) {
      this.#fileClassByFileMap = new Map();
      for (const type of this.abstractionsByScaleMap.get(Scale.CLASS).filter(isAPlacedClassOfAFile)) {
        if (!this.#fileClassByFileMap.has(type.place.file)) this.#fileClassByFileMap.set(type.place.file, type);
      }
    }
    return this.#fileClassByFileMap;
  }

  #readWalkedIndex() {
    if (!this.#walkedIndex) {
      const referencesByNameMap = new Map();
      const referencesByFileMap = new Map();
      for (const reference of this.walkedReferences) {
        appendTo(referencesByNameMap, reference.name, reference);
        appendTo(referencesByFileMap, reference.place.file, reference);
      }
      this.#walkedIndex = { referencesByNameMap, referencesByFileMap };
    }
    return this.#walkedIndex;
  }

  #readLiftedIndexAt(scale) {
    if (!this.#liftedIndexByScaleMap.has(scale)) this.#liftedIndexByScaleMap.set(scale, this.#buildIndex(this.#liftRelationsAt(scale)));
    return this.#liftedIndexByScaleMap.get(scale);
  }

  #liftRelationsAt(scale) {
    const kept = [];
    const relationsByLiftedKeyMap = new Map();
    for (const relation of this.relations) {
      const from = relation.from.findAncestorAt(scale);
      const to = relation.to.findAncestorAt(scale);
      if (!from || !to) continue;
      if (from === relation.from && to === relation.to) { kept.push(relation); continue; }
      if (from === to) continue;
      appendTo(relationsByLiftedKeyMap, `${relation.kind}|${from.id}|${to.id}`, relation);
    }
    const lifted = [...relationsByLiftedKeyMap.values()].map(liftedFrom => new Relation({
      kind: liftedFrom[0].kind,
      from: liftedFrom[0].from.findAncestorAt(scale),
      to: liftedFrom[0].to.findAncestorAt(scale),
      evidence: new Evidence({ kind: EVIDENCE_KINDS.LIFTED, foundBy: LIFTED_BY, detail: `${liftedFrom.length} relation(s) at a lower scale` }),
      liftedFrom,
    }));
    return [...kept, ...lifted];
  }

  #buildIndex(relations) {
    const relationsFromByAbstractionMap = new Map();
    const relationsToByAbstractionMap = new Map();
    for (const relation of relations) {
      appendTo(relationsFromByAbstractionMap, relation.from, relation);
      appendTo(relationsToByAbstractionMap, relation.to, relation);
    }
    return { relations, from: relationsFromByAbstractionMap, to: relationsToByAbstractionMap };
  }
}
