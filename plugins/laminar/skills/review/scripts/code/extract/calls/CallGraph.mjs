import { findInnermostHolding } from "../../graph/abstractions/Place.mjs";

export const isARepeatedCall = call => !call.once;

export const repeatsInALoop = call => Boolean(call.loop) && isARepeatedCall(call);

const NO_TYPE_PARAMETERS = Object.freeze({ methods: [], types: [] });

export class CallGraph {
  constructor({ family, methods, types = [], files = [], typeParameters = NO_TYPE_PARAMETERS, methodReferences = [], abstractions = [], callsByReferenceMap = new Map() }) {
    this.family = family;
    this.abstractions = abstractions;
    this.positionByAbstractionMap = new Map(abstractions.map((abstraction, position) => [abstraction, position]));
    this.callsByReferenceMap = callsByReferenceMap;
    this.methods = methods;
    this.types = types;
    this.files = files;
    this.typeParameters = typeParameters;
    this.methodReferences = methodReferences;
    this.methodsByPathMap = new Map();
    for (const method of methods) {
      if (!this.methodsByPathMap.has(method.path)) this.methodsByPathMap.set(method.path, []);
      this.methodsByPathMap.get(method.path).push(method);
    }
    this.repeatedCallers = null;
  }

  static createFromSaved(saved) {
    return new CallGraph(saved);
  }

  convertToSaved() {
    return { family: this.family, methods: this.methods, types: this.types, files: this.files, typeParameters: this.typeParameters };
  }

  findMethodReferences(method) {
    return this.methodReferences[method.id] || [];
  }

  findAbstraction(method) {
    return this.abstractions[method.id] || null;
  }

  findMethod(abstraction) {
    return this.positionByAbstractionMap.has(abstraction) ? this.methods[this.positionByAbstractionMap.get(abstraction)] : null;
  }

  findCall(reference) {
    return this.callsByReferenceMap.get(reference) || null;
  }

  findMethodsDeclaredAt(filePath, line) {
    return (this.methodsByPathMap.get(filePath) || []).filter(method => method.line === line);
  }

  findMethodDeclaredAt(filePath, line) {
    return this.findMethodsDeclaredAt(filePath, line)[0] || null;
  }

  readRepeatedCallers(id) {
    if (!this.repeatedCallers) this.repeatedCallers = this.buildRepeatedCallerIndex();
    return this.repeatedCallers[id];
  }

  buildRepeatedCallerIndex() {
    const repeatedCallers = this.methods.map(() => []);
    for (const method of this.methods) {
      method.calls.forEach((call, index) => {
        if (!isARepeatedCall(call)) return;
        for (const target of call.targets) repeatedCallers[target].push({ method: method.id, call: index });
      });
    }
    return repeatedCallers;
  }
}

const readSpanOfMethod = method => ({ from: method.line, to: method.to });

export const findInnermostMethodAt = (callGraph, filePath, line) => findInnermostHolding(callGraph ? callGraph.methodsByPathMap.get(filePath) || [] : [], line, readSpanOfMethod);

export const findTypesEnclosingTheSpan = (types, filePath, span) => types.filter(type => type.path === filePath && type.line < span.from && type.to >= span.to);

const compareByTheNearestHeadFirst = (left, right) => right.line - left.line;

export const findTypesEnclosingTheSpanInnermostFirst = (types, filePath, span) => findTypesEnclosingTheSpan(types, filePath, span).sort(compareByTheNearestHeadFirst);

export const formatDisplayNameOfMethod = method => (method.enclosingTypeName ? `${method.enclosingTypeName}#${method.name}` : method.name);
