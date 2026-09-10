import { readDescribedFields, readFoundFields } from "../../../code/index.mjs";

const removeKey = (namedValues, key) => Object.fromEntries(Object.entries(namedValues || {}).filter(([name]) => name !== key));

const WALK_MEASURE = "nestingDepth";
const WALK_SETTLED_FACT = "nestedUsedBare";

function createReviewedAbstraction(extracted) {
  return {
    id: extracted.id,
    ...readDescribedFields(extracted),
    kind: null,
    referenceLines: extracted.referenceLines,
    fields: extracted.fields || null,
    changedLines: extracted.changedLines || null,
    measures: removeKey(extracted.measures, WALK_MEASURE),
    openConstructs: null,
    callArgumentFunctions: [],
    callArgumentCalls: [],
    facts: removeKey(extracted.facts, WALK_SETTLED_FACT),
    sameDecisionAt: [],
    occurrences: [],
    reachingTests: null,
    testFriction: null,
    ioReach: null,
    changedBranches: null,
    namedDeclarations: null,
    outsideDeclaration: null,
    comments: extracted.comments,
    commentsOnly: Boolean(extracted.commentsOnly),
    module: extracted.module,
    homeModule: null,
    searchScope: null,
    fieldReadings: [],
    slice: null,
    children: [],
  };
}

const buildReviewedJson = abstraction => ({
  id: abstraction.id,
  ...readDescribedFields(abstraction),
  ...(abstraction.kind ? { kind: abstraction.kind } : {}),
  ...readFoundFields(abstraction),
  openConstructs: abstraction.openConstructs,
  ...(abstraction.callArgumentFunctions.length ? { callArgumentFunctions: abstraction.callArgumentFunctions } : {}),
  ...(abstraction.callArgumentCalls.length ? { callArgumentCalls: abstraction.callArgumentCalls } : {}),
  sameDecisionAt: abstraction.sameDecisionAt,
  occurrences: abstraction.occurrences,
  reachingTests: abstraction.reachingTests,
  testFriction: abstraction.testFriction,
  ioReach: abstraction.ioReach,
  changedBranches: abstraction.changedBranches,
  namedDeclarations: abstraction.namedDeclarations,
  outsideDeclaration: abstraction.outsideDeclaration,
  homeModule: abstraction.homeModule,
  searchScope: abstraction.searchScope,
  slice: abstraction.slice,
  children: abstraction.children.map(buildReviewedJson),
});

export class ReviewTree {
  constructor(extractedAbstractions) {
    this.roots = [];
    this.abstractionByIdMap = new Map();
    for (const extractedAbstraction of extractedAbstractions) {
      const abstraction = createReviewedAbstraction(extractedAbstraction);
      this.abstractionByIdMap.set(abstraction.id, abstraction);
      if (extractedAbstraction.parent) this.abstractionByIdMap.get(extractedAbstraction.parent).children.push(abstraction);
      else this.roots.push(abstraction);
    }
  }

  listEveryAbstraction() {
    const found = [];
    const visit = abstraction => { found.push(abstraction); for (const child of abstraction.children) visit(child); };
    for (const root of this.roots) visit(root);
    return found;
  }

  findAbstractionAt(id) {
    return this.abstractionByIdMap.get(id) || null;
  }

  convertToJson() {
    return this.roots.map(buildReviewedJson);
  }
}
