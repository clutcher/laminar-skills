import { Strategy } from "./Strategy.mjs";

export class RelationFinder extends Strategy {
  findReferencesIn() {
    return [];
  }

  resolve() {
    return null;
  }
}
