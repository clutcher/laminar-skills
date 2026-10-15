import { CHANGE_KINDS, liesInAnotherApplication, findDriver, FILE_STATUS, holdsANonBlankLine, findInnermostHolding, isATypesOnlyFile, liesInTheTypeOutsideItsMethods, Scale, doesSpanHoldLine, VISIBILITIES } from "../../../../code/index.mjs";
import { isAReadIdentifierOccurrence } from "../walks/decisions/SameDecisionWalk.mjs";
import { MAX_CONTEXT_LINES, ReferenceContext } from "../references/ReferenceContext.mjs";
import { ReferenceOrder } from "../references/ReferenceOrder.mjs";
import { SourceRoots } from "./SourceRoots.mjs";
import { FolderChildren } from "./FolderChildren.mjs";
import { FieldTypeHeads } from "./FieldTypeHeads.mjs";
import { FIELD_READING_SECTIONS, FILE_LIST_SECTIONS, formatStoppedLine, isAStoppedLine, findLineNumber, numberLines, formatPlacedSliceLine, findPlaceOfSliceLine } from "../../formats/SliceFormat.mjs";


const buildCallerWindowLines = (abstraction, caller, lines) => [
  `Caller in this file of \`${abstraction.name}\`: ${caller.name ? `\`${caller.name}\` · ` : ""}${caller.from === caller.to ? caller.from : `${caller.from}-${caller.to}`}`,
  ...numberLines(lines.slice(caller.from - 1, caller.to), caller.from),
];

export const SLICE_NEEDS = Object.freeze({
  THE_MEMBER_AND_ITS_TYPE_HEADS: "THE_MEMBER_AND_ITS_TYPE_HEADS",
  THE_MEMBER_AND_ITS_CALLERS_IN_FILE: "THE_MEMBER_AND_ITS_CALLERS_IN_FILE",
  THE_MEMBER_AND_EVERY_REFERENCE: "THE_MEMBER_AND_EVERY_REFERENCE",
  THE_FILE_WHOLE: "THE_FILE_WHOLE",
  THE_REFERENCES_AND_TYPE_HEADS: "THE_REFERENCES_AND_TYPE_HEADS",
  THE_TEST_METHOD_AND_THE_HEADS_UNDER_TEST: "THE_TEST_METHOD_AND_THE_HEADS_UNDER_TEST",
  THE_DECLARING_LINES_AND_THEIR_TYPES: "THE_DECLARING_LINES_AND_THEIR_TYPES",
  THE_DECLARING_LINES_THEIR_TYPES_AND_USES: "THE_DECLARING_LINES_THEIR_TYPES_AND_USES",
  THE_IMPORT_AND_ITS_BARE_USES: "THE_IMPORT_AND_ITS_BARE_USES",
  THE_FILE_LISTS: "THE_FILE_LISTS",
  THE_MODULE_TREE: "THE_MODULE_TREE",
});

const MAX_SLICE_BYTES = 8000;
const MAX_REFERENCE_LINES = 12;
const MAX_TYPE_HEADS = 40;
const MAX_FIELD_TYPE_HEAD_LINES = 24;
const MAX_SHOWN_MEMBER_LINES = 6;
const MAX_SIBLINGS = 40;
const MAX_TREE_LINES = 120;
const MAX_CROSS_MODULE_REFERENCES = 12;
export const MAX_CALLING_METHODS = 3;
export const MAX_CALLING_METHOD_LINES = 12;
export const MAX_CALLED_BODY_LINES = 12;

const listPathsShownAfterTheChange = change => change.files.filter(file => file.existsAfterTheChange).map(file => file.path);

const GONE_KINDS = new Set([CHANGE_KINDS.REMOVED, CHANGE_KINDS.MOVED, CHANGE_KINDS.RENAMED]);

const holdsAModuleRoot = abstraction => Boolean(abstraction.module && abstraction.module.root);

export function needFor(abstraction) {
  if (abstraction.scale === Scale.MODULE.name && holdsAModuleRoot(abstraction)) return SLICE_NEEDS.THE_MODULE_TREE;
  if (abstraction.scale === Scale.MODULE.name || abstraction.scale === Scale.APPLICATION.name) return SLICE_NEEDS.THE_FILE_LISTS;
  if (abstraction.changeKind === CHANGE_KINDS.REFERENCE) return SLICE_NEEDS.THE_IMPORT_AND_ITS_BARE_USES;
  if (GONE_KINDS.has(abstraction.changeKind)) return SLICE_NEEDS.THE_REFERENCES_AND_TYPE_HEADS;
  if (abstraction.scale === Scale.VARIABLE.name) return abstraction.occurrences.length ? SLICE_NEEDS.THE_DECLARING_LINES_THEIR_TYPES_AND_USES : SLICE_NEEDS.THE_DECLARING_LINES_AND_THEIR_TYPES;
  if (abstraction.scale === Scale.CLASS.name) {
    return abstraction.changeKind === CHANGE_KINDS.CREATED ? SLICE_NEEDS.THE_FILE_WHOLE : SLICE_NEEDS.THE_MEMBER_AND_ITS_TYPE_HEADS;
  }
  if (abstraction.isTest) return SLICE_NEEDS.THE_TEST_METHOD_AND_THE_HEADS_UNDER_TEST;
  if (abstraction.changeKind === CHANGE_KINDS.INTERNALS_CHANGED) return SLICE_NEEDS.THE_MEMBER_AND_ITS_TYPE_HEADS;
  if (abstraction.changeKind === CHANGE_KINDS.CREATED && abstraction.visibility === VISIBILITIES.PRIVATE) return SLICE_NEEDS.THE_MEMBER_AND_ITS_CALLERS_IN_FILE;
  return SLICE_NEEDS.THE_MEMBER_AND_EVERY_REFERENCE;
}

const THE_FIELD_READINGS = Object.values(FIELD_READING_SECTIONS);

export const FIELD_TYPE_HEADS = "fieldTypeHeads";

export const MODULE_BOUNDARY_FACT_SECTIONS = Object.freeze({
  MODULE_SHAPE: "moduleShape",
  EXPOSED_DOMAIN_TYPES: "exposedDomainTypes",
  SPI_IMPLEMENTED_INSIDE_APP: "spiImplementedInsideApp",
  APP_IMPORTS_IN_OUT: "appImportsInOut",
  BOUNDARY_CROSSINGS: "boundaryCrossings",
});

const MODULE_BOUNDARY_FACT_SECTION_NAMES = Object.values(MODULE_BOUNDARY_FACT_SECTIONS);

const CHILD_COUNT = "childCount";

const SECTIONS_KEPT_PAST_THE_BUDGET = new Set([...MODULE_BOUNDARY_FACT_SECTION_NAMES, CHILD_COUNT]);

const buildModuleBoundaryFactSections = module => ({
  [MODULE_BOUNDARY_FACT_SECTIONS.MODULE_SHAPE]: module.shape || [],
  [MODULE_BOUNDARY_FACT_SECTIONS.EXPOSED_DOMAIN_TYPES]: module.exposedDomain || [],
  [MODULE_BOUNDARY_FACT_SECTIONS.SPI_IMPLEMENTED_INSIDE_APP]: module.spiImplementedInsideApp || [],
  [MODULE_BOUNDARY_FACT_SECTIONS.APP_IMPORTS_IN_OUT]: module.appImportsInOut || [],
  [MODULE_BOUNDARY_FACT_SECTIONS.BOUNDARY_CROSSINGS]: module.crossings || [],
});

const SECTIONS_BY_NEED_MAP = Object.freeze({
  [SLICE_NEEDS.THE_MEMBER_AND_ITS_TYPE_HEADS]: ["ownLines", "typeHeads", ...THE_FIELD_READINGS, "callingMethods", "calledBodies", FIELD_TYPE_HEADS],
  [SLICE_NEEDS.THE_MEMBER_AND_ITS_CALLERS_IN_FILE]: ["ownLines", "typeHeads", "callersInFile", "callingMethods", "calledBodies"],
  [SLICE_NEEDS.THE_MEMBER_AND_EVERY_REFERENCE]: ["ownLines", "typeHeads", "references", "callingMethods", "calledBodies"],
  [SLICE_NEEDS.THE_FILE_WHOLE]: ["ownLines", ...THE_FIELD_READINGS, "calledBodies", FIELD_TYPE_HEADS],
  [SLICE_NEEDS.THE_REFERENCES_AND_TYPE_HEADS]: ["references", "typeHeads"],
  [SLICE_NEEDS.THE_TEST_METHOD_AND_THE_HEADS_UNDER_TEST]: ["ownLines", "typeHeads", "calledBodies"],
  [SLICE_NEEDS.THE_DECLARING_LINES_AND_THEIR_TYPES]: ["ownLines", "typeHeads", ...THE_FIELD_READINGS],
  [SLICE_NEEDS.THE_DECLARING_LINES_THEIR_TYPES_AND_USES]: ["ownLines", "typeHeads", "references", ...THE_FIELD_READINGS],
  [SLICE_NEEDS.THE_IMPORT_AND_ITS_BARE_USES]: ["ownLines", "typeHeads"],
  [SLICE_NEEDS.THE_FILE_LISTS]: ["moduleRoot", "createdSubfolders", CHILD_COUNT, "fileList", "siblings", ...MODULE_BOUNDARY_FACT_SECTION_NAMES],
  [SLICE_NEEDS.THE_MODULE_TREE]: ["moduleRoot", "createdSubfolders", "declaredBoundary", "verifiedBoundary", CHILD_COUNT, "moduleTree", "crossModuleReferences", ...MODULE_BOUNDARY_FACT_SECTION_NAMES],
});

const CAP_BY_SECTION_MAP = Object.freeze({ typeHeads: MAX_TYPE_HEADS, [FIELD_TYPE_HEADS]: MAX_FIELD_TYPE_HEAD_LINES, references: MAX_REFERENCE_LINES + MAX_CONTEXT_LINES, callersInFile: MAX_REFERENCE_LINES, fileList: MAX_TREE_LINES, siblings: MAX_SIBLINGS, moduleTree: MAX_TREE_LINES, crossModuleReferences: MAX_CROSS_MODULE_REFERENCES });

const measureLines = lines => lines.join("\n").length;

const dropTheStoppedLines = lines => lines.filter(line => !isAStoppedLine(line));

const keepTheFirstLines = (lines, count, wasStopped) => {
  const listedLines = dropTheStoppedLines(lines);
  const kept = listedLines.slice(0, count);
  return wasStopped || kept.length < listedLines.length ? [...kept, formatStoppedLine(kept.length)] : kept;
};

const keepTheLinesThatFit = (section, room) => {
  const fitting = [];
  for (const line of dropTheStoppedLines(section.lines)) {
    if (measureLines([...fitting, line]) > room) break;
    fitting.push(line);
  }
  if (!fitting.length) return { ...section, lines: [] };
  return { ...section, lines: keepTheFirstLines(section.lines, fitting.length, section.lines.some(isAStoppedLine)) };
};

const cutToTheRoomLeft = (section, room) => FILE_LIST_SECTIONS.has(section.section) ? keepTheLinesThatFit(section, room) : { ...section, lines: [] };

function keepWithinBudget(sections) {
  const kept = [];
  let bytes = 0;
  let theBudgetIsSpent = false;
  for (const section of sections) {
    const size = measureLines(section.lines);
    const isKeptPastTheBudget = SECTIONS_KEPT_PAST_THE_BUDGET.has(section.section);
    if (!isKeptPastTheBudget && theBudgetIsSpent) continue;
    if (!isKeptPastTheBudget && bytes + size > MAX_SLICE_BYTES && kept.length) {
      theBudgetIsSpent = true;
      const cut = cutToTheRoomLeft(section, MAX_SLICE_BYTES - bytes);
      if (!cut.lines.length) continue;
      kept.push(cut);
      bytes += measureLines(cut.lines);
      continue;
    }
    kept.push(section);
    bytes += size;
  }
  return { kept, bytes };
}

export function cutTheSlice(abstraction, linesBySection) {
  const need = needFor(abstraction);
  const sections = [];
  for (const name of SECTIONS_BY_NEED_MAP[need]) {
    const lines = linesBySection[name] || [];
    if (!lines.length) continue;
    const cap = CAP_BY_SECTION_MAP[name];
    sections.push({ section: name, lines: cap ? keepTheFirstLines(lines, cap, lines.some(isAStoppedLine)) : lines });
  }
  const { kept, bytes } = keepWithinBudget(sections);
  return { need, sections: kept, bytes };
}

const VERIFIED_BOUNDARY_KIND = "verified";

const listBoundaryLines = (module, kind) => (module.boundaries || [])
  .filter(boundary => boundary.kind === kind)
  .map(boundary => `${boundary.path}:${boundary.line}: ${boundary.text}`);

const buildModuleRootLines = abstraction => {
  const module = abstraction.module;
  if (abstraction.scale !== Scale.MODULE.name || !module) return [];
  if (!module.root) return [`root: none · ${module.reason}`];
  return [`root: ${module.root} · found as: ${module.rootForm} · this folder: ${module.isRoot ? "the root" : "inside the root"}`];
};

const listCreatedSubfolderLines = abstraction => ((abstraction.module || {}).createdSubfolders || [])
  .flatMap(created => [`subfolder: ${created.subfolder}/`, ...created.holds, ...(created.stopped ? [formatStoppedLine(created.holds.length)] : [])]);

const listTreeLines = module => [...(module.tree || []), ...(module.treeStopped ? [formatStoppedLine((module.tree || []).length)] : [])];

const formatChildCountLine = ({ children: childCount, files }) => `children: ${childCount} · files: ${files} · folders: ${childCount - files}`;

const removeOwnLines = (heads, ownLines) => {
  const own = new Set(ownLines.map(findLineNumber).filter(Boolean));
  return heads.filter(head => !own.has(findLineNumber(head)));
};

const NO_LINES = () => null;

const hasChangesInSpan = (file, span) => file.status === FILE_STATUS.CREATED
  || file.hunks.some(hunk => holdsANonBlankLine(hunk.findAddedLinesWithin(span.from, span.to)) || holdsANonBlankLine(hunk.findRemovedLinesWithin(span.from, span.to)));

const readFirstDeclaringLine = abstraction => (abstraction.lines || ((abstraction.fields || [])[0] || {}).lines || {}).from;

const holdsTheAbstraction = (abstraction, { filePath, type }) => {
  const line = readFirstDeclaringLine(abstraction);
  return filePath === abstraction.path && doesSpanHoldLine(type.span, line);
};

const readLineNumbers = numberedLines => numberedLines.map(line => Number(findLineNumber(line))).filter(line => line > 0);

const NO_REFERENCES = Object.freeze({ listCallLinesInFile: () => [], collectNamesAtLines: () => new Set(), listLinesNaming: () => [] });

const NO_DECLARATIONS = () => null;

const NO_CONTEXT = Object.freeze({ chooseContextLines: () => [] });

const NO_ORDER = Object.freeze({ orderPlaces: (abstraction, uses, context) => [...uses, ...context] });

const listHeadLines = (abstraction, ownLines, found, references) => {
  const findIndexOfTheFirstUse = name => ownLines.findIndex(line => references.lines.collectNamesAtLines(abstraction.path, [Number(findLineNumber(line))]).has(name));
  const heads = [...found]
    .sort((left, right) => findIndexOfTheFirstUse(left.type.name) - findIndexOfTheFirstUse(right.type.name))
    .flatMap(({ filePath, type }) => type.heads.map(head => (filePath === abstraction.path ? `${head.line}: ${head.text}` : `${filePath}:${head.line}: ${head.text}`)));
  return removeOwnLines(heads, ownLines);
};

const declaresTheClassAtItsPath = abstraction => abstraction.scale === Scale.CLASS.name && abstraction.changeKind !== CHANGE_KINDS.REFERENCE;

const listNumbersWithinSpan = span => Array.from({ length: Math.max(0, span.to - span.from + 1) }, (_, offset) => span.from + offset);

const isEveryLineKnown = (textByLineMap, span) => listNumbersWithinSpan(span).every(line => textByLineMap.has(line));

const findIndexOfTheFirstCall = (ownLines, callLines) => {
  const calling = new Set(callLines);
  return ownLines.findIndex(line => calling.has(Number(findLineNumber(line))));
};

const selectFirstCalled = callsAt => callsAt
  .filter(({ at }) => at >= 0)
  .sort((left, right) => left.at - right.at)
  .slice(0, MAX_CALLING_METHODS)
  .map(({ method }) => method);

const selectTheHeadsWithin = (reading, span) => reading.tags
  .filter(tag => doesSpanHoldLine(span, tag.line))
  .map(tag => ({ line: tag.line, text: tag.text.trim() }));

const selectMethodsWithinSpan = (reading, span) => reading.tags
  .filter(tag => tag.scale === Scale.METHOD.name && doesSpanHoldLine(span, tag.line))
  .map(tag => ({ name: tag.name, span: reading.readSpan(tag) }));

const selectConstantLinesWithinRoom = (constantSpans, room) => {
  const fitting = [];
  let left = room;
  for (const constantSpan of constantSpans) {
    const constantLines = listNumbersWithinSpan(constantSpan);
    if (constantLines.length > left) continue;
    fitting.push(...constantLines);
    left -= constantLines.length;
  }
  return fitting;
};

const CALLING_SCALES = new Set([Scale.METHOD.name, Scale.CLASS.name]);

export const CALLING_METHODS_SECTION = "callingMethods";

const isShapedByItsCallers = abstraction => abstraction.scale === Scale.METHOD.name
  && (abstraction.visibility === VISIBILITIES.PRIVATE || abstraction.changeKind === CHANGE_KINDS.CREATED);

const buildFileLines = textByLineMap => Array.from({ length: Math.max(0, ...textByLineMap.keys()) }, (_, offset) => textByLineMap.get(offset + 1) ?? "");

const buildCallingWindow = (span, callLine) => {
  const from = Math.max(span.from, callLine - MAX_CALLING_METHOD_LINES + 1);
  return { from, to: Math.min(span.to, from + MAX_CALLING_METHOD_LINES - 1) };
};

const quoteName = name => `\`${name}\``;

