import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class CSharpMstestMethodRoleFinder extends GenericMethodRoleFinder {
  language = "csharp";
  framework = "mstest";
  dependencyLinePatterns = [/^MSTest\./];
  frameworkMarkPatterns = [/^\s*using\s+Microsoft\.VisualStudio\.TestTools\.UnitTesting\b/, /\[TestMethod\]/];
  testCodeMarks = new TestCodeMarks({
    setupMarkers: [/\[\s*(?:Test|Class|Assembly)Initialize\b/],
    teardownMarkers: [/\[\s*(?:Test|Class|Assembly)Cleanup\b/],
    testOpeners: [/\[\s*(?:Data)?TestMethod\b/],
  });
}
