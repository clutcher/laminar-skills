import { METHOD_FINDER_REGISTRY } from "../abstractions/method/index.mjs";
import { FinderContext } from "../finders/FinderContext.mjs";

const findRelationFinderOfTheFile = filePath => METHOD_FINDER_REGISTRY.findRelationFinder(FinderContext.createForFile(filePath));

export function resolveTheWalkedReferences(graph) {
  for (const reference of graph.walkedReferences) {
    if (reference.isAReadCall()) continue;
    const resolution = findRelationFinderOfTheFile(reference.place.file).resolve(reference, graph);
    if (resolution) graph.resolveWalked(reference, resolution);
  }
  return graph;
}