const formatLineOfTheOwnFile = (filePath, line, text) => numberLines([text], line)[0];

const formatReferenceLine = place => formatPlacedSliceLine(place.path, place.line, place.text);

const formatPlacedLine = (abstractionPath, filePath) => numberedLine => (filePath === abstractionPath ? numberLines([numberedLine.text], numberedLine.line)[0] : formatPlacedSliceLine(filePath, numberedLine.line, numberedLine.text));

const listSameNameLines = (abstraction, readings) => {
  const holding = readings.filter(reading => reading.otherTypes.length);
  const otherTypes = [...new Map(holding.flatMap(reading => reading.otherTypes).map(other => [`${other.path}:${other.name}`, other])).values()];
  return [
    ...holding.map(reading => `Same name on other types of ${quoteName(reading.name)}: ${[...new Set(reading.otherTypes.map(other => other.name))].map(quoteName).join(", ")}`),
    ...otherTypes.flatMap(other => other.lines.map(formatPlacedLine(abstraction.path, other.path))),
  ];
};

function buildFieldReadingSections(abstraction) {
  return { [FIELD_READING_SECTIONS.SAME_NAME]: listSameNameLines(abstraction, abstraction.fieldReadings || []) };
}

export class SliceBuilder {
  constructor(change, linesOf = NO_LINES, applicationRoots = [], references = NO_REFERENCES, declarationsOf = NO_DECLARATIONS, decisionSearches = undefined, sourceRoots = undefined) {
    this.change = change;
    this.sourceRoots = sourceRoots || SourceRoots.createForTheChange(change, linesOf, applicationRoots);
    this.references = references;
    this.declarationsOf = declarationsOf;
    this.readingsByPathMap = new Map();
    this.readFileLines = linesOf;
    this.applicationRoots = applicationRoots;
    this.linesByPathMap = new Map(change.files.map(file => [file.path, file.lines]));
    this.headsByPathMap = new Map();
    this.typesByPathMap = new Map();
    this.folderChildren = new FolderChildren(change, listPathsShownAfterTheChange(change));
    this.fieldTypeHeads = new FieldTypeHeads(references);
    this.referenceContext = references.graph ? new ReferenceContext(references, change.files.map(file => file.path)) : NO_CONTEXT;
    this.referenceOrder = references.graph ? new ReferenceOrder(references, decisionSearches) : NO_ORDER;
  }

