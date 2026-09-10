import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class JvmJunitMethodRoleFinder extends GenericMethodRoleFinder {
  family = "jvm";
  framework = "junit";
  dependencyLinePatterns = [/\bjunit\b/, /\bspring-boot-starter-test\b/];
  frameworkMarkPatterns = [/^\s*import\s+(?:static\s+)?org\.junit\./, /^\s*@(?:Test|ParameterizedTest|BeforeEach|BeforeAll|Before|AfterEach|AfterAll)\b/];
  testCodeMarks = new TestCodeMarks({
    setupMarkers: [/@Before(?:Each|All|Class)?(?!\w)/, /(?<![\w.])setUp\s*\(/],
    teardownMarkers: [/@After(?:Each|All|Class)?(?!\w)/, /(?<![\w.])tearDown\s*\(/],
    testOpeners: [/@Test\b/, /@ParameterizedTest\b/, /@RepeatedTest\b/, /@TestFactory\b/, /@TestTemplate\b/],
  });
}
