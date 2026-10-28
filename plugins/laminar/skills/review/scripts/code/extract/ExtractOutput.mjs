import fs from "node:fs";
import path from "node:path";
import { createPropertyWhenNotEmpty, writeJsonFile } from "../../files/jsonFile.mjs";
import { readChangedLinesOfTheChange } from "../inputs/change/ChangedLines.mjs";
import { ReviewedChange } from "../inputs/change/ReviewedChange.mjs";
import { readDependencies } from "./abstractions/application/generic/dependencies/RepositoryDependencies.mjs";
import { CodeGraphCompletion } from "./CodeGraphCompletion.mjs";

export const CODE_GRAPH_FILE = "code-graph.json";

export class ExtractOutput {
  constructor(step, tree) {
    this.step = step;
    this.tree = tree;
    this.completedCodeGraph = null;
    this.reviewedChange = null;
  }

  buildCounts() {
    const { change } = this.step;
    return {
      files: change.files.length,
      hunks: change.hunkCount,
      abstractions: this.tree.listEveryAbstraction().length,
      byScale: this.tree.countByScale(),
      trivialHunks: this.step.trivialHunks,
      droppedAsTrivial: this.step.droppedAsTrivial,
      noLanguageDriver: this.step.noLanguageDriver,
      buildFiles: this.step.buildFiles,
    };
  }

  writeAndSummarize(runFolder) {
    this.writeCodeGraphFile(runFolder);
    return this.summarize();
  }

  writeCodeGraphFile(runFolder) {
    fs.mkdirSync(runFolder, { recursive: true });
    writeJsonFile(path.join(runFolder, CODE_GRAPH_FILE), this.buildCodeGraphFile());
  }

  summarize() {
    return { mode: this.step.change.mode, modeReason: this.step.change.modeReason, counts: this.buildCounts() };
  }

  buildCodeGraphFile() {
    return { ...this.getOrBuildCodeGraph().toJSON(), ...this.getOrBuildReviewedChange().toJSON(), ...this.buildModuleShapesProperty() };
  }

  buildModuleShapesProperty() {
    return createPropertyWhenNotEmpty("moduleShapes", this.step.shapes ? this.step.shapes.toJSON() : []);
  }

  getOrBuildReviewedChange() {
    if (!this.reviewedChange) {
      const { treeGraphAbstractions } = this.getOrCompleteTheCodeGraph();
      this.reviewedChange = new ReviewedChange(this.step.change.toJSON(), this.buildExtractedReview(abstraction => treeGraphAbstractions.readGraphAbstractionsOf(abstraction)));
    }
    return this.reviewedChange;
  }

  getOrBuildCodeGraph() {
    return this.getOrCompleteTheCodeGraph().codeGraph;
  }

  getOrCompleteTheCodeGraph() {
    if (!this.completedCodeGraph) this.completedCodeGraph = new CodeGraphCompletion(this.step, this.tree).complete();
    return this.completedCodeGraph;
  }

  buildExtractedReview(graphAbstractionsOf) {
    const { change, kindChange } = this.step;
    return {
      counts: this.buildCounts(),
      notParsed: this.step.notParsed,
      ...createPropertyWhenNotEmpty("leftOutFiles", this.step.leftOutFiles),
      dependencies: this.step.dependencies || readDependencies(change),
      changedLinesOfTheChange: readChangedLinesOfTheChange(change.files, { namesWholeFiles: change.namesWholeFiles }),
      ...(kindChange ? { changedLinesOfTheKindBase: readChangedLinesOfTheChange(kindChange.files, { namesWholeFiles: kindChange.namesWholeFiles }) } : {}),
      abstractions: this.tree.collectExtractedAbstractions(graphAbstractionsOf),
      decisionSearches: this.step.decisionSearches.map(({ abstraction, path: filePath, addedLines }) => ({ abstraction: abstraction.id, path: filePath, addedLines })),
      literalConstants: this.step.literalConstants.map(({ abstraction, constants }) => ({ abstraction: abstraction.id, constants })),
      publicChangeKinds: this.step.readThePublicChangeKinds().toJSON(),
    };
  }
}