  buildSlice(abstraction) {
    if (abstraction.scale !== Scale.MODULE.name) return this.buildSliceOfAnyScale(abstraction);
    return { ...this.buildSliceOfAnyScale(abstraction), sourceRoot: this.sourceRoots.findSourceRootOf(abstraction.path) };
  }

  buildSliceOfAnyScale(abstraction) {
    if (abstraction.scale === Scale.MODULE.name && holdsAModuleRoot(abstraction)) return this.buildModuleSlice(abstraction);
    if (abstraction.scale === Scale.MODULE.name || abstraction.scale === Scale.APPLICATION.name) {
      return cutTheSlice(abstraction, {
        moduleRoot: buildModuleRootLines(abstraction),
        createdSubfolders: listCreatedSubfolderLines(abstraction),
        ...buildModuleBoundaryFactSections(abstraction.module || {}),
        [CHILD_COUNT]: this.listChildCount(abstraction),
        fileList: this.folderChildren.readFileListOneLevelDeeper(abstraction.path),
        siblings: this.folderChildren.listSiblingsShown(abstraction),
      });
    }
    const lines = this.linesByPathMap.get(abstraction.path);
    const ownLines = abstraction.referenceLines.length ? abstraction.referenceLines : this.listDeclaredLines(abstraction, lines);
    return this.markTheCallingMethodsThatJoinAnotherApplication(abstraction, cutTheSlice(abstraction, {
      ownLines,
      typeHeads: this.chooseTypeHeads(abstraction, ownLines),
      calledBodies: this.listCalledBodies(abstraction, ownLines),
      callersInFile: this.listCallersInFile(abstraction, lines),
      callingMethods: this.listCallingMethods(abstraction, lines),
      references: this.listReferenceLines(abstraction, ownLines),
      ...buildFieldReadingSections(abstraction),
      [FIELD_TYPE_HEADS]: this.fieldTypeHeads.listLines(abstraction),
    }));
  }

