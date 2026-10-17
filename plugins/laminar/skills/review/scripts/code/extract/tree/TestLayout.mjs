import { hasATestFileName, isTestPath } from "../../inputs/source/TestCode.mjs";
import { TEST_PLACEMENTS } from "../../inputs/source/TestPlacement.mjs";
import { isAFileNamedByTheLanguage } from "../../graph/abstractions/Abstraction.mjs";

const NO_TEST_LAYOUT = Object.freeze({});

const isTestSupport = filePath => !hasATestFileName(filePath) && !isAFileNamedByTheLanguage(filePath);

const isPlaced = testPlacement => testPlacement.placement !== TEST_PLACEMENTS.NONE;

export class TestLayout {
  constructor({ testPlacements, listFilePathsIn }) {
    this.testPlacements = testPlacements;
    this.listFilePathsIn = listFilePathsIn;
  }

  readTheFacts(folder, changedPaths) {
    const filePaths = this.listFilePathsIn(folder);
    const testPlacements = filePaths.filter(hasATestFileName).map(testPath => ({ path: testPath, ...this.testPlacements.readPlacement(testPath) }));
    if (testPlacements.length === 0) return NO_TEST_LAYOUT;
    const followsAKnownTestLayout = changedPaths.length > 0
      && changedPaths.every(hasATestFileName)
      && !(isTestPath(folder) && filePaths.some(isTestSupport))
      && testPlacements.every(isPlaced);
    return { testPlacements, ...(followsAKnownTestLayout ? { followsAKnownTestLayout: true } : {}) };
  }
}
