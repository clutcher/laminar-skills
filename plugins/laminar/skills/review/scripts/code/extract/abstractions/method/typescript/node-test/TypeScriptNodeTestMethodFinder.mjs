import { GenericMethodFinder } from "../../generic/GenericMethodFinder.mjs";

export class TypeScriptNodeTestMethodFinder extends GenericMethodFinder {
  language = "javascript";
  framework = "node-test";
  frameworkMarkPatterns = [/\bfrom\s+["'](?:node|bun):test["']/, /\brequire\s*\(\s*["'](?:node|bun):test["']\s*\)/];
  testCallbacks = ["describe", "suite", "it", "test", "before", "after", "beforeEach", "afterEach", "beforeAll", "afterAll"];
}
