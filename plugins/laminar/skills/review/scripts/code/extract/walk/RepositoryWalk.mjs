import { CHANGE_MODES } from "../../inputs/change/ChangeReader.mjs";
import { createSourceTextOfChangedFile } from "../../inputs/change/ChangedFileText.mjs";
import { SourceText } from "../../inputs/source/SourceText.mjs";
import { findDriver, isOfTheFamilyOf } from "../../inputs/source/drivers/LanguageRegistry.mjs";
import { findVisibleForTestingLines, findRolesOfSource } from "./SourceRoles.mjs";
import { ROLE_KINDS } from "../../graph/abstractions/Role.mjs";
import { doesSpanHoldLine } from "../../graph/abstractions/Place.mjs";
import { readDeclarations, readHeadsOf } from "./SourceWalk.mjs";
import { METHOD_FINDER_REGISTRY } from "../abstractions/method/index.mjs";
import { FinderContext } from "../finders/FinderContext.mjs";
import { findMembersOfADeclaredType } from "../abstractions/variable/generic/members/TypeMembers.mjs";
import { Scale } from "../../graph/abstractions/Scale.mjs";
import { fingerprintCodeWindows } from "../abstractions/method/generic/measures/CodeWindows.mjs";
import { isShown } from "../../inputs/change/ChangedFileText.mjs";
import { ApplicationFrameworks, findFrameworksMarkedIn, NO_DECLARED_FRAMEWORKS } from "../abstractions/application/generic/frameworks/ApplicationFrameworks.mjs";
import { isABuildFile } from "../abstractions/application/index.mjs";

export const DECLARATIONS_SECTION = "declarations";

const isWalkedAsSource = filePath => Boolean(findDriver(filePath)) && !isABuildFile(filePath) && !findDriver(filePath).holdsKeyTrees;

const CLASS_SCALE = Scale.CLASS.name;

const METHOD_SCALE = Scale.METHOD.name;

const listShownLines = source => source.readings.flat().filter(reading => isShown(reading)).map(reading => ({ line: reading.line, text: String(reading.text ?? "") }));

const fingerprintTheWindowsWithin = (shownLines, span) => fingerprintCodeWindows(shownLines.filter(shownLine => doesSpanHoldLine(span, shownLine.line)));

function addTheMeasuresOfEachDeclaration(source, declarations) {
  const shownLines = listShownLines(source);
  return declarations.map((declaration, position) => {
    if (declaration.scale === CLASS_SCALE) return { ...declaration, members: findMembersOfADeclaredType(source, declarations, position) };
    if (declaration.scale === METHOD_SCALE) return { ...declaration, windows: fingerprintTheWindowsWithin(shownLines, declaration.span) };
    return declaration;
  });
}

const readShownText = source => {
  if (source.lines) return source.lines;
  const lines = [];
  for (const shownLine of listShownLines(source)) lines[shownLine.line - 1] = shownLine.text;
  return Array.from(lines, text => text ?? "");
};

const addTheirRoles = (declarations, roles) => declarations
  .map((declaration, position) => (roles[position].length ? { ...declaration, roles: roles[position] } : declaration));

function walkFile(source, applications) {
  const lines = readShownText(source);
  const frameworks = findFrameworksMarkedIn(source.path, lines);
  const context = FinderContext.createForAWalkedFile(source.path, frameworks, applications);
  source.setContext(context);
  const declarations = addTheMeasuresOfEachDeclaration(source, readDeclarations(source));
  const roles = findRolesOfSource(source, declarations, lines, context);
  const visibleForTesting = findVisibleForTestingLines(source, lines, context);
  return {
    path: source.path,
    frameworks,
    declarations: addTheirRoles(declarations, roles.declarations),
    references: METHOD_FINDER_REGISTRY.findRelationFinder(context).findReferencesIn(null, source),
    ...(roles.file.length ? { roles: roles.file } : {}),
    ...(visibleForTesting.length ? { visibleForTesting } : {}),
  };
}

export const walkFiles = (sources, applications = NO_DECLARED_FRAMEWORKS) => readHeadsOf(sources).map(source => walkFile(source, applications));

