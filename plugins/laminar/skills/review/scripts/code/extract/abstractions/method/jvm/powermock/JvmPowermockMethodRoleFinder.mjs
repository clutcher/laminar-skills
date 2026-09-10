import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class JvmPowermockMethodRoleFinder extends GenericMethodRoleFinder {
  family = "jvm";
  framework = "powermock";
  dependencyLinePatterns = [/\bpowermock\b/];
  frameworkMarkPatterns = [/^\s*import\s+(?:static\s+)?org\.powermock\./, /\bWhitebox\s*\./, /@PrepareForTest\b/];
  testCodeMarks = new TestCodeMarks({ privateMethodsReached: [/\bWhitebox\.invokeMethod\b/] });
}
