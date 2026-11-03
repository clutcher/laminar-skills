import { cutTheSlice, SliceBuilder } from "../slices/CodeSlice.mjs";
import { SourceRoots } from "../slices/SourceRoots.mjs";
import { ShapeFolderChildren } from "./ShapeFolderChildren.mjs";
import { numberLines } from "../../formats/SliceFormat.mjs";
import { readFileName, readFolderPath } from "../../../../files/paths.mjs";

const NO_REFERENCES = undefined;

const NO_DECLARATIONS = undefined;

const NO_DECISION_SEARCHES = undefined;

export class ShapeSlices {
  constructor(change, pathsAfterTheShape, applicationRoots, readFileLines) {
    const sourceRoots = new SourceRoots({
      applicationRoots,
      sourcePaths: pathsAfterTheShape,
      readFileLines,
      listFileNamesIn: folder => pathsAfterTheShape.filter(filePath => readFolderPath(filePath) === folder).map(readFileName),
    });
    this.moduleSlices = new SliceBuilder(change, readFileLines, applicationRoots, NO_REFERENCES, NO_DECLARATIONS, NO_DECISION_SEARCHES, sourceRoots);
    this.moduleSlices.folderChildren = new ShapeFolderChildren(change, pathsAfterTheShape);
  }

  buildModuleSlice(moduleAbstraction) {
    return this.moduleSlices.buildSlice(moduleAbstraction);
  }

  buildOwnLinesSlice(abstraction, renderedLines, typeHeadSections) {
    const { from, to } = abstraction.lines;
    const slice = cutTheSlice(abstraction, { ownLines: numberLines(renderedLines.slice(from - 1, to), from) });
    if (!typeHeadSections.length) return slice;
    const typeHeadBytes = typeHeadSections.reduce((sum, section) => sum + section.lines.join("\n").length, 0);
    return { ...slice, sections: [...slice.sections, ...typeHeadSections], bytes: slice.bytes + typeHeadBytes };
  }
}
