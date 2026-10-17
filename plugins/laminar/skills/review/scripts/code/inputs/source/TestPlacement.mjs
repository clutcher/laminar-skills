import { readLanguageFamily } from "./Languages.mjs";
import { hasATestFileName, isATestFolderName, isTestPath, readTestNameAffixes } from "./TestCode.mjs";
import { readFileStem, readFolderPath } from "../../../files/paths.mjs";

export const TEST_PLACEMENTS = Object.freeze({ MIRROR: "mirror", BESIDE: "beside", NONE: "none" });

const MAX_FOLDERS_BETWEEN_THE_MIRRORS = 3;

const WORD_START_PATTERN = /[A-Z_.-]/;

const NOT_PLACED = Object.freeze({ placement: TEST_PLACEMENTS.NONE, testedFile: null });

const removeTheFirstAffix = (stem, affixes, removeAffix) => {
  const affix = affixes.find(given => stem.length > given.length && removeAffix(stem, given) !== null);
  return affix === undefined ? null : removeAffix(stem, affix);
};

const removeTheOpening = (stem, opening) => (stem.startsWith(opening) ? stem.slice(opening.length) : null);

const removeTheEnding = (stem, ending) => (stem.endsWith(ending) ? stem.slice(0, -ending.length) : null);

export const readTestedName = testPath => {
  const stem = readFileStem(testPath);
  const affixes = readTestNameAffixes(testPath);
  return removeTheFirstAffix(stem, affixes.openings, removeTheOpening) ?? removeTheFirstAffix(stem, affixes.endings, removeTheEnding) ?? stem;
};

const startsWithTheStem = (testedName, stem) => testedName === stem
  || (testedName.startsWith(stem) && WORD_START_PATTERN.test(testedName[stem.length]));

const splitIntoFolders = folder => (folder ? folder.split("/") : []);

const readTheMirroredFolders = testFolder => {
  const folders = splitIntoFolders(testFolder);
  const testFolderIndex = folders.findIndex(isATestFolderName);
  if (testFolderIndex === -1) return null;
  return { above: folders.slice(0, testFolderIndex), below: folders.slice(testFolderIndex + 1) };
};

const startsWithTheFolders = (folders, opening) => opening.every((folder, index) => folders[index] === folder);

const endsWithTheFolders = (folders, ending) => ending.every((folder, index) => folders[folders.length - ending.length + index] === folder);

const mirrors = (productionFolders, { above, below }) => {
  if (!startsWithTheFolders(productionFolders, above)) return false;
  const rest = productionFolders.slice(above.length);
  return rest.length >= below.length
    && rest.length - below.length <= MAX_FOLDERS_BETWEEN_THE_MIRRORS
    && endsWithTheFolders(rest, below);
};

export class TestPlacements {
  constructor(sourcePaths) {
    this.productionFilesByFolderMap = new Map();
    for (const sourcePath of sourcePaths) {
      if (isTestPath(sourcePath)) continue;
      const folder = readFolderPath(sourcePath);
      if (!this.productionFilesByFolderMap.has(folder)) this.productionFilesByFolderMap.set(folder, []);
      this.productionFilesByFolderMap.get(folder).push({ path: sourcePath, stem: readFileStem(sourcePath), family: readLanguageFamily(sourcePath) });
    }
    this.mirrorFoldersByTestFolderMap = new Map();
  }

  readPlacement(testPath) {
    if (!hasATestFileName(testPath)) return NOT_PLACED;
    const testedName = readTestedName(testPath);
    const family = readLanguageFamily(testPath);
    const testFolder = readFolderPath(testPath);
    const besideFile = this.findTheTestedFile([testFolder], testedName, family);
    if (besideFile) return { placement: TEST_PLACEMENTS.BESIDE, testedFile: besideFile };
    const mirrorFile = this.findTheTestedFile(this.listTheMirrorFolders(testFolder), testedName, family);
    return mirrorFile ? { placement: TEST_PLACEMENTS.MIRROR, testedFile: mirrorFile } : NOT_PLACED;
  }

  findTheTestedFile(folders, testedName, family) {
    const matchingFiles = folders
      .flatMap(folder => this.productionFilesByFolderMap.get(folder) || [])
      .filter(productionFile => productionFile.family === family && startsWithTheStem(testedName, productionFile.stem));
    if (matchingFiles.length === 0) return null;
    return matchingFiles.reduce((longest, matchingFile) => (matchingFile.stem.length > longest.stem.length ? matchingFile : longest)).path;
  }

  listTheMirrorFolders(testFolder) {
    if (!this.mirrorFoldersByTestFolderMap.has(testFolder)) this.mirrorFoldersByTestFolderMap.set(testFolder, this.findTheMirrorFolders(testFolder));
    return this.mirrorFoldersByTestFolderMap.get(testFolder);
  }

  findTheMirrorFolders(testFolder) {
    const mirroredFolders = readTheMirroredFolders(testFolder);
    if (mirroredFolders === null) return [];
    return [...this.productionFilesByFolderMap.keys()].filter(folder => mirrors(splitIntoFolders(folder), mirroredFolders));
  }
}
