import { filterLinesHoldingCode } from "../source/SourceText.mjs";
import { hideTheModulePaths, isImportLine, listTheModulePaths } from "../source/lines/ImportLines.mjs";

const stripSpace = line => line.replace(/\s+/g, "");

const isAnImportOf = (line, driver) => isImportLine(line) || Boolean(driver && driver.isImportLine(line));

export const readTheComparedForm = line => stripSpace(hideTheModulePaths(line));

const readTheReferences = (lines, driver) => filterLinesHoldingCode(lines).map(line => ({
  form: readTheComparedForm(line),
  paths: listTheModulePaths(line),
  isImport: isAnImportOf(line, driver),
}));

const groupByForm = references => {
  const referencesByFormMap = new Map();
  for (const reference of references) {
    if (!referencesByFormMap.has(reference.form)) referencesByFormMap.set(reference.form, []);
    referencesByFormMap.get(reference.form).push(reference);
  }
  return referencesByFormMap;
};

const followsTheMoves = (removed, added, renameMap) => removed.paths.length === added.paths.length
  && removed.paths.every((removedPath, position) => renameMap.explainsThePathEdit(removedPath, added.paths[position]));

const pairsOnlyMovedPaths = (removedOfTheForm, addedOfTheForm, renameMap) => {
  const removedFirst = removedOfTheForm.length <= addedOfTheForm.length;
  const [fewer, unpaired] = removedFirst ? [removedOfTheForm, [...addedOfTheForm]] : [addedOfTheForm, [...removedOfTheForm]];
  return fewer.every(reference => {
    const paired = unpaired.findIndex(other => (removedFirst ? followsTheMoves(reference, other, renameMap) : followsTheMoves(other, reference, renameMap)));
    if (paired >= 0) unpaired.splice(paired, 1);
    return paired >= 0;
  });
};

const holdsOnlyImports = references => references.every(reference => reference.isImport);

const changesOnlyTheReferencesOfAForm = (removedOfTheForm, addedOfTheForm, renameMap) => {
  const sameCount = removedOfTheForm.length === addedOfTheForm.length;
  if (!sameCount && !holdsOnlyImports([...removedOfTheForm, ...addedOfTheForm])) return false;
  return pairsOnlyMovedPaths(removedOfTheForm, addedOfTheForm, renameMap);
};

export const changesOnlyReferences = ({ added, removed, renameMap, driver }) => {
  const removedByFormMap = groupByForm(readTheReferences(removed.map(line => renameMap.readUnderTheNewNames(line)), driver));
  const addedByFormMap = groupByForm(readTheReferences(added, driver));
  const forms = new Set([...removedByFormMap.keys(), ...addedByFormMap.keys()]);
  return [...forms].every(form => changesOnlyTheReferencesOfAForm(removedByFormMap.get(form) || [], addedByFormMap.get(form) || [], renameMap));
};
