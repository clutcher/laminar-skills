import { RELATION_KINDS } from "../../../../code/index.mjs";
import { readFileName, readFolderPath } from "../../../../files/paths.mjs";
import { formatImportersInTheFolderNote, readListedPath } from "../../formats/SliceFormat.mjs";

const readFileOf = abstraction => (abstraction && abstraction.place ? abstraction.place.file : "");

const readImportingFile = relation => (relation.place && relation.place.file) || readFileOf(relation.from);

const isAnImporterInTheFolder = (importing, imported) => Boolean(importing && imported)
  && importing !== imported
  && readFolderPath(importing) === readFolderPath(imported);

const collectImporterNamesByFile = codeGraph => {
  const importerNamesByFileMap = new Map();
  for (const relation of codeGraph.relations.filter(graphRelation => graphRelation.kind === RELATION_KINDS.IMPORTS)) {
    const imported = readFileOf(relation.to);
    const importing = readImportingFile(relation);
    if (!isAnImporterInTheFolder(importing, imported)) continue;
    if (!importerNamesByFileMap.has(imported)) importerNamesByFileMap.set(imported, new Set());
    importerNamesByFileMap.get(imported).add(readFileName(importing));
  }
  return importerNamesByFileMap;
};

export class ImportersInTheFolder {
  constructor(codeGraph) {
    this.importerNamesByFileMap = codeGraph ? collectImporterNamesByFile(codeGraph) : new Map();
  }

  noteTheImporters(fileListLine) {
    const importerNames = this.importerNamesByFileMap.get(readListedPath(fileListLine));
    return importerNames ? formatImportersInTheFolderNote(fileListLine, [...importerNames].sort()) : fileListLine;
  }
}