  markTheCallingMethodsThatJoinAnotherApplication(abstraction, slice) {
    if (!this.holdsAPlaceInAnotherApplication(abstraction)) return slice;
    return { ...slice, sections: slice.sections.map(section => (section.section === CALLING_METHODS_SECTION ? { ...section, joinsAnotherApplication: true } : section)) };
  }

  listReferenceLines(abstraction, ownLines) {
    const listPlaces = (occurrences, withContext) => occurrences.flatMap(occurrence => occurrence.places.map(place => ({ ...place, withContext })));
    const uses = [...listPlaces(abstraction.occurrences, true), ...listPlaces(abstraction.sameDecisionAt.filter(occurrence => !isAReadIdentifierOccurrence(occurrence)), false)];
    const usesByLineMap = new Map();
    for (const use of uses) {
      const line = formatReferenceLine(use);
      if (!usesByLineMap.has(line) && usesByLineMap.size < MAX_REFERENCE_LINES) usesByLineMap.set(line, use);
    }
    const shownOwnLines = SECTIONS_BY_NEED_MAP[needFor(abstraction)].includes("ownLines") ? readLineNumbers(ownLines) : [];
    const shownUses = [...usesByLineMap.values()];
    const context = this.referenceContext.chooseContextLines(abstraction, shownUses, shownOwnLines);
    return this.referenceOrder.orderPlaces(abstraction, shownUses, context).map(formatReferenceLine);
  }

