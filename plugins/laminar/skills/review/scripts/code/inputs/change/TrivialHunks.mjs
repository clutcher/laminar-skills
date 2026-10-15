import { filterLinesHoldingCode } from "../source/SourceText.mjs";
import { isGeneratedFile } from "../repository/RepositoryFileKinds.mjs";
import { buildWholeWordPattern } from "../source/text/PatternText.mjs";
import { readFileStem } from "../../../files/paths.mjs";
import { renamesTheFile } from "./AbstractionChange.mjs";

const VERSION_VALUE_PATTERN = /\b\d+\.\d+(\.\d+)*(-[A-Za-z0-9.]+)?\b/;
const BUILD_OR_CONFIG_PATH_PATTERN = /(pom\.xml|build\.gradle(\.kts)?|package(-lock)?\.json|Cargo\.toml|go\.(mod|sum)|\.csproj|requirements\.txt|pyproject\.toml|Gemfile(\.lock)?)$/;

const stripSpace = line => line.replace(/\s+/g, "");

function isImportReorder(added, removed, driver) {
  if (!added.length && !removed.length) return false;
  return [...added, ...removed].every(line => driver && driver.isImportLine(line));
}

const isFormattingOnly = (added, removed) =>
  added.map(stripSpace).sort().join("\n") === removed.map(stripSpace).sort().join("\n");

function isVersionBump(added, removed, filePath) {
  if (!BUILD_OR_CONFIG_PATH_PATTERN.test(filePath)) return false;
  if (!added.length || added.length !== removed.length) return false;
  return added.every((line, index) => VERSION_VALUE_PATTERN.test(line)
    && line.replace(VERSION_VALUE_PATTERN, "") === removed[index].replace(VERSION_VALUE_PATTERN, ""));
}

const isMovedBlockWithNoNewName = (added, removed) => {
  if (!added.length || !removed.length) return false;
  const removedForms = new Set(removed.map(stripSpace));
  return added.every(line => removedForms.has(stripSpace(line)));
};

const isAnImportLine = (line, driver) => Boolean(driver) && driver.isImportLine(line);

const readUnderTheOldFileName = (line, changedFile) => line.replace(buildWholeWordPattern(readFileStem(changedFile.path), "g"), readFileStem(changedFile.oldPath));

const changesOnlyTheFileName = (added, removed, changedFile, driver) => {
  if (!renamesTheFile(changedFile)) return false;
  const addedUnderTheOldName = added.filter(line => !isAnImportLine(line, driver)).map(line => readUnderTheOldFileName(line, changedFile));
  return isFormattingOnly(addedUnderTheOldName, removed.filter(line => !isAnImportLine(line, driver)));
};

export function isTrivialHunk(hunk, changedFile, driver) {
  const added = filterLinesHoldingCode(hunk.addedLines);
  const removed = filterLinesHoldingCode(hunk.removedLines);
  if (!added.length && !removed.length) return true;
  if (isGeneratedFile(changedFile.path, changedFile.lines)) return true;
  if (isImportReorder(added, removed, driver)) return true;
  if (isFormattingOnly(added, removed)) return true;
  if (isVersionBump(added, removed, changedFile.path)) return true;
  if (changesOnlyTheFileName(added, removed, changedFile, driver)) return true;
  return isMovedBlockWithNoNewName(added, removed);
}
