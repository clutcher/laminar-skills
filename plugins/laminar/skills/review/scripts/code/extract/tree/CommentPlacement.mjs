import { collectComments } from "../../inputs/source/lines/CommentLines.mjs";
import { doesSpanHoldLine } from "../../graph/abstractions/Place.mjs";
import { Scale } from "../../graph/abstractions/Scale.mjs";
import { CHANGE_KINDS } from "../../inputs/change/AbstractionChange.mjs";
import { VISIBILITIES, readVisibilityOfDeclaration } from "./AbstractionTree.mjs";
import { readFolderPath } from "../../../files/paths.mjs";

const COMMENT_HOLDING_SCALES = new Set([Scale.CLASS.name, Scale.METHOD.name]);

const measureSpanSize = abstraction => abstraction.lines.to - abstraction.lines.from;

const THE_INNERMOST_SCALE_FIRST = [Scale.METHOD.name, Scale.CLASS.name];

const compareBySpanSize = (left, right) => measureSpanSize(left) - measureSpanSize(right)
  || THE_INNERMOST_SCALE_FIRST.indexOf(left.scale) - THE_INNERMOST_SCALE_FIRST.indexOf(right.scale);

const isADeclaredValue = abstraction => abstraction.scale === Scale.VARIABLE.name && !String(abstraction.enclosingTypeName || "").includes("#");

const holdsCommentsWithin = abstraction => COMMENT_HOLDING_SCALES.has(abstraction.scale);

const mayHoldComments = abstraction => (holdsCommentsWithin(abstraction) || isADeclaredValue(abstraction)) && Boolean(abstraction.lines) && abstraction.changeKind !== CHANGE_KINDS.REFERENCE;

const readDeclaringLines = abstraction => (abstraction.fields ? abstraction.fields.map(field => field.lines.from) : [abstraction.lines.from]);