  buildModuleSlice(abstraction) {
    const module = abstraction.module;
    return cutTheSlice(abstraction, {
      moduleRoot: buildModuleRootLines(abstraction),
      createdSubfolders: listCreatedSubfolderLines(abstraction),
      declaredBoundary: listBoundaryLines(module, "declared"),
      verifiedBoundary: listBoundaryLines(module, VERIFIED_BOUNDARY_KIND),
      ...buildModuleBoundaryFactSections(module),
      [CHILD_COUNT]: this.listChildCount(abstraction),
      moduleTree: listTreeLines(module),
      crossModuleReferences: module.references,
    });
  }

  listDeclaredLines(abstraction, lines) {
    if (abstraction.fields) return abstraction.fields.flatMap(field => this.readLinesWithin(abstraction.path, lines, field.lines, field.changedLines));
    return this.readLinesWithin(abstraction.path, lines, abstraction.lines || { from: 1, to: 1 }, abstraction.changedLines || abstraction.lines);
  }

  readLinesWithin(filePath, lines, span, changedSpan) {
    return lines ? numberLines(lines.slice(span.from - 1, span.to), span.from) : this.listHunkLines(filePath, changedSpan);
  }

  listHunkLines(filePath, span) {
    const file = this.change.files.find(changed => changed.path === filePath);
    if (!file) return [];
    const isWanted = line => !span || doesSpanHoldLine(span, line);
    return file.hunks
      .flatMap(hunk => hunk.numberedAddedLines)
      .filter(({ line }) => isWanted(line))
      .map(({ line, text }) => `${line}: ${text}`);
  }

