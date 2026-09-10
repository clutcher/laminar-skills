import { findInnermostHolding, isALanguageWordOrAnEverydayName, isPlacedInSource, liesInTheTypeOutsideItsMethods, namesAReceiver, formatPlaceKey, RELATION_KINDS, Scale, doesSpanHoldLine } from "../../../../code/index.mjs";

export const MAX_CONTEXT_LINES = 8;

const CONTEXT_SCALES = new Set([Scale.METHOD, Scale.CLASS]);

const PRIORITIES = Object.freeze({ ENCLOSING_CLASS: 0, CALL_SITE: 0, CALLER: 1, FIELD: 2, TYPE: 2, HELPER: 3 });

const NAMING_KINDS = new Set([RELATION_KINDS.CALLS, RELATION_KINDS.USES_TYPE]);

const FIELD_KINDS = new Set([RELATION_KINDS.READS_FIELD, RELATION_KINDS.WRITES_FIELD]);

const readLastLine = abstraction => abstraction.place.endLine ?? abstraction.place.startLine;

const listLineNumbers = abstraction => Array.from({ length: readLastLine(abstraction) - abstraction.place.startLine + 1 }, (_, offset) => abstraction.place.startLine + offset);

const readSpan = abstraction => ({ from: abstraction.place.startLine, to: readLastLine(abstraction) });

const encloses = (abstraction, place) => abstraction.place.file === place.path && doesSpanHoldLine(readSpan(abstraction), place.line);

const isAnIdentifyingName = name => Boolean(name) && !isALanguageWordOrAnEverydayName(name);

const holdsAHeadLine = abstraction => Boolean(abstraction) && isPlacedInSource(abstraction);

const readHeadPlace = abstraction => ({ path: abstraction.place.file, line: abstraction.place.startLine });

const isInside = (outer, inner) => outer === inner || encloses(outer, readHeadPlace(inner));

export class ReferenceContext {
  constructor(references, changedPaths) {
    this.references = references;
    this.graph = references.graph;
    this.changedPaths = new Set(changedPaths);
  }

  chooseContextLines(abstraction, uses, shownOwnLines = []) {
    const item = this.findReviewedAbstraction(abstraction);
    if (!item) return [];
    const useKeys = new Set(uses.map(formatPlaceKey));
    const slots = [
      ...this.listEnclosingClassHeads(item).map(place => ({ place, priority: PRIORITIES.ENCLOSING_CLASS })),
      ...uses.flatMap(use => (use.withContext && !encloses(item, use) ? this.listCallerAndEnclosingClass(use, item) : [])),
      ...this.findCallSites(item).filter(place => !useKeys.has(formatPlaceKey(place)))
        .flatMap(place => [...this.listCallerAndEnclosingClass(place, item), { place, priority: PRIORITIES.CALL_SITE }]),
      ...this.listHelperHeads(item).map(place => ({ place, priority: PRIORITIES.HELPER })),
      ...this.findFieldsReadByTheItem(item).map(place => ({ place, priority: PRIORITIES.FIELD })),
    ];
    const chosen = this.chooseContext(slots, useKeys, new Set(shownOwnLines), abstraction.path);
    const orderedPlacesByKeyMap = new Map();
    for (const slot of slots) {
      const key = formatPlaceKey(slot.place);
      if (chosen.has(key) && !orderedPlacesByKeyMap.has(key)) orderedPlacesByKeyMap.set(key, chosen.get(key));
    }
    return [...orderedPlacesByKeyMap.values()];
  }

  chooseContext(slots, useKeys, ownLines, ownPath) {
    const choicesByKeyMap = new Map();
    slots.forEach((slot, order) => {
      const key = formatPlaceKey(slot.place);
      if (useKeys.has(key) || (slot.place.path === ownPath && ownLines.has(slot.place.line))) return;
      const contextChoice = choicesByKeyMap.get(key);
      if (!contextChoice) choicesByKeyMap.set(key, { place: slot.place, priority: slot.priority, order });
      else contextChoice.priority = Math.min(contextChoice.priority, slot.priority);
    });
    const chosenByKeyMap = new Map();
    const ranked = [...choicesByKeyMap.entries()].sort(([, left], [, right]) => left.priority - right.priority || left.order - right.order);
    for (const [key, rankedChoice] of ranked) {
      if (chosenByKeyMap.size === MAX_CONTEXT_LINES) break;
      const placed = this.references.buildPlace(rankedChoice.place.path, rankedChoice.place.line);
      if (placed.text) chosenByKeyMap.set(key, placed);
    }
    return chosenByKeyMap;
  }