const ANNOTATION_LINE_PATTERN = /^(@[\w$.]+|#!?\[.*\]$|\[[A-Za-z_][\w.]*(\(.*\))?(,\s*[A-Za-z_][\w.]*(\(.*\))?)*\]$)/;

const NO_HEAD_BELOW = Object.freeze({ from: 0, to: 0 });

const findTheHeadDirectlyBelow = (numberedLines, comment) => {
  if (comment.codeBelow.line <= comment.to) return NO_HEAD_BELOW;
  let expected = comment.to + 1;
  for (const numberedLine of numberedLines.filter(given => given.line > comment.to)) {
    const code = String(numberedLine.text).trim();
    if (numberedLine.line !== expected || !code) return NO_HEAD_BELOW;
    if (!ANNOTATION_LINE_PATTERN.test(code)) return { from: comment.to + 1, to: numberedLine.line };
    expected++;
  }
  return NO_HEAD_BELOW;
};

const isDeclaredWithin = (lines, headBelow) => lines.some(line => line >= headBelow.from && line <= headBelow.to);

const findAbstractionEnclosingTheComment = (abstractions, comment, headBelow) => {
  const abstractionsBelow = abstractions.filter(abstraction => isDeclaredWithin(readDeclaringLines(abstraction), headBelow));
  const enclosingAbstractions = abstractionsBelow.length ? abstractionsBelow : abstractions.filter(abstraction => holdsCommentsWithin(abstraction) && doesSpanHoldLine(abstraction.lines, comment.from));
  return enclosingAbstractions.sort(compareBySpanSize)[0] || null;
};

const COMMENTED_TAG_SCALES = new Set([Scale.METHOD.name, Scale.CLASS.name, Scale.VARIABLE.name]);

const SCALE_BY_DECLARATION_SCALE_MAP = Object.freeze({
  [Scale.METHOD.name]: Scale.METHOD.name,
  [Scale.CLASS.name]: Scale.CLASS.name,
  [Scale.VARIABLE.name]: Scale.VARIABLE.name,
});

const touchesTheAddedLines = (comment, addedLines) => listCommentLines(comment).some(line => addedLines.has(line));

const listCommentLines = comment => Array.from({ length: comment.to - comment.from + 1 }, (_, offset) => comment.from + offset);

export class CommentPlacement {
  constructor({ tree, addedLinesByPathMap, createMemberAbstraction, readBoundaryRankAtLine }) {
    this.tree = tree;
    this.addedLinesByPathMap = addedLinesByPathMap;
    this.createMemberAbstraction = createMemberAbstraction;
    this.readBoundaryRankAtLine = readBoundaryRankAtLine;
  }

  groupCommentHoldingAbstractionsByPath() {
    const abstractionsByPathMap = new Map();
    for (const abstraction of this.tree.listEveryAbstraction().filter(mayHoldComments)) {
      if (!abstractionsByPathMap.has(abstraction.path)) abstractionsByPathMap.set(abstraction.path, []);
      abstractionsByPathMap.get(abstraction.path).push(abstraction);
    }
    return abstractionsByPathMap;
  }

  placeTheComments(readings, parents) {
    const abstractionsByPathMap = this.groupCommentHoldingAbstractionsByPath();
    for (const { file, driver, reading } of readings) {
      if (!driver || !reading || driver.holdsProse) continue;
      const abstractions = (abstractionsByPathMap.get(file.path) || []).filter(abstraction => !(driver.fileHoldsTypesOnly && isADeclaredValue(abstraction)));
      const addedLines = this.addedLinesByPathMap.get(file.path) || new Set();
      const numberedLines = file.readNumberedLines();
      for (const comment of collectComments(numberedLines, driver)) {
        const headBelow = findTheHeadDirectlyBelow(numberedLines, comment);
        const abstraction = findAbstractionEnclosingTheComment(abstractions, comment, headBelow);
        const declaresBelow = abstraction && isDeclaredWithin(readDeclaringLines(abstraction), headBelow);
        const commentedAbstraction = declaresBelow || !touchesTheAddedLines(comment, addedLines) ? abstraction : this.findOrAddTheCommentedAbstraction({ file, driver, reading }, comment, headBelow, parents, abstractions) || abstraction;
        if (commentedAbstraction) commentedAbstraction.comments.push(comment);
      }
    }
  }

  findOrAddTheCommentedAbstraction(changedFileReading, comment, headBelow, parents, abstractions) {
    const tags = changedFileReading.reading.tagsOfTheKnownText.filter(tag => COMMENTED_TAG_SCALES.has(tag.scale));
    const tagBelow = tags.find(tag => isDeclaredWithin([tag.line], headBelow));
    if (tagBelow) return this.addTheCommentedAbstraction(changedFileReading, tagBelow, parents, abstractions);
    const enclosingTag = tags
      .filter(tag => tag.scale !== Scale.VARIABLE.name && doesSpanHoldLine(changedFileReading.reading.readSpan(tag), comment.from))
      .sort((left, right) => measureSpanSize({ lines: changedFileReading.reading.readSpan(left) }) - measureSpanSize({ lines: changedFileReading.reading.readSpan(right) }))[0];
    if (enclosingTag) return this.addTheCommentedAbstraction(changedFileReading, enclosingTag, parents, abstractions);
    return this.findOrAddTheCommentedFile(changedFileReading, parents, abstractions);
  }

  addTheCommentedAbstraction(changedFileReading, tag, parents, abstractions) {
    const { file, driver, reading } = changedFileReading;
    const span = reading.readSpan(tag);
    const scale = SCALE_BY_DECLARATION_SCALE_MAP[tag.scale];
    const existing = abstractions.find(abstraction => abstraction.scale === scale && abstraction.name === tag.name && abstraction.lines && abstraction.lines.from === span.from);
    if (existing) return existing;
    const fileAbstraction = this.findOrAddTheCommentedFile(changedFileReading, parents, abstractions);
    if (!fileAbstraction) return null;
    const visibility = readVisibilityOfDeclaration(driver, tag);
    const enclosingTypeName = scale === Scale.CLASS.name ? tag.scope : reading.chooseEnclosingTypeName(tag.scope, tag.line);
    const abstraction = fileAbstraction.add(this.createMemberAbstraction({
      scale,
      name: tag.name,
      enclosingTypeName,
      path: file.path,
      changeKind: CHANGE_KINDS.REFERENCE,
      visibility,
      boundaryRank: this.readBoundaryRankAtLine(file.path, visibility, tag.line),
      lines: span,
      headLine: tag.line,
    }));
    abstraction.commentsOnly = true;
    abstractions.push(abstraction);
    return abstraction;
  }

  findOrAddTheCommentedFile({ file, reading }, parents, abstractions) {
    const fileAbstraction = abstractions.find(abstraction => abstraction.scale === Scale.CLASS.name && abstraction.name === reading.typeName && !abstraction.enclosingTypeName);
    if (fileAbstraction) return fileAbstraction;
    const parent = parents.get(readFolderPath(file.path));
    if (!parent) return null;
    const { tag, span } = reading.readTheFilesOwnTypeAndSpan();
    const abstraction = parent.add(this.createMemberAbstraction({
      scale: Scale.CLASS.name,
      name: reading.typeName,
      path: file.path,
      changeKind: CHANGE_KINDS.REFERENCE,
      visibility: VISIBILITIES.EXPOSED,
      boundaryRank: this.readBoundaryRankAtLine(file.path, VISIBILITIES.EXPOSED, tag ? tag.line : null),
      lines: span,
    }));
    abstraction.commentsOnly = true;
    abstractions.push(abstraction);
    return abstraction;
  }
}
