import { stripLastSegment } from "../generic/imports/ImportNames.mjs";
import { readLastSegment } from "../../../../inputs/source/names/QualifiedNames.mjs";
import { GenericModuleRelationFinder } from "../generic/GenericModuleRelationFinder.mjs";

const BACKSLASH_USE_PATTERN = /^\s*use\s+([\w\\]+)(?:\s+as\s+(\w+))?\s*;/;

const readBackslashUse = (text, add) => {
  const backslashUse = BACKSLASH_USE_PATTERN.exec(text);
  if (!backslashUse) return false;
  add(backslashUse[2] || readLastSegment(backslashUse[1], "\\"), backslashUse[1], stripLastSegment(backslashUse[1], "\\"));
  return true;
};

export class PhpModuleRelationFinder extends GenericModuleRelationFinder {
  language = "php";
  importStatementForms = [readBackslashUse];
}
