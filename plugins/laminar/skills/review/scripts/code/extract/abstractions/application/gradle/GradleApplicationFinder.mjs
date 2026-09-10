import { findLinesInsideBlocks } from "../generic/dependencies/DependencyLines.mjs";
import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

export class GradleApplicationFinder extends GenericApplicationFinder {
  buildSystem = "gradle";
  buildFileNames = ["build.gradle", "build.gradle.kts"];
  buildFileSuffixes = [];
  buildScriptPatterns = [/\.gradle(?:\.kts)?$/];
  dependencyFormats = [{ name: /^build\.gradle(?:\.kts)?$/, readLines: lines => findLinesInsideBlocks(lines, /^dependencies\s*\{/) }];
}
