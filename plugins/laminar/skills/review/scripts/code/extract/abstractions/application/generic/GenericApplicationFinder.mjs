import { AbstractionFinder } from "../../../finders/AbstractionFinder.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { readFileName } from "../../../../../files/paths.mjs";
import { readsTheDependenciesOf } from "./dependencies/DependencyFormats.mjs";

export class GenericApplicationFinder extends AbstractionFinder {
  constructor() {
    super(Scale.APPLICATION);
    this.buildSystem = "";
    this.buildFileNames = [];
    this.buildFileSuffixes = [];
    this.buildScriptPatterns = [];
    this.dependencyFormats = [];
  }

  appliesTo(context) {
    return this.declaresAnApplicationIn(readFileName(context.file || ""));
  }

  declaresAnApplicationIn(fileName) {
    if (!fileName) return false;
    return this.buildFileNames.includes(fileName) || this.buildFileSuffixes.some(suffix => fileName.endsWith(suffix));
  }

  recognizesTheBuildFile(fileName) {
    return this.declaresAnApplicationIn(fileName)
      || this.buildScriptPatterns.some(pattern => pattern.test(fileName))
      || readsTheDependenciesOf(this, fileName);
  }

  findIn(system, repositoryFiles) {
    return repositoryFiles.filter(filePath => this.declaresAnApplicationIn(readFileName(filePath)));
  }
}
