import { readLanguageFamily } from "./Languages.mjs";
import { hasATestFileName, isATestFolderName, isTestPath, readTestNameAffixes } from "./TestCode.mjs";
import { splitNameWords } from "./names/NameWords.mjs";
import { FILE_NAMES_SET_BY_THE_LANGUAGE } from "./names/NamingConventions.mjs";
import { readFileStem, readFolderPath } from "../../../files/paths.mjs";

export const TEST_PLACEMENTS = Object.freeze({ MIRROR: "mirror", BESIDE: "beside", NONE: "none" });

const SOURCE_ROOT_FOLDER_NAMES = new Set(["src", "main", "java", "kotlin", "scala", "groovy", "lib", "app", "source", "sources"]);

const PACKAGE_OPENING_STEM = "__init__";

const MAX_PACKAGE_FOLDERS_BETWEEN_THE_MIRRORS = 1;

const TEST_KIND_WORDS = new Set(["unit", "integration", "api", "e2e", "functional", "acceptance", "component", "contract"]);

const NOT_PLACED = Object.freeze({ placement: TEST_PLACEMENTS.NONE, testedFile: null });

const NO_TYPE_NAMES = Object.freeze([]);

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

const opensWithAKindWord = words => words.length > 1 && TEST_KIND_WORDS.has(words[0]);

const readTheTestedWordLists = testPath => {
  const words = splitNameWords(readTestedName(testPath));
  return opensWithAKindWord(words) ? [words, words.slice(1)] : [words];
};

const holdsTheWordsAt = (testedWords, nameWords, at) => nameWords.length > 0
  && at + nameWords.length <= testedWords.length
  && nameWords.every((word, index) => testedWords[at + index] === word);

const startsWithTheName = (testedWordLists, testedName) => testedWordLists.some(testedWords => holdsTheWordsAt(testedWords, testedName.words, 0));

const holdsTheNameAfterTheStart = (testedWordLists, testedName) => testedWordLists.some(testedWords => testedWords.some((_, at) => at > 0 && holdsTheWordsAt(testedWords, testedName.words, at)));

const isLonger = (testedName, other) => testedName.words.length > other.words.length
  || (testedName.words.length === other.words.length && testedName.name.length > other.name.length);

const findTheLongestName = testedNames => (testedNames.length === 0 ? null
  : testedNames.reduce((longest, testedName) => (isLonger(testedName, longest) ? testedName : longest)));

const liesUnder = (folder, root) => !root || folder === root || folder.startsWith(`${root}/`);

const splitIntoFolders = folder => (folder ? folder.split("/") : []);

const readTheMirroredFolders = testFolder => {
  const folders = splitIntoFolders(testFolder);
  const testFolderIndex = folders.findIndex(isATestFolderName);
  if (testFolderIndex === -1) return null;
  return { above: folders.slice(0, testFolderIndex), below: folders.slice(testFolderIndex + 1) };
};

const startsWithTheFolders = (folders, opening) => opening.every((folder, index) => folders[index] === folder);

const endsWithTheFolders = (folders, ending) => ending.every((folder, index) => folders[folders.length - ending.length + index] === folder);

const readTheFoldersBetween = (productionFolders, { above, below }) => {
  if (!startsWithTheFolders(productionFolders, above)) return null;
  const rest = productionFolders.slice(above.length);
  if (rest.length < below.length || !endsWithTheFolders(rest, below)) return null;
  return rest.slice(0, rest.length - below.length).map((name, index) => ({ name, path: [...above, ...rest.slice(0, index + 1)].join("/") }));
};

const listTheNamesAFileGivesItsTests = (sourcePath, typeNames) => {
  const stem = readFileStem(sourcePath);
  const stemName = FILE_NAMES_SET_BY_THE_LANGUAGE.has(stem) ? [] : [stem];
  return [...new Set([...stemName, ...typeNames])].map(name => ({ name, words: splitNameWords(name) }));
};

export class TestPlacements {
  constructor(sourcePaths, typeNamesByPathMap = new Map()) {
    this.productionFilesByFolderMap = new Map();
    for (const sourcePath of sourcePaths) {
      if (isTestPath(sourcePath)) continue;
      const folder = readFolderPath(sourcePath);
      if (!this.productionFilesByFolderMap.has(folder)) this.productionFilesByFolderMap.set(folder, []);
      this.productionFilesByFolderMap.get(folder).push({
        path: sourcePath,
        stem: readFileStem(sourcePath),
        family: readLanguageFamily(sourcePath),
        testedNames: listTheNamesAFileGivesItsTests(sourcePath, typeNamesByPathMap.get(sourcePath) || NO_TYPE_NAMES),
      });
    }
    this.mirrorFoldersByTestFolderMap = new Map();
  }

