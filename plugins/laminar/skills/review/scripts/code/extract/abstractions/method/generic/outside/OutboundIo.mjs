const NO_NAMES = Object.freeze([]);

const isUnder = (module, root, separator) => module === root || module.startsWith(`${root}${separator}`);

export class OutboundIo {
  constructor({ exitModules = NO_NAMES, globalCallees = NO_NAMES } = {}) {
    this.exitModules = exitModules;
    this.globalCallees = globalCallees;
    Object.freeze(this);
  }

  findExitModuleHolding(name, separator) {
    return this.exitModules.find(root => isUnder(String(name), root, separator));
  }

  holdsTheGlobalCallee(callee) {
    return this.globalCallees.includes(callee);
  }
}

export const NO_OUTBOUND_IO = new OutboundIo();
