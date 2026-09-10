import { Abstraction, ABSTRACTION_KINDS, formatAbstractionId } from "../../graph/abstractions/Abstraction.mjs";
import { CHANGE_KINDS } from "../../inputs/change/AbstractionChange.mjs";
import { Place } from "../../graph/abstractions/Place.mjs";
import { Scale } from "../../graph/abstractions/Scale.mjs";
import { readFolderPath } from "../../../files/paths.mjs";

const createPlaceOfSpan = (file, lines) => (lines ? new Place({ file, startLine: lines.from, endLine: lines.to }) : new Place({ file }));

export class ReviewTreeAbstractions {
  constructor({ walker }) {
    this.walker = walker;
    this.graph = walker.graph;
  }

  getOrAddAbstractionsOf(abstraction, parent) {
    if (abstraction.scale === Scale.APPLICATION.name) return [this.walker.findOrAddTheApplication(abstraction.path)];
    if (abstraction.scale === Scale.MODULE.name) return [this.walker.findOrAddTheModule(abstraction.path)];
    const enclosingAbstraction = parent || this.walker.findOrAddTheModule(readFolderPath(abstraction.path));
    if (abstraction.scale === Scale.CLASS.name) return abstraction.changeKind === CHANGE_KINDS.REFERENCE ? [] : [this.getOrAddClass(abstraction, enclosingAbstraction)];
    if (abstraction.scale === Scale.METHOD.name) return [this.getOrAddMethod(abstraction, enclosingAbstraction)];
    if (abstraction.fields) return abstraction.fields.map(field => this.getOrAddVariable(abstraction.path, enclosingAbstraction, field.name, field.displayName, field.lines));
    return [this.getOrAddVariable(abstraction.path, enclosingAbstraction, abstraction.name, abstraction.displayName, abstraction.lines)];
  }

  findDeclaredAbstraction(filePath, scale, name, lines) {
    return lines ? this.walker.findAbstractionDeclaredAt(filePath, lines.from, scale, name) : null;
  }

  findClassNamed(filePath, name) {
    const fileClass = this.walker.findWalkedFileClass(filePath);
    if (!fileClass) return null;
    return [fileClass, ...fileClass.collectDescendants()].find(abstraction => abstraction.scale === Scale.CLASS && abstraction.name === name) || null;
  }

  addAbstraction({ scale, kind = null, filePath, name, qualifiedName, lines }, enclosingAbstraction) {
    return this.graph.add(new Abstraction({
      id: this.graph.chooseFreeId(formatAbstractionId(scale, filePath, qualifiedName)),
      scale,
      kind,
      name,
      qualifiedName,
      place: createPlaceOfSpan(filePath, lines),
      complete: Boolean(lines),
    }), enclosingAbstraction);
  }

  getOrAddClass(abstraction, enclosingAbstraction) {
    return this.findDeclaredAbstraction(abstraction.path, Scale.CLASS.name, abstraction.name, abstraction.lines) || this.findClassNamed(abstraction.path, abstraction.name)
      || this.addAbstraction({ scale: Scale.CLASS, filePath: abstraction.path, name: abstraction.name, qualifiedName: abstraction.displayName, lines: abstraction.lines }, enclosingAbstraction);
  }

  getOrAddMethod(abstraction, enclosingAbstraction) {
    return this.findDeclaredAbstraction(abstraction.path, Scale.METHOD.name, abstraction.name, abstraction.lines)
      || this.addAbstraction({ scale: Scale.METHOD, filePath: abstraction.path, name: abstraction.name, qualifiedName: abstraction.displayName, lines: abstraction.lines }, enclosingAbstraction);
  }

  getOrAddVariable(filePath, enclosingAbstraction, name, qualifiedName, lines) {
    const kind = enclosingAbstraction.scale === Scale.METHOD ? ABSTRACTION_KINDS.LOCAL : null;
    return this.findDeclaredAbstraction(filePath, Scale.VARIABLE.name, name, lines)
      || this.addAbstraction({ scale: Scale.VARIABLE, kind, filePath, name, qualifiedName, lines }, enclosingAbstraction);
  }
}
