import { NO_ENCLOSING_HEAD } from "../../inputs/source/declarations/SourceHeads.mjs";

const liesInside = (declaration, type) => declaration.span.from >= type.span.from && declaration.span.to <= type.span.to;

export class FilePlacement {
  constructor(walker, { filePath, declarations, topTypes, filesOwnType, fileClass }) {
    this.walker = walker;
    this.filePath = filePath;
    this.declarations = declarations;
    this.topTypes = topTypes;
    this.filesOwnType = filesOwnType;
    this.fileClass = fileClass;
    this.placed = [];
  }

  placeEveryDeclaration() {
    this.declarations.forEach((declaration, position) => {
      if (declaration === this.filesOwnType) { this.placed[position] = this.fileClass; return; }
      this.placeAt(position);
    });
  }

  listPlacedOtherThanTheFileClass() {
    return this.placed.filter(placedAbstraction => placedAbstraction !== this.fileClass);
  }

  placeAt(position) {
    if (!this.placed[position]) this.placed[position] = this.walker.place(this.filePath, this.declarations[position], this.findEnclosingAbstraction(this.declarations[position]));
    return this.placed[position];
  }

  findEnclosingAbstraction(declaration) {
    if (declaration.enclosingHeadOrder !== NO_ENCLOSING_HEAD) return this.placeAt(declaration.enclosingHeadOrder);
    const scopeType = declaration.declaredScope ? this.topTypes.find(type => type.name === declaration.declaredScope) : null;
    if (scopeType) return scopeType === this.filesOwnType ? this.fileClass : this.placeAt(this.declarations.indexOf(scopeType));
    if (this.filesOwnType && !liesInside(declaration, this.filesOwnType)) return this.walker.findOrAddTheFileClassBesideTheType(this.filePath, this.topTypes);
    return this.fileClass;
  }
}
