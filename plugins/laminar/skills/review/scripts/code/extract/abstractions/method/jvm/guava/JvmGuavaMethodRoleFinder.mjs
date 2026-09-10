import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class JvmGuavaMethodRoleFinder extends GenericMethodRoleFinder {
  family = "jvm";
  framework = "guava";
  dependencyLinePatterns = [/\bcom\.google\.guava\b/];
  frameworkMarkPatterns = [/^\s*import\s+(?:static\s+)?com\.google\.common\./, /@VisibleForTesting\b/];
  testCodeMarks = new TestCodeMarks({ visibleForTesting: /@VisibleForTesting\b/ });
}