  readPlacement(testPath) {
    if (!hasATestFileName(testPath)) return NOT_PLACED;
    const testedWordLists = readTheTestedWordLists(testPath);
    const family = readLanguageFamily(testPath);
    const testFolder = readFolderPath(testPath);
    const besideFile = this.findTheTestedFile([testFolder], testedWordLists, family);
    if (besideFile) return { placement: TEST_PLACEMENTS.BESIDE, testedFile: besideFile };
    const mirrorFile = this.findTheTestedFile(this.listTheMirrorFolders(testFolder), testedWordLists, family);
    return mirrorFile ? { placement: TEST_PLACEMENTS.MIRROR, testedFile: mirrorFile } : NOT_PLACED;
  }

  findTheTestedFile(folders, testedWordLists, family) {
    const matchingNames = this.listTheTestedNamesIn(this.listTheProductionFilesIn(folders, family)).filter(testedName => startsWithTheName(testedWordLists, testedName));
    return (findTheLongestName(matchingNames) || {}).path || null;
  }

  canTestAFileOfItsFolders(testPath) {
    return this.listTheFilesItCouldTest(testPath).length > 0;
  }

  startsWithAFileUnderItsFolders(testPath) {
    const testedWordLists = readTheTestedWordLists(testPath);
    return this.listTheTestedNamesIn(this.listTheFilesUnderItsFolders(testPath)).some(testedName => startsWithTheName(testedWordLists, testedName));
  }

  findTheNameAfterTheStart(testPath) {
    const testedWordLists = readTheTestedWordLists(testPath);
    const namesAfterTheStart = this.listTheTestedNamesIn(this.listTheFilesUnderItsFolders(testPath)).filter(testedName => holdsTheNameAfterTheStart(testedWordLists, testedName));
    const longest = findTheLongestName(namesAfterTheStart);
    return longest ? { name: longest.name, path: longest.path } : null;
  }

  listTheTestedNamesIn(productionFiles) {
    return productionFiles.flatMap(productionFile => productionFile.testedNames.map(testedName => ({ ...testedName, path: productionFile.path })));
  }

  listTheFilesUnderItsFolders(testPath) {
    const testFolder = readFolderPath(testPath);
    const roots = [testFolder, ...this.listTheMirrorFolders(testFolder)];
    const foldersUnderTheRoots = [...this.productionFilesByFolderMap.keys()].filter(folder => roots.some(root => liesUnder(folder, root)));
    return this.listTheProductionFilesIn(foldersUnderTheRoots, readLanguageFamily(testPath));
  }

  listTheFilesItCouldTest(testPath) {
    const testFolder = readFolderPath(testPath);
    return this.listTheProductionFilesIn([testFolder, ...this.listTheMirrorFolders(testFolder)], readLanguageFamily(testPath));
  }

  listTheProductionFilesIn(folders, family) {
    return folders
      .flatMap(folder => this.productionFilesByFolderMap.get(folder) || [])
      .filter(productionFile => productionFile.family === family);
  }

  listTheMirrorFolders(testFolder) {
    if (!this.mirrorFoldersByTestFolderMap.has(testFolder)) this.mirrorFoldersByTestFolderMap.set(testFolder, this.findTheMirrorFolders(testFolder));
    return this.mirrorFoldersByTestFolderMap.get(testFolder);
  }

  findTheMirrorFolders(testFolder) {
    const mirroredFolders = readTheMirroredFolders(testFolder);
    if (mirroredFolders === null) return [];
    return [...this.productionFilesByFolderMap.keys()].filter(folder => this.mirrors(splitIntoFolders(folder), mirroredFolders));
  }

  mirrors(productionFolders, mirroredFolders) {
    const foldersBetween = readTheFoldersBetween(productionFolders, mirroredFolders);
    if (foldersBetween === null) return false;
    const otherFolders = foldersBetween.filter(folderBetween => !SOURCE_ROOT_FOLDER_NAMES.has(folderBetween.name));
    return otherFolders.length <= MAX_PACKAGE_FOLDERS_BETWEEN_THE_MIRRORS
      && otherFolders.every(otherFolder => this.isATopPackageFolder(otherFolder.path, productionFolders));
  }

  isATopPackageFolder(folder, productionFolders) {
    const folderBelowOnThePath = productionFolders.slice(0, splitIntoFolders(folder).length + 1).join("/");
    const opensAPackage = this.holdsAPackageOpening(folder) || this.holdsAPackageOpening(folderBelowOnThePath);
    return opensAPackage && !this.holdsAPackageOpening(readFolderPath(folder));
  }

  holdsAPackageOpening(folder) {
    return (this.productionFilesByFolderMap.get(folder) || []).some(productionFile => productionFile.stem === PACKAGE_OPENING_STEM);
  }
}
