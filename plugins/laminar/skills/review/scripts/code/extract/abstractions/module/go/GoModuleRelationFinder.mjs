import { GenericModuleRelationFinder } from "../generic/GenericModuleRelationFinder.mjs";
import { ImportConventions } from "../generic/imports/ImportConventions.mjs";
import { PackageScope } from "../generic/imports/PackageScope.mjs";

const GO_IMPORT_PATH_PATTERN = /^\s*(?:[\w.]+\s+)?"([^"]+)"\s*$/;

const IMPORT_ALIAS_PATTERN = /^\s*([\w.]+)\s+"/;

const readBoundWord = (importClause, path) => {
  const alias = IMPORT_ALIAS_PATTERN.exec(importClause);
  return alias ? alias[1] : path.split("/").pop();
};

export class GoModuleRelationFinder extends GenericModuleRelationFinder {
  language = "golang";
  importConventions = new ImportConventions({ importsNameFolders: true });
  packageScope = new PackageScope({ qualifiedReceiverIsAPackageMember: true, fileLevelValuesShareTheFolder: true });

  opensAnImportBlock(text) {
    return /^\s*import\s*\($/.test(text);
  }

  closesAnImportBlock(text) {
    return /^\s*\)/.test(text);
  }

  findImportedPath(text, insideABlock) {
    const importClause = text.replace(/^\s*import\s+/, "");
    const goPath = insideABlock || /^\s*import\s+(?:[\w.]+\s+)?"/.test(text) ? GO_IMPORT_PATH_PATTERN.exec(importClause) : null;
    if (!goPath) return null;
    return { word: readBoundWord(importClause, goPath[1]), path: goPath[1] };
  }
}
