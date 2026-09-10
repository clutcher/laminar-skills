import { mapToUses, collectIdentifierKeys } from "./SameDecisionWalk.mjs";
import { findDecisionPlacesNamingTheKeyOutsideTheOwnCode } from "./KeyPlaces.mjs";

export class IdentifierUses {
  constructor(references) {
    this.references = references;
  }

  usesOf({ path: ownPath, ownLines, addedLines }) {
    const uses = [];
    for (const { key, kind } of collectIdentifierKeys(addedLines)) {
      const places = findDecisionPlacesNamingTheKeyOutsideTheOwnCode(this.references, key, ownPath, ownLines);
      if (places.length) uses.push({ key, kind, places });
    }
    return mapToUses(uses);
  }
}
