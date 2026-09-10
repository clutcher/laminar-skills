import { readLanguageFamily, Scale } from "../../../../code/index.mjs";

export class AbstractionLookup {
  constructor(graph) {
    this.graph = graph;
  }

  findAbstractionNamed(filePath, name) {
    const matching = this.graph.findAbstractionsIn(filePath).filter(abstraction => abstraction.name === name && abstraction.signature.text);
    return matching.find(abstraction => abstraction.scale === Scale.CLASS) || matching[0] || null;
  }

  declaresAValueNamed(name, family) {
    return this.graph.findDeclaredAfterTheChangeNamed(name, Scale.VARIABLE).some(abstraction => readLanguageFamily(abstraction.place.file) === family);
  }

  findAbstractionAt(filePath, line, name) {
    return this.graph.findAbstractionsDeclaredAt(filePath, line).find(abstraction => abstraction.name === name && abstraction.signature.text) || null;
  }
}
