import { findInnermostHolding, Place } from "../../graph/abstractions/Place.mjs";
import { Reference } from "../../graph/relations/Reference.mjs";

export const WALKED_REFERENCES_FOUND_BY = "GenericMethodRelationFinder";

export function recordTheWalkedReferences(graph, filePath, references, placed, fileClass) {
  for (const { line, kind, name, receiver, form } of references) {
    graph.recordWalkedReference(new Reference({
      kind,
      from: findInnermostHolding(placed, line, placedAbstraction => placedAbstraction.place.span) || fileClass,
      name,
      receiver,
      place: new Place({ file: filePath, startLine: line }),
      foundBy: WALKED_REFERENCES_FOUND_BY,
      form,
    }));
  }
}
