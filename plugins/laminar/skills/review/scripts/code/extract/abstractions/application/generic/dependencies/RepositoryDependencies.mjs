import path from "node:path";
import { readCommonGitFolderOf } from "../../../../../inputs/repository/GitCommands.mjs";
import { findRepositoryToRead } from "../../../../../inputs/change/ChangeReader.mjs";
import { readDependencyFiles } from "./DependencyFiles.mjs";

const readRepositoryIdentity = repository => readCommonGitFolderOf(repository) ?? path.resolve(repository);

export const NO_DEPENDENCIES = Object.freeze({ identity: "", files: [] });

export function readDependencies(change) {
  const repository = findRepositoryToRead(change);
  if (!repository) return NO_DEPENDENCIES;
  const files = readDependencyFiles(repository);
  return { identity: readRepositoryIdentity(repository), files };
}
