const IMPORT_LINE_PATTERN = /^\s*(package|import|using|require|from\s+\S+\s+import|#include|use\s|namespace)\b/;

const SOURCED_FILE_LINE_PATTERN = /^\s*(?:source|\.)\s+["']?[\w$~{}.\/-]*[\/.][\w$~{}.\/"'-]*\s*(?:[;#].*)?$/;

const RE_EXPORT_LINE_PATTERN = /^\s*export\s+(?:type\s+)?(?:\*|\{[^}]*\})(?:\s+as\s+[\w$]+)?\s*from\s*["'][^"']+["']/;

const REQUIRED_MODULE_LINE_PATTERN = /^\s*(?:const|let|var)\s+[^=]+=\s*require\s*\(\s*["'`][^"'`]+["'`]\s*\)/;

const IMPORT_FORMS = Object.freeze([IMPORT_LINE_PATTERN, SOURCED_FILE_LINE_PATTERN, RE_EXPORT_LINE_PATTERN, REQUIRED_MODULE_LINE_PATTERN]);

export const isImportLine = line => IMPORT_FORMS.some(pattern => pattern.test(String(line)));

export const IMPORT_OR_NAMESPACE_LINE_PATTERN = /^\s*(package|import|using|require|from\s+\S+\s+import|#include|use|namespace)\b/;

const MODULE_PATH_PATTERN = /(\brequire\s*\(\s*|\bimport\s*\(\s*|\bfrom\s+|^\s*source\s+|^\s*\.\s+)(["'`]?)([^"'`\s);]+)\2/g;

const DOTTED_NAME_PATTERN = /^(\s*(?:import|package|using)\s+(?:static\s+)?)([\w$]+(?:\.[\w$*]+)+)/;

const MODULE_PATH_MARK = "$1$2<path>$2";

const DOTTED_NAME_MARK = "$1<path>";

export const hideTheModulePaths = line => String(line).replace(DOTTED_NAME_PATTERN, DOTTED_NAME_MARK).replace(MODULE_PATH_PATTERN, MODULE_PATH_MARK);

export const listTheModulePaths = line => {
  const text = String(line);
  const dotted = DOTTED_NAME_PATTERN.exec(text);
  return [...(dotted ? [dotted[2]] : []), ...[...text.replace(DOTTED_NAME_PATTERN, DOTTED_NAME_MARK).matchAll(MODULE_PATH_PATTERN)].map(found => found[3])];
};
