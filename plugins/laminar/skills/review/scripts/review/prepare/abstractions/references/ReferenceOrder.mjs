import { IMPORT_OR_NAMESPACE_LINE_PATTERN, isOwnCodeAt, readOwnSpans, formatPlaceKey } from "../../../../code/index.mjs";
import { collectIdentifierKeys } from "../walks/decisions/SameDecisionWalk.mjs";

export const MAX_LINES_PER_KEY = 5;

const isAUseOutsideTheAbstraction = (place, text, abstraction, ownSpans) => !IMPORT_OR_NAMESPACE_LINE_PATTERN.test(text) && !isOwnCodeAt(place, abstraction.path, ownSpans);

export class ReferenceOrder {
  constructor(references, decisionSearches = []) {
    this.references = references;
    this.addedLinesByIdMap = new Map(decisionSearches.map(search => [search.abstraction, search.addedLines]));
  }

  orderPlaces(abstraction, uses, context) {
    const shownByPlaceMap = new Map([...uses, ...context].map(place => [formatPlaceKey(place), place]));
    const shownFiles = [...new Set([...shownByPlaceMap.values()].map(place => place.path))].sort();
    const placedByKeyMap = new Map();
    for (const key of this.searchKeysOf(abstraction)) {
      for (const foundPlace of this.findFirstPlacesHolding(key, shownFiles, abstraction)) {
        const placeKey = formatPlaceKey(foundPlace);
        if (shownByPlaceMap.has(placeKey) && !placedByKeyMap.has(placeKey)) placedByKeyMap.set(placeKey, shownByPlaceMap.get(placeKey));
      }
    }
    const isUnplaced = place => !placedByKeyMap.has(formatPlaceKey(place));
    return [...placedByKeyMap.values(), ...uses.filter(isUnplaced), ...context.filter(isUnplaced)];
  }

  searchKeysOf(abstraction) {
    const addedLines = this.addedLinesByIdMap.get(abstraction.id) || [];
    return collectIdentifierKeys(addedLines).map(found => found.key);
  }

  findFirstPlacesHolding(key, filePaths, abstraction) {
    const places = [];
    const ownSpans = readOwnSpans(abstraction);
    for (const filePath of filePaths) {
      const lines = this.references.readFileLines(filePath) || [];
      for (let index = 0; index < lines.length && places.length < MAX_LINES_PER_KEY; index++) {
        const place = { path: filePath, line: index + 1 };
        const text = lines[index] || "";
        if (text.includes(key) && isAUseOutsideTheAbstraction(place, text, abstraction, ownSpans)) places.push(place);
      }
    }
    return places;
  }
}
