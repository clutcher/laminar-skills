import { GenericMethodFinder } from "../../generic/GenericMethodFinder.mjs";

export class TypeScriptVitestMethodFinder extends GenericMethodFinder {
  language = "javascript";
  framework = "vitest";
  testCallbacks = ["describe", "it", "test", "beforeAll", "afterAll", "beforeEach", "afterEach"];
}
