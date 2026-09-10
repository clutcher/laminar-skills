import { parseAliasedNames } from "../imports/ImportNames.mjs";
import { readImportConventions, findModuleRelationFinder } from "../../../../finders/LanguageStrategies.mjs";
import { MODULE_FINDER_REGISTRY } from "../../index.mjs";
import { FinderContext } from "../../../../finders/FinderContext.mjs";
import { createCodeLines } from "../../../../../inputs/source/text/CodeLines.mjs";
import { countOpened } from "../../../../../inputs/source/text/Brackets.mjs";
import { findDriver } from "../../../../../inputs/source/drivers/LanguageRegistry.mjs";
import { readFolderPath } from "../../../../../../files/paths.mjs";
import { escapeForAPattern } from "../../../../../inputs/source/text/PatternText.mjs";
import { findFirstFoundAnswer } from "../../../../finders/StrategyAnswers.mjs";

const readersByLanguageMap = new Map();

const findReadersSpeaking = diffDriver => {
  if (!readersByLanguageMap.has(diffDriver)) {
    const context = FinderContext.createForLanguage(diffDriver);
    readersByLanguageMap.set(diffDriver, MODULE_FINDER_REGISTRY.relationFinders.filter(finder => context.speaks(finder)));
  }
  return readersByLanguageMap.get(diffDriver);
};

