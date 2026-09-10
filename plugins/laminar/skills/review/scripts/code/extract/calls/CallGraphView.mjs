import { CallGraph } from "./CallGraph.mjs";
import { createArgumentCountField, CALL_VIEW_FACT_NAMES, collectCallGraphFacts, formatCallPlaceKey, copyLoopFields } from "../../graph/relations/Reference.mjs";
import { DEFAULT_NAME_MATCHED_TARGETS, findFollowedRelations } from "../../graph/chains/ChainWalker.mjs";
import { RELATION_KINDS } from "../../graph/relations/Relation.mjs";
import { ROLE_KINDS } from "../../graph/abstractions/Role.mjs";

const findExitFacts = abstraction => {
  const role = abstraction.roles.find(role => role.kind === ROLE_KINDS.EXIT_BOUNDARY);
  return role ? role.facts : null;
};

const readExitCalls = abstraction => new Set((findExitFacts(abstraction) || {}).exitCalls || []);

const callsAnIoGlobal = abstraction => ((findExitFacts(abstraction) || {}).globalCalls || []).length > 0;

const importsAnExitModule = abstraction => ((findExitFacts(abstraction) || {}).modules || []).length > 0;

const compareInReadingOrder = (left, right) => left.place.startLine - right.place.startLine || left.column - right.column;

const isAnImportOf = (filePath, kind) => relationOrReference => relationOrReference.kind === kind && relationOrReference.place && relationOrReference.place.file === filePath;

const mapToCalls = readCalls => readCalls.map(read => read.call);

class CallGraphView {
  constructor(codeGraph, family, nameMatchedTargets) {
    this.codeGraph = codeGraph;
    this.family = family;
    this.nameMatchedTargets = nameMatchedTargets;
    this.positionByAbstractionMap = new Map(family.methods.map((method, position) => [method, position]));
    this.callsByReferenceMap = new Map();
    this.filesCallingAnIoGlobal = new Set(family.methods.filter(callsAnIoGlobal).map(method => method.place.file));
  }

  findTargets(reference) {
    return (findFollowedRelations(this.codeGraph, reference, this.nameMatchedTargets) || []).map(relation => this.positionByAbstractionMap.get(relation.to));
  }

  mapToCall(reference, exitCalls) {
    return {
      line: reference.place.startLine,
      col: reference.column,
      callee: reference.name,
      receiver: reference.callReceiver,
      form: reference.form,
      loop: reference.loop ? copyLoopFields(reference.loop) : null,
      targets: this.findTargets(reference),
      status: reference.resolution,
      ...createArgumentCountField(reference, CALL_VIEW_FACT_NAMES),
      ...collectCallGraphFacts(reference, CALL_VIEW_FACT_NAMES),
      ...(exitCalls.has(formatCallPlaceKey(reference.place.startLine, reference.column)) ? { exit: true } : {}),
    };
  }

  readDirectCalls(abstraction) {
    const exitCalls = readExitCalls(abstraction);
    return this.codeGraph.findReferencesFrom(abstraction).filter(reference => reference.isADirectCall()).sort(compareInReadingOrder)
      .map(reference => ({ reference, call: this.mapToCall(reference, exitCalls) }));
  }

  readCalledMethodReferences(abstraction) {
    return this.codeGraph.findReferencesFrom(abstraction).filter(reference => reference.isACalledMethodReference())
      .map(reference => ({ reference, call: { line: reference.place.startLine, callee: reference.name, targets: this.findTargets(reference) } }));
  }

  recordCalls(readCalls) {
    for (const { reference, call } of readCalls) this.callsByReferenceMap.set(reference, call);
  }

  mapToMethod(abstraction, position, directCalls) {
    return {
      id: position,
      path: abstraction.place.file,
      line: abstraction.place.startLine,
      to: abstraction.place.endLine,
      name: abstraction.name,
      enclosingTypeName: abstraction.enclosingTypeName ?? "",
      calls: mapToCalls(directCalls),
      returns: abstraction.signature.returnTypes.length ? [...abstraction.signature.returnTypes] : undefined,
      ...(abstraction.measures.parameterCount ? { parameterCount: { ...abstraction.measures.parameterCount } } : {}),
    };
  }

  mapToType(abstraction) {
    return {
      name: abstraction.name,
      path: abstraction.place.file,
      line: abstraction.place.startLine,
      to: abstraction.place.endLine,
      abstract: abstraction.abstract,
      supertypes: [...abstraction.signature.supertypes],
      declaredByKeyMap: abstraction.declaredMembers.map(member => ({ ...member })),
    };
  }

  resolveFile({ path: filePath, abstraction }) {
    return {
      path: filePath,
      exit: importsAnExitModule(abstraction) || this.filesCallingAnIoGlobal.has(filePath),
      imports: this.codeGraph.findRelationsFrom(abstraction).filter(isAnImportOf(filePath, RELATION_KINDS.IMPORTS)).map(relation => relation.to.place.file),
      outside: this.codeGraph.findUnresolvedFrom(abstraction).map(unresolvedReference => unresolvedReference.reference).filter(isAnImportOf(filePath, RELATION_KINDS.IMPORTS)).map(reference => reference.name),
    };
  }

  readAndRememberTheCalls() {
    const { methods } = this.family;
    const directCalls = methods.map(abstraction => this.readDirectCalls(abstraction));
    const calledMethodReferences = methods.map(abstraction => this.readCalledMethodReferences(abstraction));
    [...directCalls, ...calledMethodReferences].forEach(readCalls => this.recordCalls(readCalls));
    return { directCalls, calledMethodReferences };
  }

  buildCallGraph({ directCalls, calledMethodReferences }) {
    const { name, files, types, methods } = this.family;
    return new CallGraph({
      family: name,
      methods: methods.map((abstraction, position) => this.mapToMethod(abstraction, position, directCalls[position])),
      types: types.map(abstraction => this.mapToType(abstraction)),
      files: files.map(file => this.resolveFile(file)),
      typeParameters: {
        methods: methods.map(abstraction => [...abstraction.signature.typeParameters]),
        types: types.map(abstraction => [...abstraction.signature.typeParameters]),
      },
      methodReferences: calledMethodReferences.map(mapToCalls),
      abstractions: methods,
      callsByReferenceMap: this.callsByReferenceMap,
    });
  }
}

const buildCallGraphOfTheView = view => view.buildCallGraph(view.readAndRememberTheCalls());

export const buildCallGraphs = (codeGraph, { nameMatchedTargets = DEFAULT_NAME_MATCHED_TARGETS } = {}) => new Map(codeGraph.callGraphAbstractions.families
  .map(family => [family.name, buildCallGraphOfTheView(new CallGraphView(codeGraph, family, nameMatchedTargets))]));
