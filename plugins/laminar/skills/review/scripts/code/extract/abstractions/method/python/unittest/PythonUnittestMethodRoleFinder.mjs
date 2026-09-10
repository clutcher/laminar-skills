import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class PythonUnittestMethodRoleFinder extends GenericMethodRoleFinder {
  language = "python";
  framework = "unittest";
  dependencyLinePatterns = [];
  frameworkMarkPatterns = [/^\s*(?:from|import)\s+unittest\b/, /\bunittest\.TestCase\b/];
  testCodeMarks = new TestCodeMarks({
    setupMarkers: [/(?<![\w.])(?:setUp|asyncSetUp|setUpClass|setUpModule)\s*\(/],
    teardownMarkers: [/(?<![\w.])(?:tearDown|asyncTearDown|tearDownClass|tearDownModule)\s*\(/],
    testOpeners: [/\bdef\s+test\w*\s*\(/],
  });
}
