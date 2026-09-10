import { GenericMethodFinder } from "../../generic/GenericMethodFinder.mjs";

export class TypeScriptJestMethodFinder extends GenericMethodFinder {
  language = "javascript";
  framework = "jest";
  testCallbacks = ["describe", "it", "test", "beforeAll", "afterAll", "beforeEach", "afterEach"];
}
