export const TypeParametersInScope = {
  collectTypeParametersAtTheLine(file, index) {
    const enclosingGenerics = this.findGenericDeclarations(file).filter(genericDeclaration => genericDeclaration.line - 1 <= index && genericDeclaration.to - 1 >= index);
    return new Set(enclosingGenerics.flatMap(genericDeclaration => genericDeclaration.typeParameters));
  },

  findGenericDeclarations(file) {
    if (!this.genericDeclarationsByPathMap) {
      this.genericDeclarationsByPathMap = new Map();
      for (const genericDeclaration of [...this.types, ...this.methods]) if (genericDeclaration.typeParameters.length) this.add(this.genericDeclarationsByPathMap, genericDeclaration.path, genericDeclaration);
    }
    return this.genericDeclarationsByPathMap.get(file.path) || [];
  },
};
