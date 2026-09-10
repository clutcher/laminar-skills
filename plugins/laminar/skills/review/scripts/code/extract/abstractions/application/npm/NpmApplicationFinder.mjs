import { parseJsonKeys } from "../generic/dependencies/DependencyLines.mjs";
import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

export class NpmApplicationFinder extends GenericApplicationFinder {
  buildSystem = "npm";
  buildFileNames = ["package.json"];
  buildFileSuffixes = [];
  dependencyFormats = [{ name: /^package\.json$/, readLines: parseJsonKeys }];
}
