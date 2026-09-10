import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";
import { JAVASCRIPT_TEST_STRUCTURE_MARKS } from "../testing/JavaScriptTestCodeMarks.mjs";

export class TypeScriptMochaMethodRoleFinder extends GenericMethodRoleFinder {
  language = "javascript";
  framework = "mocha";
  dependencyLinePatterns = [/^mocha$/, /^@types\/mocha$/];
  frameworkMarkPatterns = [/\bfrom\s+["']mocha["']/, /\brequire\s*\(\s*["']mocha["']\s*\)/];
  testCodeMarks = new TestCodeMarks(JAVASCRIPT_TEST_STRUCTURE_MARKS);
}
