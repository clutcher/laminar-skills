import path from "node:path";
import { DIFF_DRIVER_BY_EXTENSION_MAP, findLanguage } from "./Languages.mjs";
import { findDriver } from "./drivers/LanguageRegistry.mjs";
import { doRegionsHoldLine } from "../../graph/abstractions/Place.mjs";
import { findGivenWhenThenComments } from "./lines/CommentLines.mjs";

const TEST_FOLDER_PATTERN = /(^|\/)(test|tests|spec|specs|__tests__)(\/|$)/;

const readTestFileNamePatterns = filePath => findLanguage(DIFF_DRIVER_BY_EXTENSION_MAP[path.posix.extname(filePath).toLowerCase()]).testFileNames || [];

export const isTestPath = filePath => TEST_FOLDER_PATTERN.test(String(filePath)) || readTestFileNamePatterns(String(filePath)).some(name => name.test(String(filePath)));

export const findInlineTestRegions = (filePath, lines) => {
  const driver = findDriver(filePath);
  const inline = driver && driver.readsInlineTests && lines ? driver.findInlineTests(lines) : null;
  return inline ? inline.regions : [];
};

export function countPhaseMarks(bodyLines, filePath) {
  const driver = findDriver(filePath);
  return driver ? findGivenWhenThenComments(bodyLines, driver).length : 0;
}

export class TestCode {
  constructor(linesOf) {
    this.readFileLines = linesOf;
    this.regionsByPathMap = new Map();
  }

  findInlineTestRegions(filePath) {
    if (!this.regionsByPathMap.has(filePath)) this.regionsByPathMap.set(filePath, findInlineTestRegions(filePath, this.readFileLines(filePath)));
    return this.regionsByPathMap.get(filePath);
  }

  isInlineTestPlace(place) {
    return doRegionsHoldLine(this.findInlineTestRegions(place.path), place.line);
  }

  isTestPlace(place) {
    return isTestPath(place.path) || this.isInlineTestPlace(place);
  }

  isTestCode(filePath, lines) {
    if (isTestPath(filePath)) return true;
    if (!lines) return false;
    return doRegionsHoldLine(this.findInlineTestRegions(filePath), lines.from);
  }
}