export const IMPORT_LINE_PATTERN = /^\s*(?:import|from|using|require|use|#include|package|library)\b|\brequire\s*\(|^\s*const\s+\{?[^=]*=\s*require/;

const QUOTED_TEXT_PATTERN = /(["'`])(?:\\.|(?!\1).)*\1/g;

const IMPORT_STATEMENT_START_PATTERN = /^\s*(?:import|from|use|using|pub\s+use)\b|\brequire\s*\(/;

const MAX_IMPORT_STATEMENT_LINES = 40;

function parseImportedPathsOfStatement(text, diffDriver) {
  const found = [];
  const add = (word, full, container, bySpecifier = false) => { if (word && word !== "*") found.push([word, { full, container, bySpecifier }]); };
  for (const reader of findReadersSpeaking(diffDriver)) if (reader.readsAnImportStatement(text, add)) return found;
  return found;
}

const PARENTHESES_AND_BRACES = "({";

const isOpenAfter = text => countOpened(text, PARENTHESES_AND_BRACES) > 0;

const readImportStatementFrom = (lines, first) => {
  let text = lines[first];
  let last = first;
  while (isOpenAfter(text) && last + 1 < lines.length && last - first < MAX_IMPORT_STATEMENT_LINES) text += ` ${lines[++last]}`;
  return { text, last };
};

const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]*/g;

const findDottedImport = (text, diffDriver, readers) => (readImportConventions(diffDriver).importsBindNoDottedName ? null : findFirstFoundAnswer(readers, reader => reader.findDottedImport(text)));

const readWordsOfAnUnreadImportLine = (text, diffDriver, readers) => {
  const withoutStrings = text.replace(QUOTED_TEXT_PATTERN, " ");
  const dotted = findDottedImport(withoutStrings, diffDriver, readers);
  if (dotted) return dotted.word ? [dotted.word] : [];
  return [...withoutStrings.matchAll(IDENTIFIER_PATTERN)].map(found => found[0]);
};

export class SourceFile {
  constructor(filePath, lines, declarations) {
    this.path = filePath;
    this.folder = readFolderPath(filePath);
    this.driver = findDriver(filePath);
    this.diffDriver = this.driver ? this.driver.diffDriver : "";
    this.raw = lines;
    const read = createCodeLines(lines, filePath);
    this.code = read.code;
    this.chainHeads = read.chainHeads;
    this.declarations = declarations;
    this.importedWords = null;
    this.importedPathsByWordMap = new Map();
    this.importPathsByWordMap = null;
    this.reExports = null;
  }

  imports(word) {
    if (!this.importedWords) this.readImports();
    return this.importedWords.has(word) || Boolean(this.findImport(word));
  }

  readWildcardImports() {
    if (!this.wildcards) {
      this.wildcards = this.raw.map(text => findFirstFoundAnswer(findReadersSpeaking(this.diffDriver), reader => reader.findWildcardImport(text))).filter(Boolean)
        .map(container => ({ full: container, container, bySpecifier: false }));
    }
    return this.wildcards;
  }

  findNamedReExport(word) {
    if (!this.reExports) this.readReExports();
    return this.reExports.reExportsByAliasMap.get(word) || null;
  }

  readStarExports() {
    if (!this.reExports) this.readReExports();
    return this.reExports.star;
  }

  readReExports() {
    this.reExports = { reExportsByAliasMap: new Map(), star: [] };
    for (const text of this.raw) {
      const found = findFirstFoundAnswer(findReadersSpeaking(this.diffDriver), reader => reader.findReExport(text));
      if (!found) continue;
      const { clause, from } = found;
      if (clause === "*") { this.reExports.star.push({ full: from, container: from, bySpecifier: true }); continue; }
      for (const { name, alias } of parseAliasedNames(clause.slice(1, -1), /\s+as\s+/)) this.reExports.reExportsByAliasMap.set(alias, { full: `${from}.${name}`, container: from, bySpecifier: true });
    }
  }

  readDefaultExport() {
    if (this.defaultExportRead === undefined) {
      this.defaultExportRead = this.code.map(text => findFirstFoundAnswer(findReadersSpeaking(this.diffDriver), reader => reader.findDefaultExport(text))).find(Boolean) || null;
    }
    return this.defaultExportRead;
  }

  readImportedPath(word) {
    if (!this.importedWords) this.readImports();
    return this.importedPathsByWordMap.get(word) || "";
  }

  findImport(word) {
    if (!this.importPathsByWordMap) this.readImportPaths();
    return this.importPathsByWordMap.get(word) || null;
  }

  readImportPaths() {
    if (!this.importedWords) this.readImports();
    this.importPathsByWordMap = new Map([...this.importedPathsByWordMap].map(([word, full]) => [word, { full, container: full, bySpecifier: false }]));
    for (let index = 0; index < this.raw.length; index++) {
      if (!IMPORT_STATEMENT_START_PATTERN.test(this.raw[index])) continue;
      const { text, last } = readImportStatementFrom(this.raw, index);
      for (const [word, importedPath] of parseImportedPathsOfStatement(text, this.diffDriver)) if (!this.importPathsByWordMap.has(word)) this.importPathsByWordMap.set(word, importedPath);
      index = last;
    }
  }

  readImports() {
    this.importedWords = new Set();
    let openBlock = null;
    const readers = findReadersSpeaking(this.diffDriver);
    for (const text of this.raw) {
      const opening = readers.find(reader => reader.opensAnImportBlock(text));
      if (opening) { openBlock = opening; continue; }
      if (openBlock && openBlock.closesAnImportBlock(text)) { openBlock = null; continue; }
      const imported = findFirstFoundAnswer(readers, reader => reader.findImportedPath(text, openBlock === reader));
      if (imported) {
        this.importedWords.add(imported.word);
        this.importedPathsByWordMap.set(imported.word, imported.path);
        continue;
      }
      if (!IMPORT_LINE_PATTERN.test(text)) continue;
      for (const word of readWordsOfAnUnreadImportLine(text, this.diffDriver, readers)) this.importedWords.add(word);
    }
  }
}

const mentionsTheBareName = (text, name) => new RegExp(`(^|[^\\w$.])${escapeForAPattern(name)}($|[^\\w$])`).test(text);

export const findNestedImport = (line, diffDriver) => findModuleRelationFinder(diffDriver).findNestedImport(line);

const listChangedLines = (changedFile, driver) => changedFile.hunks
  .flatMap(hunk => hunk.numberedAddedLines)
  .filter(({ text }) => text.trim() && !driver.isImportLine(text));

export function readReferenceFormsOf(changedFile, driver) {
  if (!driver) return [];
  const bindingsByBareNameMap = new Map();
  for (const { text, line } of changedFile.readNumberedNewLines()) {
    const read = findNestedImport(text, driver.diffDriver);
    if (read && !bindingsByBareNameMap.has(read.bare)) bindingsByBareNameMap.set(read.bare, { ...read, line, text: text.trim() });
  }
  const changed = listChangedLines(changedFile, driver);
  const forms = [];
  for (const [bare, binding] of bindingsByBareNameMap) {
    const uses = changed.filter(({ text, line }) => line !== binding.line && mentionsTheBareName(text, bare));
    if (!uses.length) continue;
    forms.push({
      enclosing: binding.enclosing,
      bare,
      lines: [{ line: binding.line, text: binding.text }, ...uses.map(use => ({ line: use.line, text: use.text.trim() }))],
    });
  }
  return forms;
}
