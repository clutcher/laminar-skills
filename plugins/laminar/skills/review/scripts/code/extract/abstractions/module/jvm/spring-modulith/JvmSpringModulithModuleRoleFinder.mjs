import { isOfTheFamilyOf } from "../../../../../inputs/source/Languages.mjs";
import { listAncestors } from "../../generic/reading/FolderPaths.mjs";
import { GenericModuleRoleFinder } from "../../generic/GenericModuleRoleFinder.mjs";

const TEST_FOLDER_NAMES = new Set(["test", "tests", "spec", "specs", "__tests__", "it"]);

const splitSegmentsOfPath = filePath => filePath.split("/");

const compareInTheOrderOfAWalk = (left, right) => {
  const leftSegments = splitSegmentsOfPath(left.path);
  const rightSegments = splitSegmentsOfPath(right.path);
  for (let at = 0; at < Math.min(leftSegments.length, rightSegments.length); at++) {
    if (leftSegments[at] === rightSegments[at]) continue;
    const leftIsAFile = at === leftSegments.length - 1;
    const rightIsAFile = at === rightSegments.length - 1;
    if (leftIsAFile !== rightIsAFile) return leftIsAFile ? -1 : 1;
    return leftSegments[at].localeCompare(rightSegments[at]);
  }
  return left.line - right.line;
};

function* findTestFoldersAbove(reading, root) {
  for (const ancestor of listAncestors(root)) {
    for (const below of reading.folderFiles.listFolders(ancestor)) if (TEST_FOLDER_NAMES.has(below.name)) yield below;
  }
}

const findFirstCallInATestFolderAbove = (reading, root, calls) => {
  for (const testFolder of findTestFoldersAbove(reading, root)) {
    const found = calls.find(call => call.path.startsWith(`${testFolder.path}/`));
    if (found) return found;
  }
  return null;
};

const verifyCallsOf = (reading, verifyCallName, driver) => reading.findLinesReferencing(verifyCallName.name, verifyCallName.receiver)
  .filter(referenceLine => isOfTheFamilyOf(referenceLine.path, driver.diffDriver))
  .sort(compareInTheOrderOfAWalk);

const verifyCallByRootByReadingMap = new WeakMap();

const verifyCallsByRootOf = reading => {
  if (!verifyCallByRootByReadingMap.has(reading)) verifyCallByRootByReadingMap.set(reading, new Map());
  return verifyCallByRootByReadingMap.get(reading);
};

function searchForTheVerifyCall(reading, verifyCallName, root, driver) {
  const found = findFirstCallInATestFolderAbove(reading, root, verifyCallsOf(reading, verifyCallName, driver));
  return found ? { kind: "verified", path: found.path, line: found.line, text: found.text.trim() } : null;
}

export class JvmSpringModulithModuleRoleFinder extends GenericModuleRoleFinder {
  family = "jvm";
  framework = "spring-modulith";
  dependencyLinePatterns = [/\borg\.springframework\.modulith\b/];
  frameworkMarkPatterns = [/^\s*import\s+(?:static\s+)?org\.springframework\.modulith\./, /@(?:ApplicationModule|NamedInterface|Modulithic)\b/, /\bApplicationModules\s*\.\s*of\s*\(/];
  verifyCallName = Object.freeze({ name: "of", receiver: "ApplicationModules" });

  findVerifiedBoundary(reading, root, driver) {
    const verifyCallByRootMap = verifyCallsByRootOf(reading);
    if (verifyCallByRootMap.has(root)) return verifyCallByRootMap.get(root);
    const found = searchForTheVerifyCall(reading, this.verifyCallName, root, driver);
    verifyCallByRootMap.set(root, found);
    return found;
  }
}
