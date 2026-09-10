import { CLASS_FINDER_REGISTRY } from "../abstractions/class/index.mjs";
import { METHOD_FINDER_REGISTRY } from "../abstractions/method/index.mjs";
import { VARIABLE_FINDER_REGISTRY } from "../abstractions/variable/index.mjs";
import { FinderContext } from "../finders/FinderContext.mjs";
import { readDeclarationHeadsOfFiles } from "../../inputs/source/declarations/DiffDriverHeads.mjs";
import { readExtension } from "../../inputs/source/drivers/LanguageRegistry.mjs";
import { Scale } from "../../graph/abstractions/Scale.mjs";
import { NO_ENCLOSING_HEAD } from "../../inputs/source/declarations/SourceHeads.mjs";
import { measureSpans } from "../../inputs/source/declarations/DeclarationSpans.mjs";

const REGISTRIES_INSIDE_A_FILE = [CLASS_FINDER_REGISTRY, METHOD_FINDER_REGISTRY, VARIABLE_FINDER_REGISTRY];

const compareByOrder = (left, right) => left.order - right.order;

function listReadingsWithoutHeads(sources) {
  return sources.filter(source => !source.heads).flatMap(source => source.readings.map((numberedLines, at) => ({ source, at, texts: numberedLines.map(numberedLine => numberedLine.text) })));
}

export function readHeadsOf(sources) {
  const pending = listReadingsWithoutHeads(sources);
  const ownHeads = pending.map(({ source, texts }) => source.driver.findDeclarationHeads(texts));
  const byGit = pending.filter((reading, number) => !ownHeads[number]);
  const gitHeads = readDeclarationHeadsOfFiles(byGit.map(({ source, texts }) => ({ lines: texts, extension: readExtension(source.path) })), () => true);
  const headsByReadingMap = new Map(byGit.map((reading, number) => [reading, gitHeads[number]]));
  for (const source of new Set(pending.map(reading => reading.source))) source.setHeads(source.readings.map(() => []));
  pending.forEach((reading, number) => { reading.source.heads[reading.at] = ownHeads[number] || headsByReadingMap.get(reading); });
  return sources;
}

function listFinders(source) {
  const context = FinderContext.createForLanguage(source.language);
  return REGISTRIES_INSIDE_A_FILE.map(registry => registry.findWalkingFinder(context));
}

export function findAllIn(source) {
  readHeadsOf([source]);
  const finders = listFinders(source);
  const found = [];
  const walkInside = parent => {
    for (const finder of finders) {
      for (const head of finder.findIn(parent, source)) {
        found.push(head);
        walkInside(head);
      }
    }
  };
  walkInside(null);
  return found.sort(compareByOrder);
}

function removeLocalTextValues(found, source) {
  if (!found.some(head => head.holdsTextValue)) return found;
  const spans = measureSpans(found, source);
  const methods = found.map((head, position) => ({ head, span: spans[position] })).filter(({ head }) => head.scale === Scale.METHOD.name);
  const isLocal = head => head.holdsTextValue && methods.some(({ head: method, span }) => method.line < head.line && method.indent < head.indent && span.to >= head.line);
  return found.filter(head => !isLocal(head));
}

function mapEnclosingHeadsToPositions(kept) {
  const positionByOrderMap = new Map(kept.map((head, position) => [head.order, position]));
  return kept.map(({ order, enclosingHeadOrder, ...declaration }) => ({ ...declaration, enclosingHeadOrder: positionByOrderMap.has(enclosingHeadOrder) ? positionByOrderMap.get(enclosingHeadOrder) : NO_ENCLOSING_HEAD }));
}

export function readDeclarations(source) {
  const kept = mapEnclosingHeadsToPositions(removeLocalTextValues(findAllIn(source), source));
  const spans = measureSpans(kept, source);
  return kept.map((declaration, position) => ({ ...declaration, span: spans[position] }));
}

export function readShownDeclarations(source) {
  return mapEnclosingHeadsToPositions(findAllIn(source));
}
