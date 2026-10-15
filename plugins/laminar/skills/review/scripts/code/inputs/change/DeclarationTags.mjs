import { readDeclarationHeadsOfLines } from "../source/declarations/DiffDriverHeads.mjs";
import { createSourceTextOfChangedFile } from "./ChangedFileText.mjs";
import { NO_DECLARATION } from "../source/drivers/LanguageDriver.mjs";
import { Scale } from "../../graph/abstractions/Scale.mjs";
import { readExtension } from "../source/drivers/LanguageRegistry.mjs";
import { findInnermostHolding, doesSpanHoldLine } from "../../graph/abstractions/Place.mjs";
import { readFileClassName, findTheOnlyTopType, findTheTypeThatIsTheFile, isNamedForTheFile } from "../../graph/abstractions/Abstraction.mjs";
import { isANamedPlaceScale } from "../../graph/abstractions/Scale.mjs";
import { readFileStem } from "../../../files/paths.mjs";
import { readDeclarations, readShownDeclarations } from "../../extract/walk/SourceWalk.mjs";
import { measureSpanAmong } from "../source/declarations/DeclarationSpans.mjs";
import { isATopLevelType, isATopLevelVariable, holdsMembersOfItsOwn } from "../source/declarations/SourceHeads.mjs";

const TOP_LEVEL_CLOSER_PATTERN = /^}/;

const findNamedPlacesAmong = tags => tags.filter(tag => isANamedPlaceScale(tag.scale));

export class DeclarationTags {
  constructor(changedFile, driver, application = "", declarations = null) {
    this.changedFile = changedFile;
    this.driver = driver;
    this.application = application;
    this.source = createSourceTextOfChangedFile(changedFile, driver);
    this.tags = declarations || (driver ? readDeclarations(this.source) : []);
    this.shownHeadsByHunkMap = new Map();
  }

  get topTypes() {
    return this.tags.filter(isATopLevelType);
  }

  get typeName() {
    const types = this.changedFile.readTheKnownText(() => this.topTypes, () => this.typeNamesShown.map(name => ({ name })));
    const typeOfTheFile = this.findTheFilesOwnType(types) || types.find(type => isNamedForTheFile(type.name, this.changedFile.path));
    return typeOfTheFile ? typeOfTheFile.name : readFileStem(this.changedFile.path);
  }

  findTheFilesOwnType(types) {
    return this.changedFile.isNamedByTheChange ? findTheTypeThatIsTheFile(this.changedFile.path, types) : findTheOnlyTopType(types);
  }

  get shownTags() {
    if (!this.shownTagsRead) this.shownTagsRead = this.changedFile.readTheKnownText(() => [], () => this.readShownTags());
    return this.shownTagsRead;
  }

  get namedPlaceTags() {
    return findNamedPlacesAmong(this.tags);
  }

  get shownNamedPlaceTags() {
    return findNamedPlacesAmong(this.shownTags);
  }

  get tagsOfTheKnownText() {
    return this.changedFile.readTheKnownText(() => this.tags, () => this.shownTags);
  }

  readShownTags() {
    const { hunks } = this.changedFile;
    const shown = this.source.createWithReadings(hunks.map(hunk => hunk.newLines), hunks.map(hunk => this.findTypesOpenAbove(hunk)));
    return readShownDeclarations(shown);
  }

  findTypesOpenAbove(hunk) {
    const read = this.driver.readDeclaration(hunk.context);
    return read.name && isATopLevelType(read) ? [{ name: read.name, indent: 0 }] : [];
  }

  get typeNamesShown() {
    const shown = [
      ...this.shownTags.filter(isATopLevelType),
      ...this.changedFile.hunks.flatMap(hunk => this.findTypesOpenAbove(hunk)),
    ];
    return [...new Set([...this.topTypes, ...shown].map(type => type.name))];
  }

  findScopeShown(name, line) {
    const shown = this.shownNamedPlaceTags.filter(tag => tag.name === name && tag.line <= line).pop();
    return shown ? shown.scope : null;
  }

  readHeads(lines) {
    return this.driver.findDeclarationHeads(lines) || readDeclarationHeadsOfLines(lines, readExtension(this.changedFile.path));
  }

  isANamedValue(tag) {
    return isATopLevelVariable(tag) || (tag.scale === Scale.VARIABLE.name && tag.holdsTextValue);
  }

  readSpan(tag) {
    return measureSpanAmong(tag, this.tags, this.source);
  }

  findNamedValueHolding(from, to) {
    return this.tags.find(tag => {
      if (!this.isANamedValue(tag) || from <= tag.line) return false;
      const span = this.readSpan(tag);
      return to <= span.to && span.to > span.from && !this.hasAMethodInsideTouching(span, from, to);
    }) || null;
  }

  hasAMethodInsideTouching(span, from, to) {
    return this.tags.some(tag => tag.scale === Scale.METHOD.name && tag.line > span.from && tag.line <= to && this.readSpan(tag).to >= from);
  }

  findInnermostHeadHolding(line) {
    const holding = findInnermostHolding(this.namedPlaceTags.filter(tag => tag.line < line), line, tag => this.readSpan(tag));
    return holding ? holding.text.trim() : "";
  }

  opensANamedPlace(line, text) {
    if (this.source.textLines.has(line) || !this.driver.looksLikeDeclaration(text)) return false;
    return isANamedPlaceScale(this.driver.readDeclaration(text).scale);
  }

