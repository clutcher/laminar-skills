import { Evidence, EVIDENCE_KINDS } from "../../graph/Evidence.mjs";
import { Place } from "../../graph/abstractions/Place.mjs";
import { CALL_FORMS, Reference } from "../../graph/relations/Reference.mjs";
import { isACallKind, Relation, RELATION_KINDS } from "../../graph/relations/Relation.mjs";
import { Signature } from "../../graph/abstractions/Signature.mjs";
import { groupBy } from "../../../collections/groupedLists.mjs";

const FOUND_BY = Object.freeze({
  CALLS: "CallGraphBuilder",
  METHOD_REFERENCES: "GenericMethodRelationFinder",
  IMPORTS: "ImportResolution",
  SUPERTYPES: "CallGraphBuilder",
});

const RESOLUTIONS = Object.freeze({
  OUTSIDE_IMPORT: "module outside the repository",
  OUTSIDE_TYPE: "type outside the repository",
  MANY_TYPES: "more than 1 type of the name",
});

const buildPlaceKey = (file, line, name) => `${file}\u0000${line}\u0000${name}`;

const buildReferencePlaceKey = reference => buildPlaceKey(reference.place.file, reference.place.startLine, reference.name);

class DeclarationHeadPlaces {
  constructor(codeGraph) {
    this.keys = new Set(codeGraph.listAbstractionsDeclaredAfterTheChangeInPlaceOrder().map(abstraction => buildPlaceKey(abstraction.place.file, abstraction.place.startLine, abstraction.name)));
  }

  holds(reference) {
    return this.keys.has(buildReferencePlaceKey(reference));
  }
}

class WalkedReferences {
  constructor(codeGraph) {
    this.heads = new DeclarationHeadPlaces(codeGraph);
    this.walkedReferencesByPlaceMap = groupBy(codeGraph.walkedReferences, buildReferencePlaceKey);
  }

  findCallHeadToLeaveOut(waiting) {
    return waiting.find(reference => isACallKind(reference) && this.heads.holds(reference)) || null;
  }

  filterTakeable(waiting) {
    const headToLeaveOut = this.findCallHeadToLeaveOut(waiting);
    return waiting.filter(reference => reference !== headToLeaveOut);
  }

  take(file, line, name, isTheReference) {
    const waiting = this.walkedReferencesByPlaceMap.get(buildPlaceKey(file, line, name)) || [];
    const found = this.filterTakeable(waiting).find(reference => isTheReference(reference));
    if (found) waiting.splice(waiting.indexOf(found), 1);
    return found || null;
  }
}

const isAnyWalkedName = () => true;

export class CallGraphReading {
  constructor({ callGraphs = [], walker }) {
    this.callGraphs = callGraphs;
    this.walker = walker;
    this.codeGraph = walker.graph;
    this.abstractionsByTypeMap = new Map();
    this.methodsByCallGraphMap = new Map();
    this.typesByCallGraphMap = new Map(callGraphs.map(callGraph => [callGraph, {
      typesByNameMap: groupBy(callGraph.types, type => type.name),
      indexByTypeMap: new Map(callGraph.types.map((type, index) => [type, index])),
    }]));
    this.referenceCount = 0;
  }

  read() {
    this.walkedReferences = new WalkedReferences(this.codeGraph);
    for (const callGraph of this.callGraphs) this.readDeclarations(callGraph);
    for (const callGraph of this.callGraphs) this.readRelations(callGraph);
    for (const callGraph of this.callGraphs) this.addTheAbstractionsOfTheCallGraph(callGraph);
    return this.codeGraph;
  }

  addTheAbstractionsOfTheCallGraph(callGraph) {
    const methods = this.methodsByCallGraphMap.get(callGraph);
    this.codeGraph.callGraphAbstractions.add({
      name: callGraph.family,
      files: callGraph.files.map(file => ({ path: file.path, abstraction: this.walker.findOrAddTheFileClass(file.path) })),
      types: callGraph.types.map(type => this.abstractionsByTypeMap.get(type)),
      methods: callGraph.methods.map(method => methods.get(method.id)),
    });
  }

