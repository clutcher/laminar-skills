import { IMPORT_OR_NAMESPACE_LINE_PATTERN, isOwnCodeAt, readLanguageFamily } from "../../../../../code/index.mjs";

const carriesADecision = place => !IMPORT_OR_NAMESPACE_LINE_PATTERN.test(place.text);

export const findDecisionPlacesNamingTheKeyOutsideTheOwnCode = (references, key, ownPath, ownLines) => references.findPlacesNamed(key, readLanguageFamily(ownPath))
  .filter(carriesADecision)
  .filter(place => !isOwnCodeAt(place, ownPath, ownLines));
