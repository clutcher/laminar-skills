import { doesSpanHoldLine } from "../../graph/abstractions/Place.mjs";
import { findDriver } from "../../inputs/source/drivers/LanguageRegistry.mjs";
import { findAddedLinesOfTheFile } from "../../inputs/change/ChangedLines.mjs";
import { readCallEffects } from "../finders/LanguageStrategies.mjs";

export const INTERACTION_LINES = Object.freeze({ ADDED: "added", ANY: "any" });

export class AbstractionFacts {
  static createNone() {
    return { hiddenDependency: false, interactionAssertion: false };
  }

  constructor({ walk, addedLinesByPathMap }) {
    this.walk = walk;
    this.addedLinesByPathMap = addedLinesByPathMap;
  }

  build(abstraction, lines, span = null, interactionLines = INTERACTION_LINES.ADDED) {
    return {
      hiddenDependency: readCallEffects((findDriver(abstraction.path) || {}).diffDriver).holdsAHiddenDependency(lines),
      interactionAssertion: abstraction.isTest && this.holdsAnInteractionAssertion(abstraction.path, span, interactionLines),
    };
  }

  holdsAnInteractionAssertion(filePath, span, interactionLines) {
    if (!span) return false;
    const added = findAddedLinesOfTheFile(this.addedLinesByPathMap, filePath);
    return this.walk.readTestFacts(filePath).interactionAssertions
      .some(line => doesSpanHoldLine(span, line) && (interactionLines === INTERACTION_LINES.ANY || added.has(line)));
  }
}