  readDeclarations(callGraph) {
    for (const type of callGraph.types) this.abstractionsByTypeMap.set(type, this.describeTypeOfTheCallGraph(callGraph, type));
    const methodsByIdMap = new Map();
    for (const method of callGraph.methods) methodsByIdMap.set(method.id, this.describeMethodOfTheCallGraph(callGraph, method));
    this.methodsByCallGraphMap.set(callGraph, methodsByIdMap);
  }

  findWalkedAbstraction(declaration) {
    return this.walker.findAbstractionOfDeclarationAt(declaration.path, declaration.line);
  }

  describeTypeOfTheCallGraph(callGraph, type) {
    return this.findWalkedAbstraction(type).applyDescription({
      signature: new Signature({ text: this.findWalkedAbstraction(type).signature.text, supertypes: type.supertypes, typeParameters: callGraph.typeParameters.types[this.typesByCallGraphMap.get(callGraph).indexByTypeMap.get(type)] || [] }),
      abstract: type.abstract,
      declaredMembers: type.declaredByKeyMap,
    });
  }

  describeMethodOfTheCallGraph(callGraph, method) {
    return this.findWalkedAbstraction(method).applyDescription({
      signature: new Signature({
        text: this.findWalkedAbstraction(method).signature.text,
        returnType: method.returns ? method.returns.join(", ") : "",
        returnTypes: method.returns || [],
        typeParameters: callGraph.typeParameters.methods[method.id] || [],
      }),
      enclosingTypeName: method.enclosingTypeName,
    }).applyMeasures(method.parameterCount ? { parameterCount: method.parameterCount } : {});
  }

  createNextReferenceId() {
    return `R${++this.referenceCount}`;
  }

  readRelations(callGraph) {
    const methods = this.methodsByCallGraphMap.get(callGraph);
    for (const method of callGraph.methods) {
      for (const call of method.calls) this.readCall(callGraph, methods, methods.get(method.id), call);
      for (const methodReference of callGraph.findMethodReferences(method)) this.readMethodReference(methods, methods.get(method.id), methodReference);
    }
    for (const file of callGraph.files) this.readImports(callGraph, file);
    for (const type of callGraph.types) this.readSupertypes(callGraph, type);
  }

  recordTheCall(from, line, callee, isTheReference, read) {
    const walked = this.walkedReferences.take(from.place.file, line, callee, isTheReference);
    const { foundBy, ...facts } = read;
    const call = walked
      ? walked.readAsCall(from, { kind: RELATION_KINDS.CALLS, ...facts })
      : new Reference({ kind: RELATION_KINDS.CALLS, from, name: callee, receiver: facts.callReceiver, place: new Place({ file: from.place.file, startLine: line }), foundBy, ...facts });
    return this.codeGraph.recordCall(call, walked);
  }

  readCall(callGraph, methods, from, call) {
    const reference = this.recordTheCall(from, call.line, call.callee, isACallKind, {
      callReceiver: call.receiver,
      foundBy: FOUND_BY.CALLS,
      resolution: call.status,
      column: call.col,
      form: call.form,
      loop: call.loop,
      once: Boolean(call.once),
      end: Boolean(call.end),
      outsideNames: call.on || null,
      argumentCount: call.args ?? null,
    });
    if (!call.targets.length) { this.codeGraph.leaveUnresolved(reference); return; }
    const evidence = this.createEvidenceOfCall(callGraph, call);
    for (const target of call.targets) {
      this.codeGraph.relate(new Relation({ kind: RELATION_KINDS.CALLS, from, to: methods.get(target), place: reference.place, evidence, reference }));
    }
  }

  readMethodReference(methods, from, methodReference) {
    const reference = this.recordTheCall(from, methodReference.line, methodReference.callee, isAnyWalkedName, {
      callReceiver: "",
      foundBy: FOUND_BY.METHOD_REFERENCES,
      resolution: CALL_FORMS.METHOD_REFERENCE,
      form: CALL_FORMS.METHOD_REFERENCE,
    });
    const evidence = new Evidence({ kind: EVIDENCE_KINDS.RESOLVED, foundBy: FOUND_BY.METHOD_REFERENCES, detail: CALL_FORMS.METHOD_REFERENCE });
    for (const target of methodReference.targets) {
      this.codeGraph.relate(new Relation({ kind: RELATION_KINDS.CALLS, from, to: methods.get(target), place: reference.place, evidence, reference }));
    }
  }

