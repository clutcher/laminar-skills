import { readTrackedIndexLines } from "../TrackedFiles.mjs";
import { findDiffDriver, holdsKeyTreesAt, readLanguageFamily } from "../../source/drivers/LanguageRegistry.mjs";

const EXCLUDED_PATH_PATTERN = /(^|\/)\.|\.md$/;
const INDEX_LINE_PATTERN = /^\d+ [0-9a-f]+ (\d)\t(.*)$/;

function readIndexedPaths(repository) {
  return (readTrackedIndexLines(repository) || []).map(line => INDEX_LINE_PATTERN.exec(line)).filter(Boolean)
    .filter(([, stage, given]) => stage === "0" && findDiffDriver(given) && !holdsKeyTreesAt(given) && !EXCLUDED_PATH_PATTERN.test(given))
    .map(([, , given]) => given);
}

const groupPathsByFamily = paths => {
  const pathsByFamilyMap = new Map();
  for (const given of paths) {
    const family = readLanguageFamily(given);
    if (!pathsByFamilyMap.has(family)) pathsByFamilyMap.set(family, []);
    pathsByFamilyMap.get(family).push(given);
  }
  return pathsByFamilyMap;
};

export class SourceIndex {
  constructor(repository, familyFilesOf) {
    this.repository = repository;
    const listed = readIndexedPaths(repository);
    this.familyFilesByFamilyMap = new Map();
    for (const [family, paths] of groupPathsByFamily(listed)) this.familyFilesByFamilyMap.set(family, familyFilesOf(family, paths));
    this.fileByPathMap = new Map();
    for (const index of this.familyFilesByFamilyMap.values()) index.files.forEach(file => this.fileByPathMap.set(file.path, { index, file }));
    this.listed = listed.filter(given => this.fileByPathMap.has(given));
  }

  findFamilyFiles(family) {
    return this.familyFilesByFamilyMap.get(family) || null;
  }

  readListedFiles() {
    return this.listed;
  }

  countMinified() {
    let count = 0;
    for (const index of this.familyFilesByFamilyMap.values()) count += index.minified;
    return count;
  }

  readFileLines(given) {
    const indexedFile = this.fileByPathMap.get(given);
    return indexedFile ? indexedFile.index.readFileLines(indexedFile.file) : null;
  }
}
