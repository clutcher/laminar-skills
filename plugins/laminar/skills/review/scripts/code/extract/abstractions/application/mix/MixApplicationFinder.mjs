import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

export class MixApplicationFinder extends GenericApplicationFinder {
  buildSystem = "mix";
  buildFileNames = ["mix.exs"];
  buildFileSuffixes = [];
  dependencyFormats = [];
}
