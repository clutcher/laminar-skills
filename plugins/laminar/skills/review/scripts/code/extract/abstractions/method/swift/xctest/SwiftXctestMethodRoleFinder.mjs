import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class SwiftXctestMethodRoleFinder extends GenericMethodRoleFinder {
  language = "swift";
  framework = "xctest";
  dependencyLinePatterns = [];
  frameworkMarkPatterns = [/^\s*import\s+XCTest\b/];
  testCodeMarks = new TestCodeMarks({
    setupMarkers: [/\bfunc\s+(?:setUp|setUpWithError)\s*\(/],
    teardownMarkers: [/\bfunc\s+(?:tearDown|tearDownWithError)\s*\(/],
  });
}
