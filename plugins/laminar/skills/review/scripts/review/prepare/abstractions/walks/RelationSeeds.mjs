import { CHANGE_KINDS, formatDisplayName, Scale } from "../../../../code/index.mjs";

const isAClassJudgedWhole = abstraction => abstraction.scale === Scale.CLASS.name && Boolean(abstraction.judgedWhole);

const isADeclaredMethod = graphAbstraction => graphAbstraction.scale === Scale.METHOD && Boolean(graphAbstraction.place) && graphAbstraction.place.hasASourceLine;

const isTheSameMethod = (treeMethod, graphMethod) => treeMethod.name === graphMethod.name
  && treeMethod.lines.from <= graphMethod.place.startLine && graphMethod.place.startLine <= treeMethod.lines.to;

const listLinesOfTheSpan = span => Array.from({ length: span.to - span.from + 1 }, (_, offset) => span.from + offset);

// A relation seed starts the design walks from a method the range did not change, under the id of the class abstraction of its file, and never enters the tree.
const createRelationSeed = (classAbstraction, graphMethod) => ({
  id: classAbstraction.id,
  scale: Scale.METHOD.name,
  name: graphMethod.name,
  enclosingTypeName: graphMethod.enclosingTypeName,
  displayName: formatDisplayName(Scale.METHOD.name, graphMethod.name, graphMethod.enclosingTypeName),
  path: classAbstraction.path,
  changeKind: CHANGE_KINDS.INTERNALS_CHANGED,
  isTest: classAbstraction.isTest,
  lines: { from: graphMethod.place.startLine, to: graphMethod.place.endLine },
  children: [],
});

export class RelationSeeds {
  constructor(codeGraph, abstractions) {
    const treeMethods = abstractions.filter(abstraction => abstraction.scale === Scale.METHOD.name && abstraction.lines);
    this.seeds = abstractions.filter(isAClassJudgedWhole).flatMap(classAbstraction => codeGraph.findAbstractionsIn(classAbstraction.path)
      .filter(isADeclaredMethod)
      .filter(graphMethod => !treeMethods.some(treeMethod => treeMethod.path === classAbstraction.path && isTheSameMethod(treeMethod, graphMethod)))
      .map(graphMethod => createRelationSeed(classAbstraction, graphMethod)));
  }

  listSeeds() {
    return this.seeds;
  }

  readSeedLinesByPath() {
    const seedLinesByPathMap = new Map();
    for (const seed of this.seeds) {
      if (!seedLinesByPathMap.has(seed.path)) seedLinesByPathMap.set(seed.path, new Set());
      for (const line of listLinesOfTheSpan(seed.lines)) seedLinesByPathMap.get(seed.path).add(line);
    }
    return seedLinesByPathMap;
  }
}
