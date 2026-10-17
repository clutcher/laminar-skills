import { hasATestFileName, isTestPath } from "../../inputs/source/TestCode.mjs";
import { TEST_PLACEMENTS } from "../../inputs/source/TestPlacement.mjs";
import { isAFileNamedByTheLanguage } from "../../graph/abstractions/Abstraction.mjs";
import { FILE_STATUS } from "../../inputs/change/Hunk.mjs";

const NO_TEST_LAYOUT = Object.freeze({});

const FIRST_LINE = 1;

const NAMING_FILE_STATUSES = new Set([FILE_STATUS.CREATED, FILE_STATUS.RENAMED]);

const isTestSupport = filePath => !hasATestFileName(filePath) && !isAFileNamedByTheLanguage(filePath);

const isPlaced = testPlacement => testPlacement.placement !== TEST_PLACEMENTS.NONE;

export class TestLayout {
  constructor({ testPlacements, listFilePathsIn, readFileLines }) {
    this.testPlacements = testPlacements;
    this.listFilePathsIn = listFilePathsIn;
    this.readFileLines = readFileLines;
  }

  readTheFacts(folder, changedFiles) {
    const changedPaths = changedFiles.map(changedFile => changedFile.path);
    const filePaths = this.listFilePathsIn(folder);
    const testPlacements = filePaths.filter(hasATestFileName).map(testPath => ({ path: testPath, ...this.testPlacements.readPlacement(testPath) }));
    if (testPlacements.length === 0) return NO_TEST_LAYOUT;
    const followsAKnownTestLayout = changedPaths.length > 0
      && changedPaths.every(hasATestFileName)
      && !(isTestPath(folder) && filePaths.some(isTestSupport))
      && testPlacements.every(isPlaced);
    const settledTestFileNames = this.listTheTestFileNamesTheScriptSettles(testPlacements, changedFiles);
    return {
      testPlacements,
      ...(followsAKnownTestLayout ? { followsAKnownTestLayout: true } : {}),
      ...(settledTestFileNames.length ? { settledTestFileNames } : {}),
    };
  }

  listTheTestFileNamesTheScriptSettles(testPlacements, changedFiles) {
    const namedByTheChange = new Set(changedFiles.filter(changedFile => NAMING_FILE_STATUSES.has(changedFile.status)).map(changedFile => changedFile.path));
    return testPlacements
      .filter(testPlacement => namedByTheChange.has(testPlacement.path) && !isPlaced(testPlacement) && this.judgesTheNameOf(testPlacement.path))
      .map(testPlacement => ({ test: this.placeTheTestFile(testPlacement.path), named: this.testPlacements.findTheNameAfterTheStart(testPlacement.path) }));
  }

  judgesTheNameOf(testPath) {
    return this.testPlacements.canTestAFileOfItsFolders(testPath) && !this.testPlacements.startsWithAFileUnderItsFolders(testPath);
  }

  placeTheTestFile(testPath) {
    return { path: testPath, line: FIRST_LINE, text: (this.readFileLines(testPath)[FIRST_LINE - 1] || "").trim() };
  }
}
