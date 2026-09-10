import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class GoMethodRelationFinder extends GenericMethodRelationFinder {
  language = "golang";
  typesInFolderAreInScope = true;
  castsAfterADot = true;
  resultsComeFromInterfaces = true;
  functionsOfTheFolderAreInScope = true;
  typeOfAnImportedModuleIsQualified = true;
}
