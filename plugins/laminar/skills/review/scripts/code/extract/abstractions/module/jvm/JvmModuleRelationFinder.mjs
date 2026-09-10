import { buildPathImportReader, stripLastSegment } from "../generic/imports/ImportNames.mjs";
import { readLastSegment } from "../../../../inputs/source/names/QualifiedNames.mjs";
import { findNestedImport } from "../generic/imports/NestedImports.mjs";
import { GenericModuleRelationFinder } from "../generic/GenericModuleRelationFinder.mjs";

const PATH_IMPORT_PATTERN = /^\s*import\s+(?:static\s+)?([\w.]+(?:\s*,\s*[\w.]+)*)(?:\s+as\s+(\w+))?\s*;?\s*$/;

const pathImportOf = buildPathImportReader(PATH_IMPORT_PATTERN, (full, add) => add(readLastSegment(full, "."), full, stripLastSegment(full, ".")));

const JVM_IMPORT_PATTERN = /^\s*import\s+(?!static\b)([A-Za-z_][\w.]*)\.([A-Za-z_]\w*)\s*;?\s*$/;

const findNestedImportOfALine = line => findNestedImport(line, { importForm: JVM_IMPORT_PATTERN, readEnclosing: found => found[1].split(".").pop(), bareAt: 2 });

const DOTTED_IMPORT_PATTERN = /^\s*import\s+(?:static\s+)?([\w.]+?)(\.\*)?(?:\s+as\s+(\w+))?\s*;?\s*$/;

const WILDCARD_IMPORT_PATTERN = /^\s*import\s+(?:static\s+)?([\w.]+)\.\*/;

export class JvmModuleRelationFinder extends GenericModuleRelationFinder {
  family = "jvm";
  importStatementForms = [pathImportOf];

  findNestedImport(line) {
    return findNestedImportOfALine(line);
  }

  findDottedImport(text) {
    const dotted = DOTTED_IMPORT_PATTERN.exec(text);
    if (!dotted) return null;
    return { word: dotted[2] ? null : dotted[3] || readLastSegment(dotted[1], ".") };
  }

  findWildcardImport(text) {
    return (WILDCARD_IMPORT_PATTERN.exec(text) || [])[1] || null;
  }
}
