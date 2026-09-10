import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";
import { JAVASCRIPT_MOCK_FUNCTION_MARKS, JAVASCRIPT_TEST_STRUCTURE_MARKS } from "../testing/JavaScriptTestCodeMarks.mjs";

export class TypeScriptJestMethodRoleFinder extends GenericMethodRoleFinder {
  language = "javascript";
  framework = "jest";
  dependencyLinePatterns = [/^jest$/, /^@jest\//, /^ts-jest$/, /^@types\/jest$/];
  frameworkMarkPatterns = [/\bfrom\s+["']@jest\/globals["']/, /\bjest\s*\.\s*[A-Za-z]\w*\s*\(/];
  testCodeMarks = new TestCodeMarks({
    ...JAVASCRIPT_TEST_STRUCTURE_MARKS,
    ...JAVASCRIPT_MOCK_FUNCTION_MARKS,
    partialSubstitutes: [/\bjest\.spyOn\s*\(/],
  });
}