  findTypeHeadShownAbove(line) {
    const hunk = this.changedFile.hunks.find(hunk => hunk.covers(line));
    const above = hunk ? hunk.newLines.filter(newLine => newLine.line < line).reverse() : [];
    for (const { text } of above) {
      if (TOP_LEVEL_CLOSER_PATTERN.test(text)) return null;
      if (!this.driver.looksLikeDeclaration(text)) continue;
      const read = this.driver.readDeclaration(text);
      if (read.scale === Scale.CLASS.name) return { name: read.name, text, line: null, lines: null };
    }
    return null;
  }

  findTypeHoldingTheLine(line, context) {
    const tag = findInnermostHolding(this.tags.filter(declarationTag => declarationTag.scale === Scale.CLASS.name && holdsMembersOfItsOwn(declarationTag)), line, declarationTag => this.readSpan(declarationTag));
    if (tag) return { name: tag.name, text: tag.text, line: tag.line, lines: this.readSpan(tag) };
    const shownAbove = this.findTypeHeadShownAbove(line);
    if (shownAbove) return shownAbove;
    const read = context ? this.driver.readDeclaration(context) : NO_DECLARATION;
    return read.scale === Scale.CLASS.name ? { name: read.name, text: context, line: null, lines: null } : null;
  }

  readHeadShownAbove(line) {
    return (this.findShownHeadHolding(line) || {}).text || "";
  }

  findShownHeadHolding(line) {
    const hunk = this.changedFile.hunks.find(hunk => hunk.covers(line));
    return hunk ? this.readRememberedHeadsShownIn(hunk).get(line) || null : null;
  }

  readRememberedHeadsShownIn(hunk) {
    if (!this.shownHeadsByHunkMap.has(hunk)) this.shownHeadsByHunkMap.set(hunk, this.readHeadsShownIn(hunk));
    return this.shownHeadsByHunkMap.get(hunk);
  }

  readHeadsShownIn(hunk) {
    const open = [];
    const headByLineMap = new Map();
    for (const { line, text } of hunk.newLines) {
      while (open.length && open[open.length - 1].end && open[open.length - 1].end < line) open.pop();
      if (open.length) headByLineMap.set(line, open[open.length - 1]);
      if (this.opensANamedPlace(line, text)) open.push({ text: text.trim(), line, end: this.source.blockEndAt(line), around: open[open.length - 1] || null });
    }
    return headByLineMap;
  }

  readHeadHolding(context, line) {
    return this.readHeadShownAbove(line) || context;
  }

  findTheContextHeadOf(changedSpan) {
    const shown = this.readHeadShownAbove(changedSpan.firstChangedLine);
    if (shown) return shown;
    if (!changedSpan.context || !this.changedFile.lines) return changedSpan.context;
    return this.findTheLineHoldingTheContextAbove(changedSpan);
  }

  findTheLineHoldingTheContextAbove(changedSpan) {
    const lines = this.changedFile.lines;
    for (let line = changedSpan.from - 1; line >= 1; line--) {
      if (!lines[line - 1].includes(changedSpan.context)) continue;
      return this.source.cannotHoldADeclarationHeadAt(lines, line - 1, line) ? this.findInnermostHeadHolding(changedSpan.from) : lines[line - 1].trim();
    }
    const atTheStart = String(lines[changedSpan.from - 1] || "");
    return atTheStart.includes(changedSpan.context) ? atTheStart.trim() : this.findInnermostHeadHolding(changedSpan.from);
  }

  findEnclosingDeclaration(changedSpan) {
    const context = this.findTheContextHeadOf(changedSpan);
    const read = context ? this.driver.readDeclaration(context) : { scale: null, name: null };
    if (!read.name) return null;
    const tag = this.findNamedPlaceTagSettling(read, changedSpan.firstChangedLine);
    const scale = tag ? tag.scale : read.scale;
    if (scale !== Scale.METHOD.name && scale !== Scale.CLASS.name) return null;
    return { scale, name: read.name, scope: this.readScopeOfTheEnclosing(read, tag, changedSpan.firstChangedLine), tag };
  }

  readScopeOfTheEnclosing(read, tag, line) {
    if (tag) return tag.scope;
    return read.scope || this.findScopeShown(read.name, line);
  }

  findNamedPlaceTagSettling(read, line) {
    const settlesTheRead = tag => tag.scale === read.scale || read.scale === Scale.VARIABLE.name;
    const settlingTags = this.namedPlaceTags.filter(tag => tag.name === read.name && settlesTheRead(tag) && tag.line <= line);
    return settlingTags.find(tag => doesSpanHoldLine(this.readSpan(tag), line)) || settlingTags[0];
  }

  readTheFilesOwnTypeAndSpan() {
    const tag = this.findTheFilesOwnType(this.topTypes);
    if (!tag) return { tag, span: { from: 1, to: this.changedFile.lastLine }, bodyLines: this.changedFile.lines || [] };
    const span = this.readSpan(tag);
    return { tag, span, bodyLines: this.readLinesOfSpan(span) };
  }

  chooseEnclosingTypeName(scope, line) {
    return scope || this.findEnclosingTypeOfAnUnscopedDeclaration(line);
  }

  findEnclosingTypeOfAnUnscopedDeclaration(line) {
    const filesOwnType = this.findTheFilesOwnType(this.topTypes);
    const typeSpan = filesOwnType ? this.readSpan(filesOwnType) : null;
    if (!typeSpan || !line) return this.typeName;
    if (doesSpanHoldLine(typeSpan, line)) return this.typeName;
    return readFileClassName(this.changedFile.path, this.topTypes.map(type => type.name));
  }

  readLinesOfSpan(span) {
    return this.changedFile.readLinesWithin(span);
  }
}
