import { FILE_STATUS } from "../../inputs/change/Hunk.mjs";
import { CHANGE_KINDS } from "../../inputs/change/AbstractionChange.mjs";
import { CreatedFolders } from "../../inputs/change/CreatedFolders.mjs";
import { RenameMap } from "../../inputs/change/RenameMap.mjs";
import { changesOnlyReferences, readTheComparedForm } from "../../inputs/change/ReferenceOnlyLines.mjs";
import { PUBLIC_CHANGE_KINDS, PublicChangeKinds } from "../../inputs/change/PublicChangeKinds.mjs";
import { isACodeLine } from "../../inputs/source/SourceText.mjs";
import { findDriver } from "../../inputs/source/drivers/LanguageRegistry.mjs";
import { Scale } from "../../graph/abstractions/Scale.mjs";
import { readFolderPath } from "../../../files/paths.mjs";
import { findDeployableFolder } from "../abstractions/application/generic/ApplicationFolders.mjs";

const SCALES_WITH_A_KIND = new Set([Scale.CLASS.name, Scale.METHOD.name, Scale.VARIABLE.name]);

const SCALES_OF_A_HEAD = new Set([Scale.CLASS.name, Scale.METHOD.name]);

const BLOCK_BOUND = "\n";

const NO_DECLARATIONS = Object.freeze([]);

const NO_LINE_FORMS = new Set();

const readTheLineForms = blocks => new Set(blocks.flatMap(block => block.split(BLOCK_BOUND)).filter(Boolean));

const joinAsABlock = forms => `${BLOCK_BOUND}${forms.join(BLOCK_BOUND)}${BLOCK_BOUND}`;

const liesInsideTheSpan = (removedLine, span, isTheHeadAdded) => (span.from < removedLine.line && removedLine.line <= span.to)
  || (removedLine.line === span.from && isTheHeadAdded);

const listTheFoldersOfTheFile = file => [file.path, ...(file.status === FILE_STATUS.RENAMED && file.oldPath ? [file.oldPath] : [])].map(readFolderPath);

const changesTheFilesOfItsFolder = file => file.status !== FILE_STATUS.CHANGED;

const combineTheKinds = kinds => (new Set(kinds).size === 1 ? kinds[0] : PUBLIC_CHANGE_KINDS.MODIFIED);

const readKindOfTheEnclosingAbstraction = parent => (parent && parent.publicChangeKind && parent.publicChangeKind !== PUBLIC_CHANGE_KINDS.UNCHANGED ? parent.publicChangeKind : PUBLIC_CHANGE_KINDS.MODIFIED);

const KIND_OF_A_LOCAL_BY_THE_KIND_OF_ITS_METHOD_MAP = Object.freeze({
  [PUBLIC_CHANGE_KINDS.CREATED]: PUBLIC_CHANGE_KINDS.CREATED,
  [PUBLIC_CHANGE_KINDS.MOVED]: PUBLIC_CHANGE_KINDS.MOVED,
  [PUBLIC_CHANGE_KINDS.UNCHANGED]: PUBLIC_CHANGE_KINDS.UNCHANGED,
  [PUBLIC_CHANGE_KINDS.MODIFIED]: PUBLIC_CHANGE_KINDS.CREATED,
});

class FileOfTheChange {
  constructor(file) {
    this.file = file;
    this.driver = findDriver(file.path);
    this.addedTextByLineMap = new Map(file.hunks.flatMap(hunk => hunk.numberedAddedLines).map(({ line, text }) => [line, text]));
    this.shownTextByLineMap = new Map(file.hunks.flatMap(hunk => hunk.newLines).map(({ line, text }) => [line, text]));
  }

  get isMoved() {
    return this.file.status === FILE_STATUS.RENAMED;
  }

  readTextAt(line) {
    if (this.file.lines) return this.file.lines[line - 1] ?? null;
    return this.shownTextByLineMap.has(line) ? this.shownTextByLineMap.get(line) : null;
  }

  isAdded(line) {
    return this.addedTextByLineMap.has(line);
  }

  listCodeLinesWithin(span) {
    const codeLines = [];
    for (let line = span.from; line <= span.to; line++) {
      const text = this.readTextAt(line);
      if (text !== null && isACodeLine(text)) codeLines.push({ line, text, added: this.isAdded(line) });
    }
    return codeLines;
  }

  listTheEditsWithin(span) {
    const isTheHeadAdded = this.isAdded(span.from);
    return this.file.hunks.map(hunk => ({
      added: hunk.numberedAddedLines.filter(({ line }) => span.from <= line && line <= span.to).map(({ text }) => text),
      removed: hunk.findNumberedRemovedLinesWithin(span.from, span.to + 1).filter(removedLine => liesInsideTheSpan(removedLine, span, isTheHeadAdded)).map(({ text }) => text),
    })).filter(edit => edit.added.length || edit.removed.length);
  }

  listTheEditsOfTheFile() {
    return this.file.hunks.map(hunk => ({ added: hunk.addedLines, removed: hunk.removedLines }));
  }
}

