import { GenericMethodRoleFinder } from "../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../generic/testing/TestCodeMarks.mjs";

export class JavaMethodRoleFinder extends GenericMethodRoleFinder {
  language = "java";
  testCodeMarks = new TestCodeMarks({ privateMethodsReached: [/\bsetAccessible\s*\(\s*true\s*\)/, /\bgetDeclaredMethod\s*\(/] });
}
