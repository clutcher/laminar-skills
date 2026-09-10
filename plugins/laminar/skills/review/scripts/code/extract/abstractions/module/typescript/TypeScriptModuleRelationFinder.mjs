import { parseAliasedNames } from "../generic/imports/ImportNames.mjs";
import { findNestedImport } from "../generic/imports/NestedImports.mjs";
import { readFileStem } from "../../../../../files/paths.mjs";
import { GenericModuleRelationFinder } from "../generic/GenericModuleRelationFinder.mjs";
import { ImportConventions } from "../generic/imports/ImportConventions.mjs";

const MODULE_IMPORT_PATTERN = /^\s*import\s+(?:type\s+)?(.+?)\s+from\s+['"]([^'"]+)['"]/;

const REQUIRE_CALL_PATTERN = /(?:const|let|var)\s+(\{[^}]*\}|[\w$]+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/;

const readModuleImport = (text, add) => {
  const moduleImport = MODULE_IMPORT_PATTERN.exec(text);
  if (!moduleImport) return false;
  const [, clause, from] = moduleImport;
  const braced = /\{([^}]*)\}/.exec(clause);
  if (braced) for (const { name, alias } of parseAliasedNames(braced[1], /\s+as\s+/)) add(alias, `${from}.${name}`, from, true);
  const bare = clause.replace(/\{[^}]*\}/, "").split(",").map(piece => piece.trim()).filter(Boolean);
  for (const piece of bare) add(piece.replace(/^\*\s+as\s+/, ""), from, from, true);
  return true;
};

const requireOf = (text, add) => {
  const required = REQUIRE_CALL_PATTERN.exec(text);
  if (!required) return false;
  const [, target, from] = required;
  if (target.startsWith("{")) for (const { name, alias } of parseAliasedNames(target.slice(1, -1), /\s*:\s*/)) add(alias, `${from}.${name}`, from, true);
  else add(target, from, from, true);
  return true;
};

const NAMED_IMPORT_PATTERN = /^\s*import\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*from\s*["']([^"']+)["']/;
const TYPESCRIPT_ALIAS_PATTERN = /^\s*(?:export\s+)?import\s+([A-Za-z_$][\w$]*)\s*=\s*(?:[A-Za-z_$][\w$]*\.)*([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*;?\s*$/;

const findNestedImportOfALine = line => findNestedImport(line, { aliasForm: TYPESCRIPT_ALIAS_PATTERN, importForm: NAMED_IMPORT_PATTERN, readEnclosing: found => readFileStem(found[2]), bareAt: 1 });

const RE_EXPORT_PATTERN = /^\s*export\s+(\*|\{[^}]*\})\s*from\s+['"]([^'"]+)['"]/;

const DEFAULT_EXPORT_PATTERN = /^\s*(?:export\s+default|module\.exports\s*=)\s*(?:(?:class|function\*?|async\s+function)\s+)?(new\s+)?([A-Za-z_$][\w$.]*)\s*(?:[;({]|$)/;

export class TypeScriptModuleRelationFinder extends GenericModuleRelationFinder {
  language = "javascript";
  importConventions = new ImportConventions({ defaultExportsNameTheModule: true });
  importStatementForms = [readModuleImport, requireOf];

  findNestedImport(line) {
    return findNestedImportOfALine(line);
  }

  findReExport(text) {
    const found = RE_EXPORT_PATTERN.exec(text);
    return found ? { clause: found[1], from: found[2] } : null;
  }

  findDefaultExport(code) {
    const found = DEFAULT_EXPORT_PATTERN.exec(code);
    return found ? { name: found[2], constructed: Boolean(found[1]) } : null;
  }
}