  findChangedReading(filePath) {
    return this.change.files.some(changed => changed.path === filePath) ? this.findReading(filePath) : null;
  }

  readTypeHeads(filePath) {
    if (this.headsByPathMap.has(filePath)) return this.headsByPathMap.get(filePath);
    const reading = this.findChangedReading(filePath);
    const heads = reading ? reading.tags.map(tag => `${tag.line}: ${tag.text.trim()}`) : [];
    this.headsByPathMap.set(filePath, heads);
    return heads;
  }

  listTypesDeclaredInTheFile(filePath) {
    if (!this.typesByPathMap.has(filePath)) this.typesByPathMap.set(filePath, this.readTypesDeclaredIn(filePath));
    return this.typesByPathMap.get(filePath);
  }

  readTypesDeclaredIn(filePath) {
    const file = this.change.files.find(changed => changed.path === filePath);
    const reading = this.findChangedReading(filePath);
    if (!reading) return [];
    return reading.tags.filter(tag => tag.scale === Scale.CLASS.name).map(tag => {
      const span = reading.readSpan(tag);
      return { name: tag.name, span, changed: hasChangesInSpan(file, span), heads: selectTheHeadsWithin(reading, span) };
    });
  }

  listOtherTypesOnlyFilesOfTheChange(abstraction) {
    return this.change.files.map(file => file.path).filter(filePath => filePath !== abstraction.path && isATypesOnlyFile(filePath));
  }

  listHeadsOfTheTypesUsedInAbstraction(abstraction, ownLines) {
    const found = this.findTypesNamed(abstraction, ownLines, [abstraction.path, ...this.listOtherTypesOnlyFilesOfTheChange(abstraction)])
      .filter(({ type }) => type.name !== abstraction.name);
    return listHeadLines(abstraction, ownLines, found, this.references);
  }

  listHeadsOfTheChangedTypesNamedInAbstraction(abstraction, ownLines) {
    const isOfTheSameKind = filePath => isATypesOnlyFile(filePath) === isATypesOnlyFile(abstraction.path);
    const found = this.findTypesNamed(abstraction, ownLines, [abstraction.path, ...listPathsShownAfterTheChange(this.change).filter(filePath => filePath !== abstraction.path && isOfTheSameKind(filePath))])
      .filter(namedType => namedType.type.changed && !holdsTheAbstraction(abstraction, namedType));
    return listHeadLines(abstraction, ownLines, found, this.references);
  }

  findTypesNamed(abstraction, ownLines, filePaths) {
    const quoteName = this.references.lines.collectNamesAtLines(abstraction.path, readLineNumbers(ownLines));
    return filePaths.flatMap(filePath => this.listTypesDeclaredInTheFile(filePath)
      .filter(type => quoteName.has(type.name))
      .map(type => ({ filePath, type })));
  }

  chooseTypeHeads(abstraction, ownLines) {
    const need = needFor(abstraction);
    if (abstraction.scale === Scale.VARIABLE.name) return this.listHeadsOfTheChangedTypesNamedInAbstraction(abstraction, ownLines);
    if (need === SLICE_NEEDS.THE_TEST_METHOD_AND_THE_HEADS_UNDER_TEST) return this.listHeadsUnderTest(abstraction);
    if (isATypesOnlyFile(abstraction.path)) return this.listHeadsOfTheTypesUsedInAbstraction(abstraction, ownLines);
    const shownOwnLines = SECTIONS_BY_NEED_MAP[need].includes("ownLines") ? ownLines : [];
    const heads = removeOwnLines(this.readTypeHeads(abstraction.path), shownOwnLines);
    return declaresTheClassAtItsPath(abstraction) ? removeOwnLines(this.addShortMemberBodies(abstraction, heads), shownOwnLines) : heads;
  }