  findReviewedAbstraction(reviewAbstraction) {
    if (!this.graph || !reviewAbstraction.path) return null;
    const reviewed = this.graph.findAbstractionsIn(reviewAbstraction.path).find(abstraction => abstraction.reviewId === reviewAbstraction.id);
    return reviewed && CONTEXT_SCALES.has(reviewed.scale) ? reviewed : null;
  }

  findCallSites(item) {
    return item.scale === Scale.METHOD ? this.references.findPlacesReaching(item).filter(place => !encloses(item, place)) : [];
  }

  findTheClassHoldingTheMethod(item) {
    const enclosingClass = item.parent;
    return item.scale === Scale.METHOD && holdsAHeadLine(enclosingClass) && enclosingClass.scale === Scale.CLASS ? enclosingClass : null;
  }

  listEnclosingClassHeads(item) {
    const enclosingClass = this.findTheClassHoldingTheMethod(item);
    return enclosingClass ? [readHeadPlace(enclosingClass)] : [];
  }

  findEnclosingAtPlace(place, scale) {
    return findInnermostHolding(this.graph.findAbstractionsIn(place.path).filter(abstraction => abstraction.scale === scale && abstraction.place.file === place.path), place.line, readSpan);
  }

  listCallerAndEnclosingClass(place, item) {
    const type = this.findEnclosingAtPlace(place, Scale.CLASS);
    const method = this.findEnclosingAtPlace(place, Scale.METHOD);
    const callsTheItem = this.namesTheItemAtPlace(place, item);
    const isOutsideABody = !method || (method.place.startLine === place.line && readLastLine(method) === place.line);
    const heads = [
      type && (callsTheItem || isOutsideABody) ? { abstraction: type, priority: callsTheItem ? PRIORITIES.CALLER : PRIORITIES.TYPE } : null,
      method ? { abstraction: method, priority: PRIORITIES.CALLER } : null,
    ].filter(head => head && head.abstraction.place.startLine !== place.line);
    const fields = type ? this.findFieldDeclarationsInType(type, this.collectNamesReadAtLines(place.path, [place.line])) : [];
    return [
      ...heads.map(({ abstraction, priority }) => ({ place: readHeadPlace(abstraction), priority })),
      ...fields.map(field => ({ place: field, priority: PRIORITIES.FIELD })),
    ];
  }

  namesTheItemAtPlace(place, item) {
    return this.references.lines.findReferencesAtLine(place.path, place.line).some(reference => reference.name === item.name);
  }

  collectNamesReadAtLines(filePath, lines) {
    const read = lines.flatMap(line => this.references.lines.findReferencesAtLine(filePath, line))
      .flatMap(reference => [FIELD_KINDS.has(reference.kind) ? reference.name : null, namesAReceiver(reference.receiver) ? reference.receiver : null])
      .filter(isAnIdentifyingName);
    return [...new Set(read)];
  }

  findFieldDeclarationsInType(type, names) {
    const filePath = type.place.file;
    const methods = this.graph.findAbstractionsIn(filePath).filter(abstraction => abstraction.scale === Scale.METHOD && encloses(type, readHeadPlace(abstraction)));
    const declaresTheField = (line, name) => liesInTheTypeOutsideItsMethods(readSpan(type), methods.map(readSpan), line)
      && this.references.lines.findReferencesAtLine(filePath, line).some(reference => reference.name === name && FIELD_KINDS.has(reference.kind));
    return names.flatMap(name => {
      const line = this.references.lines.listLinesNaming(filePath, name).find(lineNumber => declaresTheField(lineNumber, name));
      return line ? [{ path: filePath, line }] : [];
    });
  }

  findFieldsReadByTheItem(item) {
    const enclosingClass = this.findTheClassHoldingTheMethod(item);
    return enclosingClass ? this.findFieldDeclarationsInType(enclosingClass, this.collectNamesReadAtLines(item.place.file, listLineNumbers(item))) : [];
  }

  isAHelperInTheChange(target) {
    return CONTEXT_SCALES.has(target.scale) && this.changedPaths.has(target.place.file);
  }

  listHelperHeads(item) {
    const targets = listLineNumbers(item)
      .flatMap(line => this.references.lines.findReferencesAtLine(item.place.file, line))
      .filter(reference => NAMING_KINDS.has(reference.kind))
      .flatMap(reference => this.references.targets.findTargets(reference))
      .filter(holdsAHeadLine)
      .filter(target => this.isAHelperInTheChange(target))
      .filter(target => !isInside(item, target) && !isInside(target, item));
    return [...new Set(targets)].map(readHeadPlace);
  }
}
