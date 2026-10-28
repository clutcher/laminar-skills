import { readFileStem, readFolderPath } from "../../../files/paths.mjs";
import { FILE_STATUS } from "./Hunk.mjs";
import { buildWholeWordPattern } from "../source/text/PatternText.mjs";
import { renamesTheFile } from "./AbstractionChange.mjs";

const TOKEN_PATTERN = /[\w$]+|\S/g;

const NAME_PATTERN = /^[A-Za-z_$][\w$]*$/;

const HOLE = "\u0000";

const RENAME_SOURCES = Object.freeze({ FILE: "file", DECLARATION: "declaration" });

const splitIntoTokens = line => String(line).match(TOKEN_PATTERN) || [];

const joinWithAHoleAt = (tokens, hole) => tokens.map((token, position) => (position === hole ? HOLE : token)).join(" ");

const listFormsWithANameLeftOut = line => {
  const tokens = splitIntoTokens(line);
  return tokens.flatMap((token, position) => (NAME_PATTERN.test(token) ? [{ form: joinWithAHoleAt(tokens, position), name: token }] : []));
};

const readTheFormWithoutTheName = (line, name) => {
  const tokens = splitIntoTokens(line);
  const position = tokens.indexOf(name);
  return position < 0 ? null : joinWithAHoleAt(tokens, position);
};

const indexTheRemovedNamesByForm = file => {
  const namesByFormMap = new Map();
  for (const removedLine of file.hunks.flatMap(hunk => hunk.removedLines)) {
    for (const { form, name } of listFormsWithANameLeftOut(removedLine)) {
      if (!namesByFormMap.has(form)) namesByFormMap.set(form, new Set());
      namesByFormMap.get(form).add(name);
    }
  }
  return namesByFormMap;
};

const listTheFileRenames = files => files
  .filter(renamesTheFile)
  .map(file => ({ from: readFileStem(file.oldPath), to: readFileStem(file.path), source: RENAME_SOURCES.FILE }));

const findTheOldName = (namesByFormMap, head) => {
  const form = readTheFormWithoutTheName(head.text, head.name);
  const oldNames = [...(namesByFormMap.get(form) || [])].filter(name => name !== head.name);
  return oldNames.length === 1 ? oldNames[0] : null;
};

const listTheDeclarationRenamesOf = (file, addedHeads) => {
  if (!addedHeads.length) return [];
  const namesByFormMap = indexTheRemovedNamesByForm(file);
  return addedHeads
    .map(head => ({ from: findTheOldName(namesByFormMap, head), to: head.name, source: RENAME_SOURCES.DECLARATION }))
    .filter(rename => rename.from);
};

const LEADING_RELATIVE_STEPS_PATTERN = /^(?:\.{1,2}\/)+/;

const SOURCE_EXTENSION_PATTERN = /\.(?:[cm]?[jt]sx?|sh|bash|py|rb|php|java|kt|scala|cs|go|rs)$/;

const removeTheExtension = given => given.replace(SOURCE_EXTENSION_PATTERN, "");

const readThePathTail = modulePath => {
  const relative = removeTheExtension(String(modulePath).replace(/^["'`]|["'`]$/g, "").replace(LEADING_RELATIVE_STEPS_PATTERN, ""));
  return relative.includes("/") ? relative : relative.replace(/\./g, "/");
};

const endsWithTheTail = (given, tail) => Boolean(tail) && (given === tail || given.endsWith(`/${tail}`));

const listTheMovedPlaces = file => [
  { before: removeTheExtension(file.oldPath), after: removeTheExtension(file.path) },
  { before: readFolderPath(file.oldPath), after: readFolderPath(file.path) },
];

const listTheMoves = files => files
  .filter(file => file.status === FILE_STATUS.RENAMED && file.oldPath)
  .flatMap(listTheMovedPlaces);

export class RenameMap {
  constructor(renames, moves = []) {
    this.renames = renames;
    this.moves = moves;
    this.patterns = renames.map(rename => ({ pattern: buildWholeWordPattern(rename.from, "g"), to: rename.to }));
    this.renamedDeclarationNames = new Set(renames.filter(rename => rename.source === RENAME_SOURCES.DECLARATION).map(rename => rename.to));
  }

  static readFromTheChange(files, listAddedHeads) {
    const fileRenames = listTheFileRenames(files);
    const renamedStems = new Set(fileRenames.map(rename => `${rename.from}>${rename.to}`));
    const declarationRenames = files.flatMap(file => listTheDeclarationRenamesOf(file, listAddedHeads(file)))
      .filter(rename => !renamedStems.has(`${rename.from}>${rename.to}`));
    return new RenameMap([...fileRenames, ...declarationRenames], listTheMoves(files));
  }

  readUnderTheNewNames(line) {
    return this.patterns.reduce((text, { pattern, to }) => text.replace(pattern, to), String(line));
  }

  explainsThePathEdit(removedPath, addedPath) {
    if (removedPath === addedPath) return true;
    const removedTail = readThePathTail(removedPath);
    const addedTail = readThePathTail(addedPath);
    return this.moves.some(move => endsWithTheTail(move.before, removedTail) && endsWithTheTail(move.after, addedTail));
  }

  isARenamedDeclaration(name) {
    return this.renamedDeclarationNames.has(name);
  }

  toJSON() {
    return this.renames.map(({ from, to }) => ({ from, to }));
  }
}
