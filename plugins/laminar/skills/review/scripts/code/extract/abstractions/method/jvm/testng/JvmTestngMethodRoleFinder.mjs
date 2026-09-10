import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class JvmTestngMethodRoleFinder extends GenericMethodRoleFinder {
  family = "jvm";
  framework = "testng";
  dependencyLinePatterns = [/\btestng\b/];
  frameworkMarkPatterns = [/^\s*import\s+(?:static\s+)?org\.testng\./];
  testCodeMarks = new TestCodeMarks({
    setupMarkers: [/@Before(?:Method|Class|Test|Suite|Groups)\b/],
    teardownMarkers: [/@After(?:Method|Class|Test|Suite|Groups)\b/],
    testOpeners: [/@Test\b/],
  });
}
