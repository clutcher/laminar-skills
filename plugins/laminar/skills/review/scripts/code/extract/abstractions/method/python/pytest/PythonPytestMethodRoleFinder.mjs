import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class PythonPytestMethodRoleFinder extends GenericMethodRoleFinder {
  language = "python";
  framework = "pytest";
  dependencyLinePatterns = [/^pytest\b/i];
  frameworkMarkPatterns = [/^\s*(?:from|import)\s+pytest\b/, /@pytest\./, /^def\s+test\w*\s*\(/];
  testCodeMarks = new TestCodeMarks({
    setupMarkers: [/\bdef\s+setup_(?:method|function|class|module)\b/, /@pytest\.fixture\b/],
    teardownMarkers: [/\bdef\s+teardown_(?:method|function|class|module)\b/],
    testOpeners: [/\bdef\s+test\w*\s*\(/],
  });
}
