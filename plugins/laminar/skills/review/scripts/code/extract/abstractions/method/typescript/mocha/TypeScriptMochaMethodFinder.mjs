import { GenericMethodFinder } from "../../generic/GenericMethodFinder.mjs";

export class TypeScriptMochaMethodFinder extends GenericMethodFinder {
  language = "javascript";
  framework = "mocha";
  testCallbacks = ["describe", "it", "context", "specify", "suite", "beforeEach", "afterEach"];
}
