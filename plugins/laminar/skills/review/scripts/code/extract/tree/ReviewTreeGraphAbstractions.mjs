import { AbstractionChange } from "../../inputs/change/AbstractionChange.mjs";
import { VISIBILITIES } from "./AbstractionTree.mjs";
import { Scale } from "../../graph/abstractions/Scale.mjs";

const SCALES_WITH_A_VISIBILITY = new Set([Scale.CLASS, Scale.METHOD, Scale.VARIABLE]);

export class ReviewTreeGraphAbstractions {
  constructor({ tree, findOrAddAbstractions }) {
    this.tree = tree;
    this.findOrAddAbstractions = findOrAddAbstractions;
    this.abstractionsByAbstractionMap = new Map();
  }

  matchTheTree() {
    for (const root of this.tree.roots) this.readTreeAbstraction(root, null);
    return this;
  }

  readGraphAbstractionsOf(abstraction) {
    return this.abstractionsByAbstractionMap.get(abstraction) || [];
  }

  readTreeAbstraction(reviewAbstraction, parent) {
    const abstractions = this.findOrAddAbstractions(reviewAbstraction, parent);
    this.abstractionsByAbstractionMap.set(reviewAbstraction, abstractions);
    for (const abstraction of abstractions) this.copyFromTheReviewAbstraction(abstraction, reviewAbstraction);
    for (const child of reviewAbstraction.children) this.readTreeAbstraction(child, abstractions[0] || parent);
  }

  copyFromTheReviewAbstraction(abstraction, reviewAbstraction) {
    if (!abstraction.reviewId) abstraction.reviewId = reviewAbstraction.id;
    if (SCALES_WITH_A_VISIBILITY.has(abstraction.scale) && !abstraction.visibility) {
      abstraction.visibility = reviewAbstraction.visibility;
      abstraction.onParentBoundary = reviewAbstraction.visibility === VISIBILITIES.EXPOSED;
    }
    const change = AbstractionChange.createFromChangeKind(reviewAbstraction.changeKind, reviewAbstraction.changedLines ? { ...reviewAbstraction.changedLines } : null);
    if (change && !abstraction.change) abstraction.change = change;
  }
}
