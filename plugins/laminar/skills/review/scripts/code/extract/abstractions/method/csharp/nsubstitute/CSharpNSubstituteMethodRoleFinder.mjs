import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class CSharpNSubstituteMethodRoleFinder extends GenericMethodRoleFinder {
  language = "csharp";
  framework = "nsubstitute";
  dependencyLinePatterns = [/^NSubstitute$/];
  frameworkMarkPatterns = [/^\s*using\s+NSubstitute\b/];
  testCodeMarks = new TestCodeMarks({ interactionAssertions: [/\bReceived\s*\(/] });
}
