const IMPORT_LINE_PATTERN = /^\s*(package|import|using|require|from\s+\S+\s+import|#include|use\s|namespace)\b/;

export const isImportLine = line => IMPORT_LINE_PATTERN.test(String(line));

export const IMPORT_OR_NAMESPACE_LINE_PATTERN = /^\s*(package|import|using|require|from\s+\S+\s+import|#include|use|namespace)\b/;
