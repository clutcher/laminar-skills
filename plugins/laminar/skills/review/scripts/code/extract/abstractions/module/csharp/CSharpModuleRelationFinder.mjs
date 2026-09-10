import { stripLastSegment } from "../generic/imports/ImportNames.mjs";
import { findNestedAlias } from "../generic/imports/NestedImports.mjs";
import { GenericModuleRelationFinder } from "../generic/GenericModuleRelationFinder.mjs";

const ALIAS_USING_PATTERN = /^\s*using\s+(\w+)\s*=\s*([\w.]+)\s*;/;

const readAliasUsing = (text, add) => {
  const aliasUsing = ALIAS_USING_PATTERN.exec(text);
  if (!aliasUsing) return false;
  add(aliasUsing[1], aliasUsing[2], stripLastSegment(aliasUsing[2], "."));
  return true;
};

const CSHARP_ALIAS_PATTERN = /^\s*(?:global\s+)?using\s+([A-Za-z_]\w*)\s*=\s*(?:global::)?(?:[A-Za-z_]\w*\.)*([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*;\s*$/;

export class CSharpModuleRelationFinder extends GenericModuleRelationFinder {
  language = "csharp";
  importStatementForms = [readAliasUsing];

  findNestedImport(line) {
    return findNestedAlias(line, CSHARP_ALIAS_PATTERN);
  }
}
