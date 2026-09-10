import { findTomlDependencyLines } from "../generic/dependencies/DependencyLines.mjs";
import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

export class CargoApplicationFinder extends GenericApplicationFinder {
  buildSystem = "cargo";
  buildFileNames = ["Cargo.toml"];
  buildFileSuffixes = [];
  dependencyFormats = [{ name: /^Cargo\.toml$/, readLines: findTomlDependencyLines }];
}