  createEvidenceOfCall(callGraph, call) {
    if (call.targets.length === 1) return new Evidence({ kind: EVIDENCE_KINDS.RESOLVED, foundBy: FOUND_BY.CALLS, detail: call.status });
    const shared = this.findSharedAbstractSupertype(callGraph, call.targets.map(target => callGraph.methods[target].enclosingTypeName));
    return shared
      ? new Evidence({ kind: EVIDENCE_KINDS.DECLARED, foundBy: FOUND_BY.CALLS, detail: `implementations of ${shared}` })
      : new Evidence({ kind: EVIDENCE_KINDS.NAME_MATCHED, foundBy: FOUND_BY.CALLS, detail: `${call.targets.length} declarations named ${call.callee}` });
  }

  findSharedAbstractSupertype(callGraph, typeNames) {
    const { typesByNameMap: typesByNameMap } = this.typesByCallGraphMap.get(callGraph);
    const collectSupertypes = typeName => new Set([typeName, ...(typesByNameMap.get(typeName) || []).flatMap(type => type.supertypes)]);
    const [first, ...rest] = typeNames.map(collectSupertypes);
    const shared = [...(first || [])].filter(name => rest.every(names => names.has(name)));
    return shared.find(name => (typesByNameMap.get(name) || []).some(type => type.abstract)) || null;
  }

  readImports(callGraph, file) {
    const from = this.walker.findOrAddTheFileClass(file.path);
    for (const imported of file.imports) {
      this.codeGraph.relate(new Relation({
        kind: RELATION_KINDS.IMPORTS,
        from,
        to: this.walker.findOrAddTheFileClass(imported),
        place: new Place({ file: file.path }),
        evidence: new Evidence({ kind: EVIDENCE_KINDS.RESOLVED, foundBy: FOUND_BY.IMPORTS }),
      }));
    }
    for (const outside of file.outside) {
      this.codeGraph.leaveUnresolved(this.codeGraph.recordReference(new Reference({
        id: this.createNextReferenceId(),
        kind: RELATION_KINDS.IMPORTS,
        from,
        name: outside,
        place: new Place({ file: file.path }),
        foundBy: FOUND_BY.IMPORTS,
        resolution: RESOLUTIONS.OUTSIDE_IMPORT,
      })));
    }
  }

  readSupertypes(callGraph, type) {
    const from = this.abstractionsByTypeMap.get(type);
    const { typesByNameMap: typesByNameMap } = this.typesByCallGraphMap.get(callGraph);
    for (const name of type.supertypes) {
      const possibleSupertypes = (typesByNameMap.get(name) || []).filter(sameNamedType => sameNamedType !== type);
      const resolution = possibleSupertypes.length > 1 ? RESOLUTIONS.MANY_TYPES : possibleSupertypes.length ? "" : RESOLUTIONS.OUTSIDE_TYPE;
      const reference = this.codeGraph.recordReference(new Reference({
        id: this.createNextReferenceId(),
        kind: RELATION_KINDS.EXTENDS,
        from,
        name,
        place: new Place({ file: type.path, startLine: type.line }),
        foundBy: FOUND_BY.SUPERTYPES,
        resolution,
      }));
      if (possibleSupertypes.length !== 1) { this.codeGraph.leaveUnresolved(reference, possibleSupertypes.map(possibleSupertype => this.abstractionsByTypeMap.get(possibleSupertype))); continue; }
      this.codeGraph.relate(new Relation({
        kind: possibleSupertypes[0].abstract ? RELATION_KINDS.IMPLEMENTS : RELATION_KINDS.EXTENDS,
        from,
        to: this.abstractionsByTypeMap.get(possibleSupertypes[0]),
        place: reference.place,
        evidence: new Evidence({ kind: EVIDENCE_KINDS.NAME_MATCHED, foundBy: FOUND_BY.SUPERTYPES, detail: `the only type named ${name}` }),
        reference,
      }));
    }
  }
}
