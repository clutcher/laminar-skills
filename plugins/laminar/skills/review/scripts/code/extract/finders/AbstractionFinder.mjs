import { Strategy } from "./Strategy.mjs";
import { listDeclarationHeads, NO_ENCLOSING_HEAD } from "../../inputs/source/declarations/SourceHeads.mjs";

export const readEnclosingHeadOrder = parent => (parent ? parent.order : NO_ENCLOSING_HEAD);

export const findHeadsEnclosedBy = (parent, source, scaleName) => listDeclarationHeads(source)
  .filter(head => head.enclosingHeadOrder === readEnclosingHeadOrder(parent) && head.scale === scaleName);

export class AbstractionFinder extends Strategy {
  findIn(parent, source) {
    return findHeadsEnclosedBy(parent, source, this.scale.name);
  }
}
