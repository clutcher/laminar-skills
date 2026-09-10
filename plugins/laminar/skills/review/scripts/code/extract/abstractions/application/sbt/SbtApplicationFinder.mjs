import { filterLinesMatching } from "../generic/dependencies/DependencyLines.mjs";
import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

export class SbtApplicationFinder extends GenericApplicationFinder {
  buildSystem = "sbt";
  buildFileNames = [];
  buildFileSuffixes = [];
  buildScriptPatterns = [/\.sbt$/];
  dependencyFormats = [{ name: /^build\.sbt$/, readLines: filterLinesMatching(/"\s+%%?\s+"/) }];
}
