import { Strategy } from "../../../../finders/Strategy.mjs";
import { Scale } from "../../../../../graph/abstractions/Scale.mjs";

const STATIC_CALL_PATTERN = /\b([A-Z][A-Za-z0-9_]*)\.([a-z][A-Za-z0-9_]*)\s*\(/g;

export class GenericCallEffects extends Strategy {
  #wordSetByPropertyMap = new Map();

  constructor() {
    super(Scale.METHOD);
    this.ambientSources = [];
    this.typesWhoseStaticCallsHideNothing = null;
    this.inMemoryTypes = [];
    this.inMemoryCallees = [];
    this.loopCallees = [];
    this.objectProtocolCallees = [];
  }

  holdsAHiddenDependency(lines) {
    return lines.some(line => this.ambientSources.some(pattern => pattern.test(line)))
      || (Boolean(this.typesWhoseStaticCallsHideNothing) && lines.some(line => this.hidesBehindAStaticCall(line)));
  }

  hidesBehindAStaticCall(line) {
    for (const call of String(line).matchAll(STATIC_CALL_PATTERN)) {
      if (!this.#readWordSet("typesWhoseStaticCallsHideNothing").has(call[1])) return true;
    }
    return false;
  }

  holdsInMemory(typeName) {
    return this.#readWordSet("inMemoryTypes").has(typeName);
  }

  staysInMemoryWhenCalled(callee) {
    return this.#readWordSet("inMemoryCallees").has(callee);
  }

  isAnObjectProtocolCallee(callee) {
    return this.#readWordSet("objectProtocolCallees").has(callee);
  }

  isALoopCallee(callee) {
    return this.#readWordSet("loopCallees").has(callee);
  }

  #readWordSet(property) {
    if (!this.#wordSetByPropertyMap.has(property)) this.#wordSetByPropertyMap.set(property, new Set(this[property] || []));
    return this.#wordSetByPropertyMap.get(property);
  }
}
