import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class CSharpXunitMethodRoleFinder extends GenericMethodRoleFinder {
  language = "csharp";
  framework = "xunit";
  dependencyLinePatterns = [/^xunit/];
  frameworkMarkPatterns = [/^\s*using\s+Xunit\b/, /\[(?:Fact|Theory)\]/];
  testCodeMarks = new TestCodeMarks({
    setupMarkers: [/\bTask\s+InitializeAsync\s*\(/],
    teardownMarkers: [/\b(?:void\s+Dispose|ValueTask\s+DisposeAsync|Task\s+DisposeAsync)\s*\(/],
    testOpeners: [/\[\s*(?:Fact|Theory)\b/],
  });
}