export class RepositoryWalk {
  constructor(change, cachedSourceIndex, applications = new ApplicationFrameworks()) {
    this.change = change;
    this.cachedSourceIndex = cachedSourceIndex;
    this.applications = applications;
    this.walkedFilesByPathMap = new Map();
  }

  run(families) {
    if (this.change.mode === CHANGE_MODES.REPOSITORY) for (const family of families) this.walkTheFamily(family);
    this.walkTheChangedFiles();
    this.applications.noteTheMarksOf(this.listEveryFile());
    return this;
  }

  walkTheFamily(family) {
    const index = this.cachedSourceIndex.findFamilyFiles(family);
    if (!index) return;
    this.holdTheWalkedFiles(this.readOrWalkTheFamilyThroughTheCache(family, index));
  }

  readOrWalkTheFamilyThroughTheCache(family, index) {
    const cache = this.cachedSourceIndex.readIndexCache();
    const paths = index.files.map(file => file.path);
    const section = `${DECLARATIONS_SECTION}\u0000${this.applications.buildSignature()}`;
    const saved = cache.read(family, paths, section);
    if (saved) return saved;
    const walked = this.walkTheFilesOfTheIndex(index);
    cache.write(family, paths, () => walked, section);
    return walked;
  }

  walkTheFilesOfTheIndex(index) {
    return walkFiles(index.files
      .filter(file => isWalkedAsSource(file.path))
      .map(file => SourceText.createForFile(file.path, index.readFileLines(file), findDriver(file.path))), this.applications);
  }

  walkTheChangedFiles() {
    const sources = this.listChangedFilesNotYetWalked().map(changed => createSourceTextOfChangedFile(changed, findDriver(changed.path)));
    this.holdTheWalkedFiles(walkFiles(sources, this.applications));
  }

  listChangedFilesWalkedAsSource() {
    return this.change.files.filter(file => isWalkedAsSource(file.path) && file.isReadableBy(findDriver(file.path)));
  }

  listChangedFilesNotYetWalked() {
    return this.listChangedFilesWalkedAsSource().filter(file => !this.walkedFilesByPathMap.has(file.path));
  }

  holdTheWalkedFiles(walked) {
    for (const file of walked) this.walkedFilesByPathMap.set(file.path, file);
  }

  findReferencesNamed(name) {
    if (!this.referencesByNameMap) {
      this.referencesByNameMap = new Map();
      for (const file of this.walkedFilesByPathMap.values()) {
        for (const reference of file.references) {
          if (!this.referencesByNameMap.has(reference.name)) this.referencesByNameMap.set(reference.name, []);
          this.referencesByNameMap.get(reference.name).push({ path: file.path, line: reference.line, kind: reference.kind, receiver: reference.receiver });
        }
      }
    }
    return this.referencesByNameMap.get(name) || [];
  }

  findFrameworksMarkedInTheWalkedFile(filePath) {
    const walked = this.walkedFilesByPathMap.get(filePath);
    return walked ? walked.frameworks : [];
  }

  findRolesAt(filePath, line) {
    const walked = this.walkedFilesByPathMap.get(filePath);
    if (!walked) return [];
    if (line === null) return walked.roles || [];
    const declaration = walked.declarations.find(declaration => declaration.line === line);
    return declaration ? declaration.roles || [] : [];
  }

  readTestFacts(filePath) {
    const walked = this.walkedFilesByPathMap.get(filePath);
    const test = walked ? (walked.roles || []).find(role => role.kind === ROLE_KINDS.TEST) : null;
    return { interactionAssertions: [], ...(test ? test.facts : {}) };
  }

  findApplicationStarts(language) {
    return this.listEveryFile()
      .filter(file => isOfTheFamilyOf(file.path, language))
      .flatMap(file => file.declarations.filter(declaration => (declaration.roles || []).some(role => role.kind === ROLE_KINDS.APPLICATION_START)).map(() => file.path));
  }

  findDeclarationsAt(filePath) {
    const walked = this.walkedFilesByPathMap.get(filePath);
    return walked ? walked.declarations : null;
  }

  listEveryFile() {
    return [...this.walkedFilesByPathMap.values()];
  }
}
