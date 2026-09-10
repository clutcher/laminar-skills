import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class CSharpMoqMethodRoleFinder extends GenericMethodRoleFinder {
  language = "csharp";
  framework = "moq";
  dependencyLinePatterns = [/^Moq$/];
  frameworkMarkPatterns = [/^\s*using\s+Moq\b/];
  testCodeMarks = new TestCodeMarks({
    interactionAssertions: [/\bMock\.Verify\b/],
    substitutesReturningSubstitutes: [/\.Returns?\s*\([^)]*(?:\.Object\b|Mock\.Of\s*<|NewMock\w*\s*\()/],
  });
}