export class PublicChangeKindReading {
  constructor(change, { roots = [], readDeclarationsOf = () => null, kindBase = null } = {}) {
    this.files = change.namesWholeFiles ? [] : change.files;
    this.roots = roots;
    this.kindBase = kindBase;
    this.createdFolders = CreatedFolders.createFromChange(change);
    this.filesOfTheChangeByPathMap = new Map(this.files.filter(file => file.existsAfterTheChange).map(file => [file.path, new FileOfTheChange(file)]));
    this.declarationsByPathMap = new Map([...this.filesOfTheChangeByPathMap.keys()].map(filePath => [filePath, (readDeclarationsOf(filePath) || NO_DECLARATIONS).filter(declaration => declaration.span && SCALES_WITH_A_KIND.has(declaration.scale))]));
    this.renameMap = RenameMap.readFromTheChange(this.files, file => this.listAddedHeadsOf(file));
    this.removedBlocksByPathMap = new Map(this.files.map(file => [file.path, file.hunks.flatMap(hunk => this.readTheRemovedBlocks(hunk.removedLines))]));
    this.removedBlocks = [...this.removedBlocksByPathMap.values()].flat();
    this.removedLineForms = readTheLineForms(this.removedBlocks);
    this.removedLineFormsByPathMap = new Map([...this.removedBlocksByPathMap].map(([filePath, blocks]) => [filePath, readTheLineForms(blocks)]));
  }

  listAddedHeadsOf(file) {
    const fileOfTheChange = this.filesOfTheChangeByPathMap.get(file.path);
    if (!fileOfTheChange) return [];
    return (this.declarationsByPathMap.get(file.path) || [])
      .filter(declaration => SCALES_OF_A_HEAD.has(declaration.scale) && fileOfTheChange.isAdded(declaration.line))
      .map(declaration => ({ name: declaration.name, text: fileOfTheChange.readTextAt(declaration.line) }));
  }

  readTheRemovedBlocks(removedLines) {
    const codeLines = removedLines.filter(line => isACodeLine(line));
    return [joinAsABlock(codeLines.map(readTheComparedForm)), joinAsABlock(codeLines.map(line => readTheComparedForm(this.renameMap.readUnderTheNewNames(line))))];
  }

  isARemovedBlock(forms) {
    if (!this.removedLineForms.has(forms[0])) return false;
    const block = joinAsABlock(forms);
    return this.removedBlocks.some(removedBlock => removedBlock.includes(block));
  }

  wasTheHeadRemovedFromTheFile(filePath, headForm) {
    return (this.removedLineFormsByPathMap.get(filePath) || NO_LINE_FORMS).has(headForm);
  }

  readKindOfAddedCode(filePath, codeLines) {
    const forms = codeLines.map(({ text }) => readTheComparedForm(text));
    if (this.isARemovedBlock(forms)) return PUBLIC_CHANGE_KINDS.MOVED;
    return this.wasTheHeadRemovedFromTheFile(filePath, forms[0]) ? PUBLIC_CHANGE_KINDS.MODIFIED : PUBLIC_CHANGE_KINDS.CREATED;
  }

  holdsAnEdit(fileOfTheChange, edits, span = null) {
    if (span && this.holdsARenamedHead(fileOfTheChange, span)) return true;
    return edits.some(({ added, removed }) => !changesOnlyReferences({ added, removed, renameMap: this.renameMap, driver: fileOfTheChange.driver }));
  }

  holdsARenamedHead(fileOfTheChange, span) {
    return (this.declarationsByPathMap.get(fileOfTheChange.file.path) || [])
      .some(declaration => declaration.line >= span.from && declaration.line <= span.to && fileOfTheChange.isAdded(declaration.line) && this.renameMap.isARenamedDeclaration(declaration.name));
  }

  readKindOfTheSpan(filePath, span) {
    const fileOfTheChange = this.filesOfTheChangeByPathMap.get(filePath);
    if (!fileOfTheChange || !span) return PUBLIC_CHANGE_KINDS.UNCHANGED;
    const codeLines = fileOfTheChange.listCodeLinesWithin(span);
    if (codeLines.length && codeLines.every(codeLine => codeLine.added)) return this.readKindOfAddedCode(filePath, codeLines);
    if (this.holdsAnEdit(fileOfTheChange, fileOfTheChange.listTheEditsWithin(span), span)) return PUBLIC_CHANGE_KINDS.MODIFIED;
    return fileOfTheChange.isMoved ? PUBLIC_CHANGE_KINDS.MOVED : PUBLIC_CHANGE_KINDS.UNCHANGED;
  }

  readKindOfTheFile(filePath) {
    const fileOfTheChange = this.filesOfTheChangeByPathMap.get(filePath);
    if (!fileOfTheChange) return PUBLIC_CHANGE_KINDS.UNCHANGED;
    if (fileOfTheChange.file.status === FILE_STATUS.CREATED) return PUBLIC_CHANGE_KINDS.CREATED;
    if (this.holdsAnEdit(fileOfTheChange, fileOfTheChange.listTheEditsOfTheFile())) return PUBLIC_CHANGE_KINDS.MODIFIED;
    return fileOfTheChange.isMoved ? PUBLIC_CHANGE_KINDS.MOVED : PUBLIC_CHANGE_KINDS.UNCHANGED;
  }

