import { parseAliasedNames } from "../generic/imports/ImportNames.mjs";
import { GenericModuleRelationFinder } from "../generic/GenericModuleRelationFinder.mjs";

const BRACED_PATH_IMPORT_PATTERN = /^\s*import\s+([\w.]+)\.\{([^}]*)\}/;

const readBracedPathImport = (text, add) => {
  const bracedPath = BRACED_PATH_IMPORT_PATTERN.exec(text);
  if (!bracedPath) return false;
  for (const { name, alias } of parseAliasedNames(bracedPath[2], /\s*=>\s*/)) add(alias, `${bracedPath[1]}.${name}`, bracedPath[1]);
  return true;
};

export class ScalaModuleRelationFinder extends GenericModuleRelationFinder {
  language = "scala";
  importStatementForms = [readBracedPathImport];
}
