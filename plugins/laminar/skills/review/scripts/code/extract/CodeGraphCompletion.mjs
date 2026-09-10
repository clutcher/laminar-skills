import { markTheExitBoundaries } from "./calls/ExitRoles.mjs";
import { resolveTheWalkedReferences } from "./walk/WalkedReferenceResolution.mjs";
import { CallGraphReading } from "./calls/CallGraphReading.mjs";
import { FinderContext } from "./finders/FinderContext.mjs";
import { ReviewTreeAbstractions } from "./tree/ReviewTreeAbstractions.mjs";
import { ReviewTreeGraphAbstractions } from "./tree/ReviewTreeGraphAbstractions.mjs";

export class CodeGraphCompletion {
  constructor(step, tree) {
    this.step = step;
    this.tree = tree;
  }

  complete() {
    const codeGraph = this.readTheCallGraphs();
    const treeGraphAbstractions = this.matchTheReviewTree();
    markTheExitBoundaries(codeGraph, filePath => FinderContext.createForAWalkedFile(filePath, this.step.walk.findFrameworksMarkedInTheWalkedFile(filePath), this.step.applications));
    resolveTheWalkedReferences(this.step.walker.graph);
    return { codeGraph, treeGraphAbstractions };
  }

  readTheCallGraphs() {
    const callGraphs = this.step.callGraphs ? this.step.callGraphs.listEveryCallGraph() : [];
    return new CallGraphReading({ callGraphs, walker: this.step.walker }).read();
  }

  matchTheReviewTree() {
    const treeAbstractions = new ReviewTreeAbstractions({ walker: this.step.walker });
    return new ReviewTreeGraphAbstractions({ tree: this.tree, findOrAddAbstractions: (abstraction, parent) => treeAbstractions.getOrAddAbstractionsOf(abstraction, parent) }).matchTheTree();
  }
}
