import { findDriver, isADeclaredType } from "../../../code/index.mjs";
import { countFolderSteps, measureSharedFolderDepth, readFileStem } from "../../../files/paths.mjs";

const listEnclosingTypes = abstraction => {
  const outerTypes = [];
  for (let at = abstraction.parent; at && isADeclaredType(at); at = at.parent) outerTypes.unshift(at);
  return outerTypes;
};

const isInALanguageWithADriver = abstraction => Boolean(findDriver(abstraction.place.file));

const readPath = found => found.type.place.file;

const isEnclosedBy = (found, enclosingTypeName) => !enclosingTypeName || readFileStem(readPath(found)) === enclosingTypeName || found.outerTypes.some(outerType => outerType.name === enclosingTypeName);

const compareNearestFirst = usedFrom => (left, right) => measureSharedFolderDepth(readPath(right), usedFrom) - measureSharedFolderDepth(readPath(left), usedFrom)
  || countFolderSteps(readPath(left), usedFrom) - countFolderSteps(readPath(right), usedFrom)
  || (readPath(left) < readPath(right) ? -1 : readPath(left) > readPath(right) ? 1 : 0) || left.type.place.startLine - right.type.place.startLine;

export class OutsideDeclarations {
  constructor(graph, places) {
    this.graph = graph;
    this.places = places;
  }

  readHeadText(abstraction) {
    return this.places.buildPlace(abstraction.place.file, abstraction.place.startLine).text;
  }

  buildFoundType(type) {
    const driver = findDriver(type.place.file);
    const outerTypes = listEnclosingTypes(type);
    return { type, outerTypes, enclosingTypes: outerTypes.filter(outerType => !driver.namesAPackage(this.readHeadText(outerType))) };
  }

  findTypesNamed(usedFrom, name) {
    return this.places.targets.findTypesNamed(usedFrom, name).filter(isInALanguageWithADriver);
  }

  findNearestType({ name, enclosingTypeName, usedFrom }) {
    return this.findTypesNamed(usedFrom, name)
      .map(type => this.buildFoundType(type))
      .filter(found => isEnclosedBy(found, enclosingTypeName))
      .sort(compareNearestFirst(usedFrom))[0];
  }

  readDeclarationLines(found) {
    return [found.type, ...found.enclosingTypes].map(type => this.places.buildPlace(type.place.file, type.place.startLine));
  }

  findTypeDeclaration(used, changedPaths) {
    const found = this.findNearestType(used);
    if (!found) return { lines: [] };
    return changedPaths.has(readPath(found)) ? null : { lines: this.readDeclarationLines(found) };
  }

  findOuterTypeOfBareUse(used) {
    const found = this.findNearestType(used);
    if (!found || readPath(found) === used.usedFrom) return null;
    const outer = found.enclosingTypes.find(outerType => outerType.name === used.enclosingTypeName);
    return outer ? outer.name : null;
  }
}
