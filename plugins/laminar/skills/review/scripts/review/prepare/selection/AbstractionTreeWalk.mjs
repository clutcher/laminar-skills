import { Scale, CHANGE_KINDS } from "../../../code/index.mjs";
import { owesATest } from "../abstractions/walks/testing/TestReachWalk.mjs";

const holdsAnIoChain = abstraction => Boolean(abstraction.ioReach) && (abstraction.ioReach.down.length + abstraction.ioReach.up.length) > 0;

const HIDDEN_CROSSING_PATTERN = / · hidden in /;

export const holdsABoundaryFact = abstraction => {
  const module = abstraction.module || {};
  return Boolean(module.exposedDomain || module.appImportsInOut || module.spiImplementedInsideApp)
    || (module.crossings || []).some(line => HIDDEN_CROSSING_PATTERN.test(line));
};

const KINDS_JUDGED_BELOW_THEIR_OWN_SCALE = new Set([CHANGE_KINDS.INTERNALS_CHANGED, CHANGE_KINDS.MOVED]);

const isAMethodWithItsOwnChange = abstraction => abstraction.scale === Scale.METHOD.name && abstraction.changeKind !== CHANGE_KINDS.MOVED;

const schedulesItsOwnScale = abstraction => {
  if (!KINDS_JUDGED_BELOW_THEIR_OWN_SCALE.has(abstraction.changeKind)) return true;
  return isAMethodWithItsOwnChange(abstraction) || (abstraction.scale === Scale.MODULE.name && holdsABoundaryFact(abstraction));
};

const SCALES_OF_CODE = new Set([Scale.CLASS.name, Scale.METHOD.name, Scale.VARIABLE.name]);

const isCode = abstraction => SCALES_OF_CODE.has(abstraction.scale);

const listEveryAbstractionUnder = abstraction => abstraction.children.flatMap(child => [child, ...listEveryAbstractionUnder(child)]);

export class AbstractionTreeWalk {
  constructor(abstractions) {
    this.abstractions = abstractions;
  }

  collectSelectedAbstractions() {
    const found = [];
    const visit = abstraction => {
      if (schedulesItsOwnScale(abstraction)) found.push(abstraction);
      for (const child of abstraction.children) visit(child);
    };
    for (const root of this.abstractions) visit(root);
    return found;
  }

  listEveryAbstraction() {
    const found = [];
    const visit = abstraction => { found.push(abstraction); for (const child of abstraction.children) visit(child); };
    for (const root of this.abstractions) visit(root);
    return found;
  }

  findIoChainAbstractions() {
    const found = [];
    const visit = (abstraction, application) => {
      if (holdsAnIoChain(abstraction)) found.push({ abstraction, application });
      for (const child of abstraction.children) visit(child, abstraction.scale === Scale.APPLICATION.name ? abstraction : application);
    };
    for (const root of this.abstractions) visit(root, null);
    return found;
  }

  findApplicationsWithChangedCode(keeps) {
    return this.abstractions.filter(root => root.scale === Scale.APPLICATION.name && listEveryAbstractionUnder(root).some(abstraction => isCode(abstraction) && keeps(abstraction)));
  }

  findBoundariesOwingATest() {
    const found = [];
    const visit = (abstraction, application) => {
      if (abstraction.scale === Scale.MODULE.name) {
        found.push(...abstraction.children.filter(owesATest).map(child => ({ abstraction: child, application, module: abstraction })));
        return;
      }
      for (const child of abstraction.children) visit(child, abstraction.scale === Scale.APPLICATION.name ? abstraction : application);
    };
    for (const root of this.abstractions) visit(root, null);
    return found;
  }
}
