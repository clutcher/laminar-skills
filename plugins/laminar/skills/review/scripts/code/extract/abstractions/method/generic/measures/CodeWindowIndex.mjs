import { Scale } from "../../../../../graph/abstractions/Scale.mjs";

const readWindowsOfMethod = method => (method.measures.windows || []).map(window => {
  const [line, fingerprint] = window.split(" ");
  return { fingerprint, window: Object.freeze({ method, line: Number(line) }) };
});

export class CodeWindowIndex {
  constructor(methods) {
    this.windowsByFingerprintMap = new Map();
    for (const { fingerprint, window } of methods.flatMap(readWindowsOfMethod)) {
      if (!this.windowsByFingerprintMap.has(fingerprint)) this.windowsByFingerprintMap.set(fingerprint, []);
      this.windowsByFingerprintMap.get(fingerprint).push(window);
    }
  }

  static createFromMethodsIn(graph) {
    return new CodeWindowIndex(graph.listAbstractionsAt(Scale.METHOD));
  }

  findWindowsWithFingerprint(fingerprint) {
    return this.windowsByFingerprintMap.get(fingerprint) || [];
  }
}
