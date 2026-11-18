import { collectTypeNames } from "../../../../code/index.mjs";

export const EXISTING_TYPE_HEADS = "existingTypeHeads";

export const SHAPE_TYPE_HEADS = "shapeTypeHeads";

export const MAX_TYPES_WITH_A_HEAD = 6;
export const MAX_LINES_OF_A_TYPE_HEAD = 12;

export class TypeHeads {
  constructor({ shapeTypeHeads, existingTypeHeads }) {
    this.shapeTypeHeads = shapeTypeHeads;
    this.existingTypeHeads = existingTypeHeads;
  }

  listSections(ownLines, { ownName, usedFrom }) {
    return this.listSectionsOfTheTypes(collectTypeNames(ownLines).filter(name => name !== ownName), usedFrom);
  }

  listSectionsOfTheTypes(typeNames, usedFrom) {
    const headedNames = typeNames.filter(name => this.shapeTypeHeads.holdsAHeadOf(name) || this.existingTypeHeads.holdsAHeadOf(name, usedFrom)).slice(0, MAX_TYPES_WITH_A_HEAD);
    const shapeHeads = this.shapeTypeHeads.listHeads(headedNames);
    const existingHeads = this.existingTypeHeads.listHeads(headedNames.filter(name => !this.shapeTypeHeads.holdsAHeadOf(name)), usedFrom);
    return [
      { section: EXISTING_TYPE_HEADS, lines: existingHeads.flat() },
      { section: SHAPE_TYPE_HEADS, lines: shapeHeads.flat() },
    ].filter(section => section.lines.length);
  }
}
