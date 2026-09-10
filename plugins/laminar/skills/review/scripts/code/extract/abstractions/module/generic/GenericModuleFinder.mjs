import { AbstractionFinder } from "../../../finders/AbstractionFinder.mjs";
import { EXPOSED_SETS } from "../../../../graph/abstractions/Boundary.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { findDiffDriver, readExtension } from "../../../../inputs/source/Languages.mjs";
import { listAncestors } from "./reading/FolderPaths.mjs";
import { findFirstDefinedAnswer } from "../../../finders/StrategyAnswers.mjs";
import { readFileName } from "../../../../../files/paths.mjs";

const MAX_EXPOSED_NAMES = 120;

const AT_THE_ROOT = true;

const INDENTED_LINE_PATTERN = /^\s/;

const TRAILING_BRACE_PATTERN = /\s*\{\s*$/;

const readHead = line => String(line).trim().replace(TRAILING_BRACE_PATTERN, "");

const isATopLevelDeclarationLine = (line, driver) => !INDENTED_LINE_PATTERN.test(line) && !driver.isImportLine(line) && driver.looksLikeDeclaration(line);

function* listTopLevelDeclarationLines(lines, driver) {
  for (const line of lines) if (isATopLevelDeclarationLine(line, driver)) yield line;
}

const buildPlaceKey = declared => `${declared.path}:${declared.line}`;

const removeRepeatedPlaces = declarations => [...new Map(declarations.map(declared => [buildPlaceKey(declared), declared])).values()];

const findDeclaredNamesIn = (text, pattern) => {
  const found = pattern.exec(text);
  if (!found) return [];
  return [...found[1].matchAll(/["']([^"']+)["']/g)].map(name => name[1]);
};

const findReExportedNames = (line, pattern) => {
  const found = pattern.exec(line);
  if (!found) return [];
  if (found[3]) return [found[3]];
  if (found[1]) return [`every name of ${found[4]}`];
  return found[2].split(",").map(name => name.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean);
};

const takeAtMost = (count, items) => {
  const taken = [];
  for (const item of items) {
    taken.push(item);
    if (taken.length >= count) break;
  }
  return taken;
};

export class GenericModuleFinder extends AbstractionFinder {
  constructor() {
    super(Scale.MODULE);
    this.rootForm = "";
    this.rootFileNames = [];
    this.rootExtensions = [];
    this.packageLine = null;
    this.importLine = null;
    this.boundaryDeclarations = [];
    this.exposedSet = EXPOSED_SETS.DECLARATIONS;
    this.reExportLine = null;
    this.declaredNames = null;
    this.frameworks = [];
    this.roleFinders = [];
    this.shapeFinders = [];
  }

  joinFrameworks(frameworks, roleFinders, shapeFinders = []) {
    const joined = new this.constructor();
    joined.frameworks = Object.freeze([...frameworks]);
    joined.roleFinders = Object.freeze([...roleFinders]);
    joined.shapeFinders = Object.freeze([...shapeFinders]);
    return Object.freeze(joined);
  }

  isExposed() {
    return false;
  }

  findModuleRoot() {
    return undefined;
  }

  findApplicationPackage() {
    return undefined;
  }

  findOpenings() {
    return undefined;
  }

  readPublishedSet(reading, root, driver) {
    const frameworkOpenings = findFirstDefinedAnswer(this.frameworks, framework => framework.findOpenings(reading, root, root, AT_THE_ROOT)) || [];
    return { openings: [...frameworkOpenings.map(opening => ({ ...opening, opens: opening.folder })), ...this.findLanguageOpenings(reading, root, driver)] };
  }

  findLanguageOpenings() {
    return [];
  }

  findOpeningsAddedBy(filePath, addedLines, fileLines) {
    return [this, ...this.frameworks].flatMap(finder => finder.findLanguageOpeningsAddedBy(filePath, addedLines, fileLines));
  }

  findLanguageOpeningsAddedBy() {
    return [];
  }

  get moduleRootForm() {
    return this.rootForm || findFirstDefinedAnswer(this.frameworks, framework => framework.rootForm || undefined) || "";
  }

  findIn(folder, { reading, root, driver }) {
    const isRoot = folder === root;
    const applicationPackage = this.packageLine ? findFirstDefinedAnswer(this.frameworks, framework => framework.findApplicationPackage(reading, this.packageLine, folder, driver)) || "" : "";
    const openings = findFirstDefinedAnswer(this.frameworks, framework => framework.findOpenings(reading, folder, root, isRoot)) || [];
    const exposed = this.collectExposedNames(reading, folder, isRoot, driver, openings);
    return { isRoot, applicationPackage, openings, exposed, boundaries: isRoot ? this.findBoundaries(reading, root, driver, openings) : openings };
  }

  findRoot(reading, folder, driver) {
    const frameworkRoot = findFirstDefinedAnswer(this.frameworks, framework => framework.findModuleRoot(reading, folder, driver));
    if (frameworkRoot !== undefined) return frameworkRoot;
    for (const ancestor of listAncestors(folder)) {
      if (this.marksARoot(reading, ancestor)) return ancestor;
    }
    return "";
  }

  marksARoot(reading, folder) {
    return reading.folderFiles.listFiles(folder).some(file =>
      this.isARootFile(file) || this.rootExtensions.includes(readExtension(file.name)));
  }

  isARootFile(file) {
    return this.isARootFilePath(file.name);
  }

  isARootFilePath(filePath) {
    return this.rootFileNames.includes(readFileName(filePath));
  }

  collectExposedNames(reading, folder, isRoot, driver, openings) {
    if (isRoot && this.exposedSet === EXPOSED_SETS.RE_EXPORTS) return this.findReExportedIn(reading, folder);
    if (isRoot && this.exposedSet === EXPOSED_SETS.DECLARED_NAMES) return this.findDeclaredPublicNamesIn(reading, folder, driver);
    const found = this.collectTheFirstExposedDeclarationsIn(reading, folder, driver);
    if (!isRoot) return found;
    for (const opening of openings) {
      if (found.length >= MAX_EXPOSED_NAMES) break;
      found.push(...this.collectTheFirstExposedDeclarationsIn(reading, opening.folder, driver));
    }
    return found.slice(0, MAX_EXPOSED_NAMES);
  }

  collectTheFirstExposedDeclarationsIn(reading, folder, driver) {
    return takeAtMost(MAX_EXPOSED_NAMES, this.findExposedDeclarationsIn(reading, folder, driver));
  }

  *findExposedDeclarationsIn(reading, folder, driver) {
    for (const file of reading.folderFiles.listFiles(folder)) {
      if (findDiffDriver(file.path) !== driver.diffDriver) continue;
      for (const line of listTopLevelDeclarationLines(reading.folderFiles.readFileLines(file.path), driver)) {
        const declaration = driver.readDeclaration(line);
        if (declaration.name && this.isExposed(line, declaration.name, file.path)) yield { path: file.path, name: declaration.name, head: readHead(line) };
      }
    }
  }

  findReExportedIn(reading, root) {
    const found = [];
    for (const file of reading.folderFiles.listFiles(root)) {
      if (!this.isARootFile(file)) continue;
      for (const line of reading.folderFiles.readFileLines(file.path)) {
        for (const name of findReExportedNames(line, this.reExportLine)) found.push({ path: file.path, name });
      }
    }
    return found;
  }

  findDeclaredPublicNamesIn(reading, root, driver) {
    for (const file of reading.folderFiles.listFiles(root)) {
      if (!this.isARootFile(file)) continue;
      const declared = findDeclaredNamesIn(reading.folderFiles.readFileLines(file.path).join("\n"), this.declaredNames);
      if (declared.length) return declared.map(name => ({ path: file.path, name }));
    }
    return this.collectTheFirstExposedDeclarationsIn(reading, root, driver);
  }

  get boundaryDeclarationsOfTheModule() {
    return this.boundaryDeclarations.length ? this.boundaryDeclarations : findFirstDefinedAnswer(this.frameworks, framework => (framework.boundaryDeclarations.length ? framework.boundaryDeclarations : undefined)) || [];
  }

  findBoundaries(reading, root, driver, openings) {
    const declaredByTheRoot = this.findDeclaredBoundaryIn(reading, root) || this.findDeclaredBoundaryBelow(reading, root);
    const declared = removeRepeatedPlaces([...(declaredByTheRoot ? [declaredByTheRoot] : []), ...openings]);
    if (declared.length) return declared;
    const verified = findFirstDefinedAnswer(this.roleFinders, roleFinder => roleFinder.findVerifiedBoundary(reading, root, driver)) || null;
    return verified ? [verified] : [];
  }

  findDeclaredBoundaryIn(reading, folder) {
    const declarations = this.boundaryDeclarationsOfTheModule;
    for (const file of reading.folderFiles.listFiles(folder)) {
      const lines = reading.folderFiles.readFileLines(file.path);
      for (let at = 0; at < lines.length; at++) {
        if (declarations.some(pattern => pattern.test(lines[at]))) {
          return { kind: "declared", path: file.path, line: at + 1, text: lines[at].trim() };
        }
      }
    }
    return null;
  }

  findDeclaredBoundaryBelow(reading, root) {
    for (const below of reading.folderFiles.listFolders(root)) {
      const declared = this.findDeclaredBoundaryIn(reading, below.path);
      if (declared) return declared;
    }
    return null;
  }
}
