import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class PythonPytestMockMethodRoleFinder extends GenericMethodRoleFinder {
  language = "python";
  framework = "pytest-mock";
  dependencyLinePatterns = [/^pytest-mock\b/i];
  frameworkMarkPatterns = [/\bmocker\b/];
  testCodeMarks = new TestCodeMarks({ partialSubstitutes: [/\bmocker\.spy\s*\(/] });
}
