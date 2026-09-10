import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class GoTestingMethodRoleFinder extends GenericMethodRoleFinder {
  language = "golang";
  framework = "testing";
  dependencyLinePatterns = [];
  frameworkMarkPatterns = [/^\s*(?:import\s+)?(?:\w+\s+)?"testing"\s*$/, /\*testing\.[TBM]\b/];
  testCodeMarks = new TestCodeMarks({
    setupMarkers: [/\bfunc\s+(?:\([^)]*\)\s*)?(?:TestMain|Setup(?:Test|Suite|Subtest)|BeforeTest)\s*\(/],
    teardownMarkers: [/\bfunc\s+(?:\([^)]*\)\s*)?(?:TearDown(?:Test|Suite|Subtest)|AfterTest)\s*\(/],
    testOpeners: [/\bfunc\s+(?:\([^)]*\)\s*)?(?:Test|Benchmark|Fuzz)\w*\s*\(/],
  });
}
