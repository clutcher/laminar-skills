import { parseAliasedNames, stripLastSegment } from "../generic/imports/ImportNames.mjs";
import { readLastSegment } from "../../../../inputs/source/names/QualifiedNames.mjs";
import { GenericModuleRelationFinder } from "../generic/GenericModuleRelationFinder.mjs";

const USE_PATH_PATTERN = /^\s*(?:pub\s+)?use\s+([\w:]+?)(?:::\{([^}]*)\}|\s+as\s+(\w+))?\s*;/;

const usePathOf = (text, add) => {
  const usePath = USE_PATH_PATTERN.exec(text);
  if (!usePath) return false;
  const [, from, braced, alias] = usePath;
  if (braced) for (const { name, alias: named } of parseAliasedNames(braced, /\s+as\s+/)) add(named, `${from}::${name}`, from);
  else add(alias || readLastSegment(from, "::"), from, stripLastSegment(from, "::"));
  return true;
};

export class RustModuleRelationFinder extends GenericModuleRelationFinder {
  language = "rust";
  importStatementForms = [usePathOf];
}
