import { findLinesInsideBlocks } from "../generic/dependencies/DependencyLines.mjs";
import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

export class GradleApplicationFinder extends GenericApplicationFinder {
  buildSystem = "gradle";
  buildFileNames = ["build.gradle", "build.gradle.kts"];
  buildFileSuffixes = [];
  buildScriptPatterns = [/\.gradle(?:\.kts)?$/];
  dependencyFormats = [{ name: /^build\.gradle(?:\.kts)?$/, readLines: lines => findLinesInsideBlocks(lines, /^dependencies\s*\{/) }];
  declaresTheTestRunner = true;
  testSetupPatterns = [/\btest(?:Implementation|RuntimeOnly|CompileOnly|Compile|Api)\b/, /\buseJUnit(?:Platform)?\b/, /\buseTestNG\b/, /\bkotlin\s*\(\s*["']test/];
}
