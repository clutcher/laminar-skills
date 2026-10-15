import { FILE_STATUS } from "./Hunk.mjs";
import { holdsCode } from "../source/SourceText.mjs";
import { Scale } from "../../graph/abstractions/Scale.mjs";
import { isTrivialHunk } from "./TrivialHunks.mjs";
import { CHANGE_EVENTS, readMemberCreationEvent } from "./AbstractionChange.mjs";
import { isTestPath } from "../source/TestCode.mjs";
import { findInnermostHolding, doesSpanHoldLine } from "../../graph/abstractions/Place.mjs";
import { ANNOTATION_START_PATTERN } from "../source/lines/Annotations.mjs";
import { isANamedPlaceScale } from "../../graph/abstractions/Scale.mjs";
import { DeclarationTags } from "./DeclarationTags.mjs";
import { LINE_BEFORE_A_DECLARATION_PATTERN } from "../source/declarations/DeclarationSpans.mjs";
import { measureHeadIndent as indentOf } from "../source/SourceText.mjs";
import { buildWholeWordPattern } from "../source/text/PatternText.mjs";
import { findIndexWhereTheParenthesesBalance, NOT_BALANCED, countOpened, ONLY_PARENTHESES } from "../source/text/Brackets.mjs";

const BLOCK_END_PATTERN = /^\s*[};]/;

const MAX_ANNOTATION_LINES = 10;

const NOT_REBORN = false;

const MAX_HEAD_LINES = 40;

