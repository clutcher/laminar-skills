import { filterLinesMatching } from "../generic/dependencies/DependencyLines.mjs";
import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

export class BundlerApplicationFinder extends GenericApplicationFinder {
  buildSystem = "bundler";
  buildFileNames = ["Gemfile"];
  buildFileSuffixes = [];
  dependencyFormats = [{ name: /^(?:Gemfile|.+\.gemspec)$/, readLines: filterLinesMatching(/^(?:gem\s|\w+\.add_(?:runtime_|development_)?dependency\b)/) }];
}
