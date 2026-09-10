import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class PythonMockMethodRoleFinder extends GenericMethodRoleFinder {
  language = "python";
  framework = "mock";
  dependencyLinePatterns = [/^mock\b/i];
  frameworkMarkPatterns = [/^\s*from\s+unittest\s+import\b.*\bmock\b/, /^\s*(?:from|import)\s+(?:unittest\.)?mock\b/, /\b(?:Magic)?Mock\s*\(/, /\bmocker\s*\./];
  testCodeMarks = new TestCodeMarks({
    interactionAssertions: [/\bassert_called_with\b/, /\bassert_called_once\b/, /\bassert_has_calls\b/],
    partialSubstitutes: [/\bpatch\.object\s*\(/],
    substitutesReturningSubstitutes: [/\.return_value\s*\.\s*\w+/, /\breturn_value\s*=\s*(?:mocker\s*\.\s*|mock\s*\.\s*)?(?:Magic)?Mock\s*\(/, /\breturn_value\s*=\s*(?:mocker\s*\.\s*)?create_autospec\s*\(/],
  });
}
