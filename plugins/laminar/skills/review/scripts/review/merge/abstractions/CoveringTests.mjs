import { Scale, doesSpanHoldLine, TEST_KINDS, readTestHeadFactsOfTheFile, readTestKindWhere } from "../../../code/index.mjs";

const MAX_HELPER_LAYERS_UP_TO_A_TEST = 3;

const findTestKindOfTheAbstraction = (testHeadFacts, abstraction) => readTestKindWhere(testHeadFacts, line => doesSpanHoldLine(abstraction, line));

export class CoveringTests {
  constructor(codeGraph, abstractionAt) {
    this.codeGraph = codeGraph;
    this.findAbstractionAt = abstractionAt;
  }

  findTestsReaching(file, abstraction) {
    const testHeadFacts = readTestHeadFactsOfTheFile(this.codeGraph, file);
    const isATestMethod = reached => findTestKindOfTheAbstraction(testHeadFacts, reached) === TEST_KINDS.TEST;
    if (isATestMethod(abstraction)) return [abstraction];
    const visited = new Set([abstraction]);
    const tests = new Set();
    let abstractionsOfThisStep = [abstraction];
    for (let step = 0; step < MAX_HELPER_LAYERS_UP_TO_A_TEST && abstractionsOfThisStep.length; step++) {
      const callers = abstractionsOfThisStep.flatMap(reached => this.findCallersInTheFile(file, reached)).filter(caller => !visited.has(caller));
      callers.forEach(caller => visited.add(caller));
      callers.filter(isATestMethod).forEach(test => tests.add(test));
      abstractionsOfThisStep = [...new Set(callers.filter(caller => !isATestMethod(caller)))];
    }
    return [...tests];
  }

  findCallersInTheFile(file, abstraction) {
    const method = this.codeGraph.findAbstractionsIn(file)
      .find(walkedAbstraction => walkedAbstraction.scale.name === Scale.METHOD.name && walkedAbstraction.place.startLine === abstraction.from && walkedAbstraction.place.endLine === abstraction.to);
    if (!method) return [];
    return this.codeGraph.findWalkedReferencesNamed(method.name)
      .filter(reference => reference.place && reference.place.file === file)
      .sort((left, right) => left.place.startLine - right.place.startLine)
      .map(reference => this.findAbstractionAt(file, reference.place.startLine))
      .filter(caller => caller && caller !== abstraction && caller.scale === Scale.METHOD.name);
  }
}
