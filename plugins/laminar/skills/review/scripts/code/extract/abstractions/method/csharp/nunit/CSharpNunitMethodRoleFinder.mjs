import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class CSharpNunitMethodRoleFinder extends GenericMethodRoleFinder {
  language = "csharp";
  framework = "nunit";
  dependencyLinePatterns = [/^NUnit$/];
  frameworkMarkPatterns = [/^\s*using\s+NUnit\./];
  testCodeMarks = new TestCodeMarks({
    setupMarkers: [/\[\s*(?:OneTime)?SetUp\b/],
    teardownMarkers: [/\[\s*(?:OneTime)?TearDown\b/],
    testOpeners: [/\[\s*(?:Test|TestCase|TestCaseSource|Theory)\b/],
  });
}
