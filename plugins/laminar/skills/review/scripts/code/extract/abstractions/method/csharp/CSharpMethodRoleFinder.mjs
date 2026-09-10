import { GenericMethodRoleFinder } from "../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../generic/testing/TestCodeMarks.mjs";

export class CSharpMethodRoleFinder extends GenericMethodRoleFinder {
  language = "csharp";
  testCodeMarks = new TestCodeMarks({ privateMethodsReached: [/\bBindingFlags\.NonPublic\b/] });
}