  addShortMemberBodies(abstraction, heads) {
    const reading = abstraction.lines ? this.findReading(abstraction.path) : null;
    if (!reading) return heads;
    const textByLineMap = this.readTextByLineMap(abstraction.path);
    const shortMembers = reading.tags
      .filter(tag => tag.scale === Scale.METHOD.name && abstraction.lines.from < tag.line && tag.line <= abstraction.lines.to)
      .map(tag => reading.readSpan(tag))
      .filter(span => span.to - span.from < MAX_SHOWN_MEMBER_LINES && isEveryLineKnown(textByLineMap, span));
    const shown = [...heads];
    for (const span of shortMembers) {
      const bodyLines = listNumbersWithinSpan({ from: span.from + 1, to: span.to }).map(line => `${line}: ${textByLineMap.get(line).trim()}`);
      if (shown.length + bodyLines.length > MAX_TYPE_HEADS) break;
      const headAt = shown.findIndex(head => Number(findLineNumber(head)) === span.from);
      if (headAt < 0) continue;
      shown.splice(headAt + 1, 0, ...bodyLines.filter(line => !shown.includes(line)));
    }
    return shown;
  }

  readTextByLineMap(filePath) {
    const lines = this.linesByPathMap.get(filePath);
    if (lines) return new Map(lines.map((text, offset) => [offset + 1, text]));
    const file = this.change.files.find(changed => changed.path === filePath);
    return new Map((file ? file.hunks.flatMap(hunk => hunk.newLines) : []).map(({ line, text }) => [line, text]));
  }

  findReading(filePath) {
    if (!this.readingsByPathMap.has(filePath)) this.readingsByPathMap.set(filePath, this.readDeclarationsOf(filePath));
    return this.readingsByPathMap.get(filePath);
  }

  readDeclarationsOf(filePath) {
    if (!findDriver(filePath)) return null;
    const file = this.change.files.find(changed => changed.path === filePath);
    if (file) return this.declarationsOf(filePath, { changedFile: file });
    const lines = this.readFileLines(filePath);
    return lines ? this.declarationsOf(filePath, { lines }) : null;
  }

  findTheReadClassUnderTest(abstraction) {
    const underTest = abstraction.classUnderTest;
    const reading = underTest ? this.findReading(underTest.path) : null;
    const classTag = reading ? reading.tags.find(tag => tag.scale === Scale.CLASS.name && tag.name === underTest.name) : null;
    return classTag ? { path: underTest.path, reading, span: reading.readSpan(classTag) } : null;
  }

  listHeadsUnderTest(abstraction) {
    const classUnderTest = this.findTheReadClassUnderTest(abstraction);
    if (!classUnderTest) return [];
    return selectTheHeadsWithin(classUnderTest.reading, classUnderTest.span).map(head => `${classUnderTest.path}:${head.line}: ${head.text}`);
  }

  listCalledBodies(abstraction, ownLines) {
    if (abstraction.isTest) return abstraction.scale === Scale.METHOD.name ? this.listBodiesUnderTest(abstraction, ownLines) : [];
    return CALLING_SCALES.has(abstraction.scale) && abstraction.lines ? this.listBodiesCalledInFile(abstraction, ownLines) : [];
  }

  listBodiesUnderTest(abstraction, ownLines) {
    const classUnderTest = this.findTheReadClassUnderTest(abstraction);
    if (!classUnderTest) return [];
    const { path, reading, span } = classUnderTest;
    const methods = selectMethodsWithinSpan(reading, span);
    const textByLineMap = this.readWholeTextByLineMap(path);
    const constantOf = this.createConstantFinder(path, reading, textByLineMap, span, methods);
    const called = selectFirstCalled(methods.map(method => ({ method, at: findIndexOfTheFirstCall(ownLines, this.references.lines.listCallLinesInFile(abstraction.path, method.name)) })));
    return this.listBodyAndConstantLines(path, called, textByLineMap, constantOf);
  }

  listBodiesCalledInFile(abstraction, ownLines) {
    const reading = this.findReading(abstraction.path);
    if (!reading) return [];
    const driver = findDriver(abstraction.path);
    const textByLineMap = this.readWholeTextByLineMap(abstraction.path);
    const fileSpan = { from: 1, to: Math.max(0, ...textByLineMap.keys()) };
    const classes = reading.tags.filter(tag => tag.scale === Scale.CLASS.name).map(tag => ({ name: tag.name, span: reading.readSpan(tag) }));
    const methodTags = reading.tags.filter(tag => tag.scale === Scale.METHOD.name);
    const methods = methodTags.map(tag => ({ name: tag.name, span: reading.readSpan(tag), tag }));
    const findConstructedClass = method => classes
      .filter(type => doesSpanHoldLine(type.span, method.span.from) && (type.name === method.name || driver.isAConstructor(method.tag)))
      .reduce((innermostClass, type) => (!innermostClass || type.span.from > innermostClass.span.from ? type : innermostClass), null);
    const findFirstCallOfTheMethod = method => {
      const constructed = findConstructedClass(method);
      const calls = [findIndexOfTheFirstCall(ownLines, this.references.lines.listCallLinesInFile(abstraction.path, method.name)), constructed ? findIndexOfTheFirstCall(ownLines, this.references.lines.listCallLinesInFile(abstraction.path, constructed.name)) : -1].filter(at => at >= 0);
      return calls.length ? Math.min(...calls) : -1;
    };
    const liesOutsideTheAbstraction = method => !doesSpanHoldLine(abstraction.lines, method.span.from);
    const constantOf = this.createConstantFinder(abstraction.path, reading, textByLineMap, fileSpan, methods);
    const called = selectFirstCalled(methods.filter(liesOutsideTheAbstraction).map(method => ({ method, at: findFirstCallOfTheMethod(method) })));
    return this.listBodyAndConstantLines(abstraction.path, called, textByLineMap, constantOf, formatLineOfTheOwnFile)
      .filter(line => !doesSpanHoldLine(abstraction.lines, findPlaceOfSliceLine(abstraction.path, line).line));
  }