  readKindOfTheFolder(folder) {
    if (this.createdFolders.isCreated(folder)) return PUBLIC_CHANGE_KINDS.CREATED;
    return this.listTheFoldersWhoseFilesChanged().has(folder) ? PUBLIC_CHANGE_KINDS.MODIFIED : PUBLIC_CHANGE_KINDS.UNCHANGED;
  }

  listTheFoldersWhoseFilesChanged() {
    if (!this.foldersWhoseFilesChanged) {
      const folders = this.files.filter(changesTheFilesOfItsFolder).flatMap(listTheFoldersOfTheFile);
      const joinedByACreatedFolder = folders.filter(folder => this.createdFolders.isCreated(folder)).map(folder => readFolderPath(this.createdFolders.findTopCreated(folder)));
      this.foldersWhoseFilesChanged = new Set([...folders, ...joinedByACreatedFolder]);
    }
    return this.foldersWhoseFilesChanged;
  }

  listTheApplicationsWithAChangedFile() {
    return new Set(this.files.flatMap(listTheFoldersOfTheFile).map(folder => findDeployableFolder(folder, this.roots)).filter(folder => folder !== null));
  }

  readKindOfTheAbstraction(abstraction, parent = null) {
    if (abstraction.scale === Scale.APPLICATION.name) return this.listTheApplicationsWithAChangedFile().has(abstraction.path) ? PUBLIC_CHANGE_KINDS.MODIFIED : PUBLIC_CHANGE_KINDS.UNCHANGED;
    if (abstraction.scale === Scale.MODULE.name) return this.readKindOfTheFolder(abstraction.path);
    if (abstraction.changeKind === CHANGE_KINDS.REMOVED) return readKindOfTheEnclosingAbstraction(parent);
    if (abstraction.changeKind === CHANGE_KINDS.REFERENCE) return this.readKindAtThePlace(abstraction.path, (abstraction.lines || {}).from);
    if (abstraction.scale === Scale.CLASS.name) return this.readKindOfTheClass(abstraction, parent);
    if (abstraction.scale === Scale.VARIABLE.name && parent && parent.scale === Scale.METHOD.name) return KIND_OF_A_LOCAL_BY_THE_KIND_OF_ITS_METHOD_MAP[parent.publicChangeKind] || PUBLIC_CHANGE_KINDS.CREATED;
    if (abstraction.fields) return combineTheKinds(abstraction.fields.map(field => this.readKindOfTheSpan(abstraction.path, field.lines)));
    return this.readKindOfTheSpan(abstraction.path, abstraction.lines);
  }

  readKindOfTheClass(abstraction, parent) {
    const fileOfTheChange = this.filesOfTheChangeByPathMap.get(abstraction.path);
    const standsForTheFile = parent && parent.scale === Scale.MODULE.name && !(fileOfTheChange && fileOfTheChange.driver && fileOfTheChange.driver.fileHoldsTypesOnly);
    return standsForTheFile || !abstraction.lines ? this.readKindOfTheFile(abstraction.path) : this.readKindOfTheSpan(abstraction.path, abstraction.lines);
  }

  readKindAtThePlace(filePath, line) {
    return this.buildPublicChangeKinds().readKindAtThePlace(filePath, line);
  }

  isAMovedMethod(abstraction) {
    return abstraction.scale === Scale.METHOD.name && this.readKindOfTheSpan(abstraction.path, abstraction.lines) === PUBLIC_CHANGE_KINDS.MOVED;
  }

  buildPublicChangeKinds() {
    if (!this.publicChangeKinds) this.publicChangeKinds = new PublicChangeKinds({
      kindBase: this.kindBase,
      renames: this.renameMap.toJSON(),
      applications: [...this.listTheApplicationsWithAChangedFile()].map(folder => ({ path: folder, kind: PUBLIC_CHANGE_KINDS.MODIFIED })),
      folders: this.listTheFoldersWithAKind(),
      files: [...this.filesOfTheChangeByPathMap.keys()].map(filePath => this.buildTheKindsOfTheFile(filePath)),
    });
    return this.publicChangeKinds;
  }

  listTheFoldersWithAKind() {
    return [...this.listTheFoldersWhoseFilesChanged()].map(folder => ({ path: folder, kind: this.readKindOfTheFolder(folder) }));
  }

  buildTheKindsOfTheFile(filePath) {
    return {
      path: filePath,
      kind: this.readKindOfTheFile(filePath),
      declarations: (this.declarationsByPathMap.get(filePath) || []).map(declaration => ({
        scale: declaration.scale,
        name: declaration.name,
        from: declaration.span.from,
        to: declaration.span.to,
        kind: this.readKindOfTheSpan(filePath, declaration.span),
      })),
    };
  }
}