const BLOCK_OPENER_ALONE_PATTERN = /^\s*\{\s*$/;

const holdsTheName = (text, name) => buildWholeWordPattern(name).test(text);

const LIST_SEPARATOR_AT_THE_END_PATTERN = /\s*,\s*$/;

const readWithoutTheListSeparator = text => text.replace(LIST_SEPARATOR_AT_THE_END_PATTERN, "").trim();

const onlyItsListSeparatorChanged = (hunk, component) => hunk.removedLines.some(text => readWithoutTheListSeparator(text) === readWithoutTheListSeparator(component.text));

const opensAComponentListOnItsHead = classDeclaration => countOpened(String(classDeclaration.text || ""), ONLY_PARENTHESES) > 0;

const holdsAddedLinesBelowTheHead = (hunk, classDeclaration) => {
  const firstAddedLine = hunk.changedLineBounds.from;
  return opensAComponentListOnItsHead(classDeclaration) && !hunk.findAddedLineAt(classDeclaration.line)
    && classDeclaration.line < firstAddedLine && firstAddedLine - classDeclaration.line < MAX_HEAD_LINES;
};

function findFirstBodyIndent(numberedLines, headLine) {
  const below = numberedLines.find(numberedLine => numberedLine.line > headLine && numberedLine.text.trim() && !BLOCK_OPENER_ALONE_PATTERN.test(numberedLine.text));
  return below ? indentOf(below.text) : null;
}

const findAddedLinesNotAmongTheRemoved = hunk => {
  const removedTexts = new Set(hunk.removedLines.map(text => text.trim()));
  return hunk.numberedAddedLines.filter(({ text }) => !removedTexts.has(text.trim()));
};

function findAnnotationBlockAbove(hunk, start) {
  let balance = 0;
  const floor = Math.max(hunk.newStart, start - MAX_ANNOTATION_LINES);
  for (let number = start - 1; number >= floor; number--) {
    const above = hunk.findAddedLineAt(number);
    if (!above || BLOCK_END_PATTERN.test(above.text)) return null;
    balance += countOpened(above.text);
    if (ANNOTATION_START_PATTERN.test(above.text) && balance >= 0) return number;
  }
  return null;
}

function readHeadStart(hunk, line) {
  let start = line;
  for (;;) {
    const above = hunk.findAddedLineAt(start - 1);
    if (above && LINE_BEFORE_A_DECLARATION_PATTERN.test(above.text)) { start--; continue; }
    const block = findAnnotationBlockAbove(hunk, start);
    if (block === null) return start;
    start = block;
  }
}

const joinChangedSpans = (first, second) => ({
  context: first.context,
  from: Math.min(first.from, second.from),
  to: Math.max(first.to, second.to),
  firstChangedLine: Math.min(first.firstChangedLine, second.firstChangedLine),
  lines: [...first.lines, ...second.lines],
  removedCode: first.removedCode || second.removedCode,
});

function createChangedSpan(hunk, from, to) {
  const end = Math.max(from, to);
  const added = hunk.numberedAddedLines.filter(numberedAddedLine => numberedAddedLine.line >= from && numberedAddedLine.line <= end);
  const holdsCodeOf = numberedLine => holdsCode([numberedLine.text]);
  const firstChanged = added.find(holdsCodeOf) || hunk.findNumberedRemovedLinesWithin(from, end).find(holdsCodeOf) || added[0];
  return {
    context: hunk.context,
    from,
    to: end,
    firstChangedLine: firstChanged ? firstChanged.line : from,
    lines: hunk.findAddedLinesWithin(from, end),
    removedCode: holdsCode(hunk.removedLines),
  };
}

function findGapsBetween(hunk, regions) {
  const gaps = [];
  let from = hunk.newStart;
  for (const region of [...regions].sort((left, right) => left.from - right.from)) {
    if (region.from > from) gaps.push({ from, to: region.from - 1 });
    from = Math.max(from, region.to + 1);
  }
  if (from <= hunk.lastLine) gaps.push({ from, to: hunk.lastLine });
  return gaps;
}

const NO_RENAME = Object.freeze({ tag: null, oldName: null });

const measureDistanceBetween = (tag, removed) => Math.abs(tag.line - removed.beforeNewLine);

const isAnUnpairedTagNamedLike = (removed, paired) => tag => tag.name === removed.name && !paired.has(tag);

const chooseNearerTo = removed => (nearest, tag) => (!nearest || measureDistanceBetween(tag, removed) < measureDistanceBetween(nearest, removed) ? tag : nearest);

function findNearestUnpairedTag(covered, removed, paired) {
  const unpairedSameNamedTags = covered.filter(isAnUnpairedTagNamedLike(removed, paired));
  return unpairedSameNamedTags.reduce(chooseNearerTo(removed), null);
}

function createRebornPairing(covered, removedDeclarations) {
  const rebornTags = new Set();
  const unpairedNames = new Set();
  for (const removed of removedDeclarations) {
    const tag = findNearestUnpairedTag(covered, removed, rebornTags);
    if (tag) rebornTags.add(tag);
    else unpairedNames.add(removed.name);
  }
  return { rebornTags, unpairedNames: [...unpairedNames] };
}

function findRenamedDeclaration(covered, pairing) {
  const unpairedNamedPlaceTags = covered.filter(tag => isANamedPlaceScale(tag.scale) && !pairing.rebornTags.has(tag));
  const unpairedRemovedNames = pairing.unpairedNames;
  return unpairedNamedPlaceTags.length === 1 && unpairedRemovedNames.length === 1 ? { tag: unpairedNamedPlaceTags[0], oldName: unpairedRemovedNames[0] } : NO_RENAME;
}

const isACountedDeclaration = read => Boolean(read.scale && read.name) && read.scale !== Scale.VARIABLE.name;

export class ChangeMarker extends DeclarationTags {
  constructor(changedFile, driver, application = "", declarations = null) {
    super(changedFile, driver, application, declarations);
    this.createdTypes = [];
    this.members = [];
    this.changedBodySpans = [];
    this.removedMembers = [];
    this.events = new Set();
    this.trivialHunkCount = 0;
    if (changedFile.isReadableBy(driver)) this.readHunks();
  }

  readRemovedDeclarationNames(hunk) {
    return new Set(this.findRemovedDeclarations(hunk).map(removed => removed.name));
  }

  findRemovedDeclarations(hunk) {
    if (!hunk.removedLines.length) return [];
    const removedTextLines = this.readRemovedTextLines(hunk);
    const isKeptAsText = line => removedTextLines.has(line);
    const removedOldLines = hunk.oldLines.filter(oldLine => oldLine.removed);
    const declarations = [];
    for (const { line, head } of this.readHeads(hunk.removedLines)) {
      if (isKeptAsText(line)) continue;
      const read = this.driver.readDeclaration(hunk.removedLines[line - 1] || head);
      if (isACountedDeclaration(read)) declarations.push({ name: read.name, beforeNewLine: removedOldLines[line - 1].beforeNewLine });
    }
    return declarations;
  }

  readRemovedTextLines(hunk) {
    const oldTextLines = this.driver.findTextLines(hunk.oldLines.map(oldLine => oldLine.text));
    const removed = new Set();
    let number = 0;
    hunk.oldLines.forEach((oldLine, offset) => {
      if (!oldLine.removed) return;
      number++;
      if (oldTextLines.has(offset + 1)) removed.add(number);
    });
    return removed;
  }

  findAddedFieldLines(hunk, declaredRegions = []) {
    return this.findTheAddedClassFields(hunk)
      .filter(field => !field.reborn && !declaredRegions.some(region => doesSpanHoldLine(region, field.addedLine.line)))
      .map(field => field.addedLine.line);
  }

  isAFieldAdded(hunk) {
    return this.findAddedFieldLines(hunk).length > 0;
  }

  isADeclaringHunk(hunk) {
    if (this.tags.some(tag => hunk.findAddedLineAt(tag.line))) return true;
    if (hunk.numberedAddedLines.some(({ line, text }) => !this.source.textLines.has(line) && this.driver.looksLikeDeclaration(text))) return true;
    if (this.readRemovedDeclarationNames(hunk).size) return true;
    return this.isAFieldAdded(hunk);
  }

  readHunks() {
    const created = this.changedFile.status === FILE_STATUS.CREATED;
    for (const hunk of this.changedFile.hunks) {
      if (isTrivialHunk(hunk, this.changedFile, this.driver)) { this.trivialHunkCount++; continue; }
      this.addFieldsOf(hunk);
      const value = this.findNamedValueHolding(hunk.changedLineBounds.from, hunk.changedLineBounds.to);
      if (value) { this.readValueHunk(hunk, value); continue; }
      if (!created && !this.isADeclaringHunk(hunk)) { this.readABodyHunk(hunk); continue; }
      this.readDeclaringHunk(hunk, created);
    }
  }

  readABodyHunk(hunk) {
    this.changedBodySpans.push(...this.createChangedBodySpans(hunk, hunk.newStart, hunk.lastLine));
    this.events.add(CHANGE_EVENTS.BODY_CHANGED);
  }

  addFieldsOf(hunk) {
    this.addComponentsOf(hunk);
    this.addClassFieldsOf(hunk);
    this.addConstructorFieldsOf(hunk);
  }

  addConstructorFieldsOf(hunk) {
    const removedNames = this.readRemovedConstructorFieldNames(hunk);
    for (const constructor of this.findConstructorsOfTheKnownTypes()) {
      for (const field of this.findConstructorFieldsAddedBy(hunk, constructor)) this.addField(hunk, field, removedNames.has(field.name));
    }
  }

  findConstructorsOfTheKnownTypes() {
    return this.tagsOfTheKnownText.filter(tag => Boolean(tag.scope)).filter(tag => this.driver.isAConstructor(tag));
  }

  findConstructorFieldsAddedBy(hunk, constructor) {
    const constructorHead = this.readHeadLinesFrom(hunk, constructor.line).map(headLine => headLine.text).join(" ");
    return this.readFirstDeclaredFields(hunk, constructor)
      .filter(firstDeclaredField => hunk.findAddedLineAt(firstDeclaredField.line) && !this.holdsTheMember(firstDeclaredField))
      .map(field => ({ line: field.line, name: field.name, scope: constructor.scope, text: field.text, end: field.line, constructorHead }));
  }

  holdsTheMember({ line, name }) {
    return this.members.some(member => member.tag.line === line && member.tag.name === name);
  }

  readRemovedConstructorFieldNames(hunk) {
    const removedLines = hunk.removedLines.map((text, index) => ({ line: index + 1, text }));
    return new Set(this.driver.findConstructorFields({ headLines: removedLines, bodyLines: removedLines }).map(field => field.name));
  }

  readFirstDeclaredFields(hunk, constructor) {
    const fields = this.driver.findConstructorFields({ headLines: this.readHeadLinesFrom(hunk, constructor.line), bodyLines: this.findConstructorBodyLines(hunk, constructor) });
    return fields.filter((field, index) => fields.findIndex(other => other.name === field.name) === index);
  }

  addComponentsOf(hunk) {
    this.addComponentsOfAddedHeads(hunk);
    this.addComponentsBelowKeptHeads(hunk);
  }

  addComponentsOfAddedHeads(hunk) {
    for (const classDeclaration of this.tags.filter(tag => tag.scale === Scale.CLASS.name && hunk.findAddedLineAt(tag.line))) {
      const removedComponents = new Set(this.findComponentsRemovedFrom(hunk, classDeclaration));
      for (const component of this.findComponentsDeclaredBy(hunk, classDeclaration)) {
        if (!removedComponents.has(component.name)) this.addField(hunk, { ...component, scope: classDeclaration.name, end: component.line }, NOT_REBORN);
      }
    }
  }

  addComponentsBelowKeptHeads(hunk) {
    for (const classDeclaration of this.tagsOfTheKnownText.filter(tag => tag.scale === Scale.CLASS.name && holdsAddedLinesBelowTheHead(hunk, tag))) {
      const stoodBefore = this.findWhetherTheComponentStoodBefore(hunk, classDeclaration);
      for (const component of this.findComponentsDeclaredBy(hunk, classDeclaration).filter(component => !onlyItsListSeparatorChanged(hunk, component))) {
        this.addField(hunk, { ...component, scope: classDeclaration.name, end: component.line }, stoodBefore(component.name));
      }
    }
  }

  findWhetherTheComponentStoodBefore(hunk, classDeclaration) {
    const keptLines = hunk.oldLines.filter(oldLine => !oldLine.removed);
    const headAt = hunk.oldLines.indexOf(keptLines.find(oldLine => holdsTheName(oldLine.text, classDeclaration.name)));
    if (headAt < 0) return name => hunk.removedLines.some(text => holdsTheName(text, name));
    const componentsBefore = new Set(this.driver.findComponentNames(hunk.oldLines.slice(headAt, headAt + MAX_HEAD_LINES).map(oldLine => oldLine.text).join(" ")));
    return name => componentsBefore.has(name);
  }

  findTheAddedClassFields(hunk) {
    const removedNames = this.readFieldNamesRemovedBy(hunk);
    return findAddedLinesNotAmongTheRemoved(hunk)
      .map(addedLine => ({ addedLine, name: this.findFieldNameAt(addedLine) }))
      .filter(field => field.name)
      .map(field => ({ ...field, enclosingClassName: this.findClassHoldingField(hunk, field.addedLine), reborn: removedNames.has(field.name) }))
      .filter(field => field.enclosingClassName);
  }

  addClassFieldsOf(hunk) {
    for (const { addedLine, name, enclosingClassName, reborn } of this.findTheAddedClassFields(hunk)) {
      this.addField(hunk, { line: addedLine.line, name, scope: enclosingClassName, text: addedLine.text, end: this.source.readValueEndAt(addedLine.line) }, reborn);
    }
  }

  readFieldNamesRemovedBy(hunk) {
    return new Set(hunk.removedLines.map(text => this.driver.findFieldName(text)).filter(Boolean));
  }

  findComponentsRemovedFrom(hunk, classDeclaration) {
    const head = hunk.removedLines.findIndex(text => holdsTheName(text, classDeclaration.name));
    return head < 0 ? [] : this.driver.findComponentNames(hunk.removedLines.slice(head, head + MAX_HEAD_LINES).join(" "));
  }

  findFieldNameAt({ line, text }) {
    if (this.source.textLines.has(line) || this.tags.some(tag => tag.line === line && !tag.readAsAField)) return null;
    return this.driver.findFieldName(text);
  }

  addField(hunk, { line, name, scope, text, end, constructorHead = "" }, reborn) {
    const indent = indentOf(text);
    const span = { from: line, to: Math.max(line, end) };
    const tag = { line, scale: Scale.VARIABLE.name, name, scope, indent, text, span, constructorHead };
    const isExposed = !isTestPath(this.changedFile.path) && !this.driver.isPrivate(text, name, indent);
    this.members.push({ tag, changedSpan: createChangedSpan(hunk, span.from, span.to), reborn, isExposed });
  }

  findClassHoldingField(hunk, addedLine) {
    const enclosingDeclaration = this.changedFile.readTheKnownText(() => this.findPlaceAndMemberIndentInFile(addedLine.line), () => this.findPlaceAndMemberIndentShown(hunk, addedLine.line));
    if (!enclosingDeclaration || this.driver.readDeclaration(enclosingDeclaration.text).scale !== Scale.CLASS.name) return null;
    return enclosingDeclaration.memberIndent === indentOf(addedLine.text) ? enclosingDeclaration.typeName : null;
  }

  findPlaceAndMemberIndentInFile(line) {
    const place = this.findNamedPlaceHoldingInFile(line);
    return place ? { text: place.text, memberIndent: this.findMemberIndentInFileBelow(place), typeName: place.holdsMembersOfTheEnclosingType ? place.scope : this.driver.readDeclaration(place.text).name } : null;
  }

  findTheTypeNameItsMembersTake(shown) {
    let head = shown;
    while (head && this.driver.readDeclaration(head.text).holdsMembersOfTheEnclosingType) head = head.around;
    return head ? this.driver.readDeclaration(head.text).name : this.chooseEnclosingTypeName(null, shown.line);
  }

  findNamedPlaceHoldingInFile(line) {
    if (!this.namedPlaceSpans) this.namedPlaceSpans = this.namedPlaceTags.map(tag => ({ tag, span: this.readSpan(tag) }));
    const enclosingDeclaration = findInnermostHolding(this.namedPlaceSpans.filter(({ tag }) => tag.line < line), line, ({ span }) => span);
    return enclosingDeclaration ? enclosingDeclaration.tag : null;
  }

  findMemberIndentInFileBelow(place) {
    return findFirstBodyIndent(this.changedFile.numberedText, place.line);
  }

  findPlaceAndMemberIndentShown(hunk, line) {
    const shown = this.findShownHeadHolding(line);
    if (shown) return { text: shown.text, memberIndent: findFirstBodyIndent(hunk.newLines, shown.line), typeName: this.findTheTypeNameItsMembersTake(shown) };
    const shownHeadIndents = this.readIndentsOfDeclarationHeadsShownIn(hunk);
    return shownHeadIndents.length ? { text: hunk.context, memberIndent: Math.min(...shownHeadIndents), typeName: this.driver.readDeclaration(hunk.context).name } : null;
  }

  readIndentsOfDeclarationHeadsShownIn(hunk) {
    return hunk.newLines
      .filter(newLine => this.opensANamedPlace(newLine.line, newLine.text))
      .map(newLine => indentOf(newLine.text));
  }

  findConstructorBodyLines(hunk, constructor) {
    const span = this.readSpan(constructor);
    return this.changedFile.readNumberedLinesAround(hunk).filter(numberedLine => numberedLine.line >= span.from && numberedLine.line <= span.to);
  }

  findComponentsDeclaredBy(hunk, classDeclaration) {
    const headLines = this.readHeadLinesFrom(hunk, classDeclaration.line);
    const names = this.driver.findComponentNames(headLines.map(headLine => headLine.text).join(" "));
    return names
      .map(name => ({ name, headLine: headLines.find(headLine => holdsTheName(headLine.text, name)) }))
      .filter(({ headLine }) => headLine && hunk.findAddedLineAt(headLine.line))
      .map(({ name, headLine }) => ({ name, line: headLine.line, text: headLine.text }));
  }

  readHeadLinesFrom(hunk, line) {
    const shown = this.changedFile.readNumberedLinesAround(hunk);
    const from = shown.findIndex(shownLine => shownLine.line === line);
    const window = shown.slice(from, from + MAX_HEAD_LINES);
    const balancedAt = findIndexWhereTheParenthesesBalance(window.map(shownLine => shownLine.text));
    return balancedAt === NOT_BALANCED ? window : window.slice(0, balancedAt + 1);
  }

  createChangedBodySpans(hunk, from, to) {
    const starts = hunk.numberedAddedLines
      .filter(numberedAddedLine => numberedAddedLine.line >= from && numberedAddedLine.line <= to && holdsCode([numberedAddedLine.text]))
      .map(numberedAddedLine => ({ line: numberedAddedLine.line, head: this.readHeadHolding(hunk.context, numberedAddedLine.line) }))
      .filter((lineWithHead, index, all) => index === 0 || lineWithHead.head !== all[index - 1].head)
      .map(lineWithHead => lineWithHead.line);
    if (!starts.length) return [createChangedSpan(hunk, from, to)];
    starts[0] = from;
    return starts.map((start, index) => createChangedSpan(hunk, start, index + 1 < starts.length ? starts[index + 1] - 1 : to));
  }

  readValueHunk(hunk, value) {
    const changedSpan = createChangedSpan(hunk, hunk.newStart, hunk.lastLine);
    this.events.add(CHANGE_EVENTS.BODY_CHANGED);
    const changed = this.members.find(member => member.tag === value);
    if (changed) { changed.changedSpan = joinChangedSpans(changed.changedSpan, changedSpan); return; }
    const isExposed = !isTestPath(this.changedFile.path) && !this.driver.isPrivate(value.text, value.name, value.indent);
    this.members.push({ tag: value, changedSpan, reborn: true, isExposed });
  }

  countsAsADeclaration(tag) {
    return tag.scale !== Scale.VARIABLE.name || this.isANamedValue(tag) || Boolean(this.driver.fileHoldsTypesOnly);
  }

  findDeclarationsAddedIn(hunk) {
    return this.tags
      .filter(tag => hunk.findAddedLineAt(tag.line) && this.countsAsADeclaration(tag))
      .sort((left, right) => left.line - right.line);
  }

  readDeclaringHunk(hunk, created) {
    const covered = this.findDeclarationsAddedIn(hunk);
    const removedDeclarations = this.findRemovedDeclarations(hunk);
    const removedNames = new Set(removedDeclarations.map(removed => removed.name));
    const pairing = createRebornPairing(covered, removedDeclarations);
    const renamed = findRenamedDeclaration(covered, pairing);
    const declaredRegions = this.readDeclaredRegions(hunk, covered);
    covered.forEach((tag, index) => {
      const changedSpan = createChangedSpan(hunk, declaredRegions[index].from, declaredRegions[index].to);
      const reborn = pairing.rebornTags.has(tag) || tag === renamed.tag;
      if (tag.scale === Scale.CLASS.name) {
        this.createdTypes.push({ tag, changedSpan, reborn });
        this.events.add(reborn ? CHANGE_EVENTS.SIGNATURE_CHANGED : CHANGE_EVENTS.TYPE_CREATED);
        return;
      }
      const isExposed = !isTestPath(this.changedFile.path) && !this.driver.isPrivate(tag.text, tag.name, tag.indent);
      this.members.push({ tag, changedSpan, reborn, isExposed });
      this.events.add(readMemberCreationEvent(isExposed, reborn));
    });
    for (const name of pairing.unpairedNames) {
      if (name === renamed.oldName) continue;
      this.removedMembers.push(name);
      this.events.add(CHANGE_EVENTS.MEMBER_REMOVED);
    }
    const fieldLines = this.findAddedFieldLines(hunk, declaredRegions).map(line => ({ from: line, to: line }));
    if (fieldLines.length) this.events.add(CHANGE_EVENTS.FIELD_ADDED);
    if (!created || !covered.length) this.readBodyChangesOutside(hunk, [...declaredRegions, ...fieldLines], removedNames);
  }

  readDeclaredRegions(hunk, covered) {
    const heads = covered.map(tag => readHeadStart(hunk, tag.line));
    return covered.map((tag, index) => {
      const nextHead = index + 1 < heads.length ? heads[index + 1] - 1 : hunk.lastLine;
      return { from: heads[index], to: Math.min(this.readSpan(tag).to, nextHead) };
    });
  }

  readBodyChangesOutside(hunk, regions, removedNames) {
    for (const gap of findGapsBetween(hunk, regions)) {
      const removedCode = !removedNames.size && holdsCode(hunk.findRemovedLinesWithin(gap.from, gap.to));
      if (!removedCode && !holdsCode(hunk.findAddedLinesWithin(gap.from, gap.to))) continue;
      this.changedBodySpans.push(...this.createChangedBodySpans(hunk, gap.from, gap.to));
      this.events.add(CHANGE_EVENTS.BODY_CHANGED);
    }
  }
}
