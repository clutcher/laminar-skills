import { parseJsonKeys } from "../generic/dependencies/DependencyLines.mjs";
import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

export class ComposerApplicationFinder extends GenericApplicationFinder {
  buildSystem = "composer";
  buildFileNames = ["composer.json"];
  buildFileSuffixes = [];
  dependencyFormats = [{ name: /^composer\.json$/, readLines: parseJsonKeys }];
}