  listBodyAndConstantLines(filePath, called, textByLineMap, constantOf, formatLine = formatPlacedSliceLine) {
    const shown = new Set();
    for (const method of called) {
      const methodLines = listNumbersWithinSpan(method.span).slice(0, MAX_CALLED_BODY_LINES);
      for (const line of [...this.listConstantLinesReadByTheMethod(filePath, methodLines, constantOf), ...methodLines]) shown.add(line);
    }
    return [...shown].filter(line => textByLineMap.has(line)).sort((left, right) => left - right)
      .map(line => formatLine(filePath, line, textByLineMap.get(line).trim()));
  }

  listConstantLinesReadByTheMethod(filePath, methodLines, constantOf) {
    const read = this.references.lines.collectNamesAtLines(filePath, methodLines);
    return selectConstantLinesWithinRoom([...read].map(constantOf).filter(Boolean), MAX_CALLED_BODY_LINES - methodLines.length);
  }

  createConstantFinder(filePath, reading, textByLineMap, classSpan, methods) {
    const driver = findDriver(filePath);
    const fileLines = buildFileLines(textByLineMap);
    const isOutsideEveryMethod = line => liesInTheTypeOutsideItsMethods(classSpan, methods.map(method => method.span), line);
    return name => {
      const line = this.references.lines.listLinesNaming(filePath, name).find(lineNumber => isOutsideEveryMethod(lineNumber) && driver.findValueDeclaredAt(fileLines, lineNumber, name));
      return line ? { from: line, to: Math.max(line, reading.readValueEndAt(line)) } : null;
    };
  }

  readWholeTextByLineMap(filePath) {
    const known = this.readTextByLineMap(filePath);
    if (known.size) return known;
    return new Map((this.readFileLines(filePath) || []).map((text, offset) => [offset + 1, text]));
  }

  listCallSitesOutsideTheMethod(abstraction, lines) {
    if (!lines || abstraction.scale !== Scale.METHOD.name) return [];
    return this.listCallLineNumbersOutsideTheMethod(abstraction).map(line => ({ line, text: String(lines[line - 1] ?? "") }));
  }

  listCallLineNumbersOutsideTheMethod(abstraction) {
    const span = abstraction.lines || { from: 1, to: 1 };
    return this.references.lines.listCallLinesInFile(abstraction.path, abstraction.name).filter(line => !doesSpanHoldLine(span, line));
  }

  listCallersInFile(abstraction, lines) {
    return this.listCallSitesOutsideTheMethod(abstraction, lines).map(callLine => `${callLine.line}: ${callLine.text.trim()}`);
  }

  holdsAPlaceInAnotherApplication(abstraction) {
    return (abstraction.sameDecisionAt || []).flatMap(occurrence => occurrence.places || []).some(place => liesInAnotherApplication(abstraction.path, place.path, this.applicationRoots));
  }

  showsItsCallingMethods(abstraction) {
    return !abstraction.isTest && (isShapedByItsCallers(abstraction) || this.holdsAPlaceInAnotherApplication(abstraction));
  }

  listCallingMethods(abstraction, lines) {
    if (!this.showsItsCallingMethods(abstraction)) return [];
    const callLines = this.listCallSitesOutsideTheMethod(abstraction, lines);
    const methods = callLines.length ? this.listMethodSpansOfTheFile(abstraction.path) : [];
    const callersByPlaceMap = new Map();
    for (const call of callLines) {
      const caller = findInnermostHolding(methods, call.line, method => method.span);
      const key = caller ? `${caller.span.from}` : `line ${call.line}`;
      if (!callersByPlaceMap.has(key)) callersByPlaceMap.set(key, caller ? { name: caller.name, ...buildCallingWindow(caller.span, call.line) } : { name: "", from: call.line, to: call.line });
    }
    return [...callersByPlaceMap.values()].slice(0, MAX_CALLING_METHODS).flatMap(caller => buildCallerWindowLines(abstraction, caller, lines));
  }

  listMethodSpansOfTheFile(filePath) {
    const reading = this.findReading(filePath);
    return reading ? reading.tags.filter(tag => tag.scale === Scale.METHOD.name).map(tag => ({ name: tag.name, line: tag.line, span: reading.readSpan(tag) })) : [];
  }

  listChildCount(abstraction) {
    return this.folderChildren.isReadForItsParts(abstraction) ? [formatChildCountLine(this.folderChildren.countDirectChildren(abstraction.path))] : [];
  }
}
