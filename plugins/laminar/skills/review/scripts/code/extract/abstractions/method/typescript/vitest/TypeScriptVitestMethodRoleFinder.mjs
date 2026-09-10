import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";
import { JAVASCRIPT_MOCK_FUNCTION_MARKS, JAVASCRIPT_TEST_STRUCTURE_MARKS } from "../testing/JavaScriptTestCodeMarks.mjs";

export class TypeScriptVitestMethodRoleFinder extends GenericMethodRoleFinder {
  language = "javascript";
  framework = "vitest";
  dependencyLinePatterns = [/^vitest$/];
  frameworkMarkPatterns = [/\bfrom\s+["']vitest["']/, /\bvi\s*\.\s*[A-Za-z]\w*\s*\(/];
  testCodeMarks = new TestCodeMarks({
    ...JAVASCRIPT_TEST_STRUCTURE_MARKS,
    ...JAVASCRIPT_MOCK_FUNCTION_MARKS,
    partialSubstitutes: [/\bvi\.spyOn\s*\(/],
  });
}
