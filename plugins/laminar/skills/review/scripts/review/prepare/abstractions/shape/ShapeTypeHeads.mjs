import { formatPlacedSliceLine } from "../../../../code/index.mjs";
import { MAX_LINES_OF_A_TYPE_HEAD } from "./TypeHeads.mjs";

const PRIVATE_METHOD_VISIBILITY = "private";

export class ShapeTypeHeads {
  constructor({ classPlacements, readRenderedLinesOf }) {
    this.placementByNameMap = new Map(classPlacements.map(placement => [placement.shapeClass.name, placement]));
    this.readRenderedLinesOf = readRenderedLinesOf;
  }

  listHeads(typeNames) {
    return typeNames
      .filter(name => this.placementByNameMap.has(name))
      .map(name => this.listDeclaringLines(this.placementByNameMap.get(name)));
  }

  listDeclaringLines({ path: filePath, shapeClass, lines, methods }) {
    const renderedLines = this.readRenderedLinesOf(filePath);
    const fieldLines = shapeClass.fields.map((field, index) => lines.from + 1 + index);
    const methodHeadLines = methods.filter(({ method }) => method.visibility !== PRIVATE_METHOD_VISIBILITY).map(placed => placed.lines.from);
    return [lines.from, ...fieldLines, ...methodHeadLines]
      .slice(0, MAX_LINES_OF_A_TYPE_HEAD)
      .map(line => formatPlacedSliceLine(filePath, line, String(renderedLines[line - 1] ?? "").trim()));
  }
}
