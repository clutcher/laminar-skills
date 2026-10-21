import { parseJsonKeys } from "../generic/dependencies/DependencyLines.mjs";
import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

const THE_PLACEHOLDER_OF_NPM_INIT_PATTERN = /\bno test specified\b/i;

const readTheTestScript = buildFileLines => {
  try {
    const parsed = JSON.parse(buildFileLines.join("\n"));
    return String(((parsed && parsed.scripts) || {}).test || "").trim();
  } catch { return ""; }
};

export class NpmApplicationFinder extends GenericApplicationFinder {
  buildSystem = "npm";
  buildFileNames = ["package.json"];
  buildFileSuffixes = [];
  dependencyFormats = [{ name: /^package\.json$/, readLines: parseJsonKeys }];
  declaresTheTestRunner = true;

  declaresATestSetup(buildFileLines) {
    const testScript = readTheTestScript(buildFileLines);
    return testScript !== "" && !THE_PLACEHOLDER_OF_NPM_INIT_PATTERN.test(testScript);
  }
}
