import fs from "node:fs";
import path from "node:path";
import { convertToRepositoryPath } from "../../../../files/paths.mjs";
import { APPLICATION_FINDER_REGISTRY } from "./index.mjs";
import { isAFolderNeverWalked } from "../../../inputs/repository/RepositoryFileKinds.mjs";

const rootsByRepositoryMap = new Map();

const NO_CHILDREN = Object.freeze([]);

const readChildrenOrNone = directory => {
  try { return fs.readdirSync(directory, { withFileTypes: true }); } catch { return NO_CHILDREN; }
};

const isAFolderToWalk = child => !isAFolderNeverWalked(child.name);

function walkRepositoryFiles(repository) {
  const files = [];
  const walk = directory => {
    for (const child of readChildrenOrNone(directory)) {
      const childPath = path.join(directory, child.name);
      if (!child.isDirectory()) files.push(convertToRepositoryPath(path.relative(repository, childPath)));
      else if (isAFolderToWalk(child)) walk(childPath);
    }
  };
  walk(repository);
  return files;
}

const discoverRoots = repository => {
  const files = walkRepositoryFiles(repository);
  return [...new Set(APPLICATION_FINDER_REGISTRY.finders.flatMap(finder => finder.findIn(null, files)))].sort();
};

const readRememberedRoots = repository => {
  if (!rootsByRepositoryMap.has(repository)) rootsByRepositoryMap.set(repository, discoverRoots(repository));
  return rootsByRepositoryMap.get(repository);
};

export function findDeployableRoots(repository) {
  if (!repository) return [];
  return readRememberedRoots(repository);
}
