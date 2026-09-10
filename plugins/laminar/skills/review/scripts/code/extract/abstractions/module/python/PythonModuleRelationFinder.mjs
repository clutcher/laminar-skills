import { parseAliasedNames, buildPathImportReader } from "../generic/imports/ImportNames.mjs";
import { findNestedImport } from "../generic/imports/NestedImports.mjs";
import { GenericModuleRelationFinder } from "../generic/GenericModuleRelationFinder.mjs";
import { ImportConventions } from "../generic/imports/ImportConventions.mjs";

const PATH_IMPORT_PATTERN = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)(?:\s+as\s+(\w+))?\s*$/;

const readFirstSegment = full => full.split(".")[0];

const pathImportOf = buildPathImportReader(PATH_IMPORT_PATTERN, (full, add) => add(readFirstSegment(full), readFirstSegment(full), readFirstSegment(full)));

const FROM_IMPORT_PATTERN = /^\s*from\s+([\w.]+)\s+import\s+\(?([^)#]*)\)?/;

const readFromImport = (text, add) => {
  const fromImport = FROM_IMPORT_PATTERN.exec(text);
  if (!fromImport) return false;
  for (const { name, alias } of parseAliasedNames(fromImport[2], /\s+as\s+/)) add(alias, `${fromImport[1]}.${name}`, fromImport[1]);
  return true;
};

const PYTHON_IMPORT_PATTERN = /^\s*from\s+([A-Za-z_][\w.]*)\s+import\s+([A-Za-z_]\w*)\s*$/;
const PYTHON_ALIAS_PATTERN = /^([A-Za-z_]\w*)\s*=\s*(?:[A-Za-z_]\w*\.)*([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*$/;

const findNestedImportOfALine = line => findNestedImport(line, { aliasForm: PYTHON_ALIAS_PATTERN, importForm: PYTHON_IMPORT_PATTERN, readEnclosing: found => found[1].split(".").pop(), bareAt: 2 });

const WILDCARD_FROM_IMPORT_PATTERN = /^\s*from\s+([\w.]+)\s+import\s+\*/;

export class PythonModuleRelationFinder extends GenericModuleRelationFinder {
  language = "python";
  importConventions = new ImportConventions({
    importsBindNoDottedName: true,
    relativeImportsUseDots: true,
    importedNameMayBeAModule: true,
    packagesAreFoldersWithInitFiles: true,
  });
  importStatementForms = [readFromImport, pathImportOf];

  findNestedImport(line) {
    return findNestedImportOfALine(line);
  }

  findWildcardImport(text) {
    return (WILDCARD_FROM_IMPORT_PATTERN.exec(text) || [])[1] || null;
  }
}
