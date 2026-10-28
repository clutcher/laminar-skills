import { isTestPath } from "../../inputs/source/TestCode.mjs";
import { Scale } from "../../graph/abstractions/Scale.mjs";

const SCALES_OF_THE_REVIEW_TREE = Object.freeze([Scale.APPLICATION.name, Scale.MODULE.name, Scale.CLASS.name, Scale.METHOD.name, Scale.VARIABLE.name]);

export const VISIBILITIES = Object.freeze({ EXPOSED: "EXPOSED", PRIVATE: "PRIVATE" });

export const readVisibilityOfDeclaration = (driver, tag, name = tag.name) => (driver.isPrivate(tag.text, name, tag.indent) ? VISIBILITIES.PRIVATE : VISIBILITIES.EXPOSED);

export const readDescribedFields = abstraction => ({
  scale: abstraction.scale,
  name: abstraction.name,
  enclosingTypeName: abstraction.enclosingTypeName,
  displayName: abstraction.displayName,
  usedIn: abstraction.usedIn,
  path: abstraction.path,
  changeKind: abstraction.changeKind,
  ...(abstraction.publicChangeKind ? { publicChangeKind: abstraction.publicChangeKind } : {}),
  visibility: abstraction.visibility,
  isTest: abstraction.isTest,
  ...(abstraction.testKind ? { testKind: abstraction.testKind } : {}),
  boundaryRank: abstraction.boundaryRank,
  lines: abstraction.lines,
});

export const readFoundFields = abstraction => ({
  referenceLines: abstraction.referenceLines,
  ...(abstraction.fields ? { fields: abstraction.fields } : {}),
  measures: abstraction.measures,
  facts: abstraction.facts,
  comments: abstraction.comments,
  ...(abstraction.commentsOnly ? { commentsOnly: true } : {}),
  module: abstraction.module,
});

export const readOwnSpans = abstraction => [abstraction.lines, abstraction.changedLines].filter(Boolean).map(span => [span.from, span.to]);

export const isOwnCodeAt = (place, ownPath, ownLines) => place.path === ownPath
  && ownLines.some(([from, to]) => place.line >= from && place.line <= to);

export function formatDisplayName(scale, name, enclosingName) {
  if (scale === Scale.APPLICATION.name) return name;
  if (scale === Scale.MODULE.name) return name || ".";
  if (scale === Scale.CLASS.name) return enclosingName ? `${enclosingName}.${name}` : name;
  if (scale === Scale.METHOD.name) return `${enclosingName || name}#${name}`;
  if (enclosingName && enclosingName.includes("#")) return `${name} in ${enclosingName}`;
  return `${enclosingName}#${name}`;
}

export class ReviewTreeAbstraction {
  constructor({ id, scale, name, enclosingTypeName: enclosingName = null, displayName = formatDisplayName(scale, name, enclosingName), path: filePath, changeKind, publicChangeKind = null, visibility, boundaryRank, lines, referenceLines = [], fields = null, usedIn = "", isTest = isTestPath(filePath) }) {
    Object.assign(this, {
      id,
      scale,
      name,
      enclosingTypeName: enclosingName,
      displayName,
      usedIn,
      path: filePath,
      changeKind,
      publicChangeKind,
      visibility,
      isTest,
      boundaryRank,
      lines,
      referenceLines,
      fields,
      measures: {},
      facts: {},
      comments: [],
      module: null,
      children: [],
    });
  }

  add(child) {
    this.children.push(child);
    return child;
  }

  createExtractedAbstraction(parent, abstractions) {
    return {
      id: this.id,
      parent: parent ? parent.id : null,
      on: abstractions.map(abstraction => abstraction.id),
      ...readDescribedFields(this),
      ...(this.changedLines ? { changedLines: { ...this.changedLines } } : {}),
      ...readFoundFields(this),
    };
  }

  convertToJson() {
    return {
      id: this.id,
      ...readDescribedFields(this),
      ...readFoundFields(this),
      children: this.children.map(child => child.convertToJson()),
    };
  }
}

export class AbstractionTree {
  constructor() {
    this.roots = [];
    this.nextNumber = 1;
  }

  create(fields) {
    const abstraction = new ReviewTreeAbstraction({ ...fields, id: `A${this.nextNumber++}` });
    return abstraction;
  }

  addRoot(abstraction) {
    this.roots.push(abstraction);
    return abstraction;
  }

  listEveryAbstraction() {
    const found = [];
    const visit = abstraction => { found.push(abstraction); for (const child of abstraction.children) visit(child); };
    for (const root of this.roots) visit(root);
    return found;
  }

  findAbstractionAt(id) {
    return this.listEveryAbstraction().find(abstraction => abstraction.id === id) || null;
  }

  countByScale() {
    const counts = Object.fromEntries(SCALES_OF_THE_REVIEW_TREE.map(scale => [scale, 0]));
    for (const abstraction of this.listEveryAbstraction()) counts[abstraction.scale]++;
    return counts;
  }

  convertToJson() {
    return this.roots.map(root => root.convertToJson());
  }

  collectExtractedAbstractions(graphAbstractionsOf) {
    const extractedAbstractions = [];
    const visit = (abstraction, parent) => { extractedAbstractions.push(abstraction.createExtractedAbstraction(parent, graphAbstractionsOf(abstraction))); for (const child of abstraction.children) visit(child, abstraction); };
    for (const root of this.roots) visit(root, null);
    return extractedAbstractions;
  }
}
