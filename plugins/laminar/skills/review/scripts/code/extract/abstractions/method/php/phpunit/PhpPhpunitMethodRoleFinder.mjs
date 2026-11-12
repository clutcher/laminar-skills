import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class PhpPhpunitMethodRoleFinder extends GenericMethodRoleFinder {
  language = "php";
  framework = "phpunit";
  dependencyLinePatterns = [];
  frameworkMarkPatterns = [/^\s*use\s+PHPUnit\\/, /\bextends\s+\\?(?:PHPUnit\\Framework\\)?TestCase\b/];
  testCodeMarks = new TestCodeMarks({
    setupMarkers: [/\bfunction\s+(?:setUp|setUpBeforeClass)\s*\(/],
    teardownMarkers: [/\bfunction\s+(?:tearDown|tearDownAfterClass)\s*\(/],
  });
}
