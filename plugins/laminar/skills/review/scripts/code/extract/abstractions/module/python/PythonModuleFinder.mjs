import { EXPOSED_SETS } from "../../../../graph/abstractions/Boundary.mjs";
import { GenericModuleFinder } from "../generic/GenericModuleFinder.mjs";
import { buildOpenedPath, buildOpeningOfLine } from "../generic/published/Openings.mjs";
import { readFolderPath } from "../../../../../files/paths.mjs";

const RELATIVE_IMPORT_PATTERN = /^\s*from\s+(\.+)([\w.]*)\s+import\s+\(?\s*([^)#]*)/;

const buildRelativeSpecifier = (dots, dottedName) => `${dots.length === 1 ? "." : "../".repeat(dots.length - 1).replace(/\/$/, "")}/${dottedName.split(".").join("/")}`;

const OPEN_IMPORT_LIST_PATTERN = /\bimport\s*\([^)]*$/;

const LINE_COMMENT_PATTERN = /#.*$/;

const stripTheComment = text => text.replace(LINE_COMMENT_PATTERN, "");

function* readImportStatements(numberedLines) {
  for (let index = 0; index < numberedLines.length; index++) {
    const firstLine = numberedLines[index];
    let statement = stripTheComment(firstLine.text);
    while (OPEN_IMPORT_LIST_PATTERN.test(statement) && index + 1 < numberedLines.length) statement += ` ${stripTheComment(numberedLines[++index].text)}`;
    yield { firstLine, statement };
  }
}

const parseImportedNames = importClause => importClause.split(",").map(name => name.trim().split(/\s+as\s+/)[0].trim()).filter(name => name && name !== "*");

export class PythonModuleFinder extends GenericModuleFinder {
  language = "python";
  rootForm = "the nearest folder that holds a package init file";
  rootFileNames = ["__init__.py"];
  boundaryDeclarations = [/^\s*__all__\s*=/];
  exposedSet = EXPOSED_SETS.DECLARED_NAMES;
  declaredNames = /__all__\s*=\s*[[(]([^\])]*)[\])]/;

  isExposed(head, name) {
    return !String(name).startsWith("_");
  }

  findInitFile(reading, root) {
    return reading.folderFiles.listFiles(root).find(file => this.isARootFile(file)) || null;
  }

  findLanguageOpenings(reading, root) {
    const initFile = this.findInitFile(reading, root);
    if (!initFile) return [];
    const numberedLines = reading.folderFiles.readFileLines(initFile.path).map((text, at) => ({ line: at + 1, text }));
    return this.findImportOpeningsOfTheLines(initFile.path, numberedLines);
  }

  findImportOpeningsOfTheLines(filePath, numberedLines) {
    return [...readImportStatements(numberedLines)].flatMap(({ firstLine, statement }) => this.findImportOpenings(filePath, firstLine.line - 1, firstLine.text, statement));
  }

  findImportOpenings(filePath, at, line, statement) {
    const relativeImport = RELATIVE_IMPORT_PATTERN.exec(statement);
    if (!relativeImport) return [];
    const [, dots, dottedModule, importClause] = relativeImport;
    const root = readFolderPath(filePath);
    const names = parseImportedNames(importClause);
    return dottedModule ? [buildOpeningOfLine(filePath, at, line, buildOpenedPath(root, buildRelativeSpecifier(dots, dottedModule)), names)] : names.map(name => buildOpeningOfLine(filePath, at, line, buildOpenedPath(root, buildRelativeSpecifier(dots, name))));
  }

  findLanguageOpeningsAddedBy(filePath, addedLines) {
    if (!this.isARootFilePath(filePath)) return [];
    return this.findImportOpeningsOfTheLines(filePath, addedLines);
  }
}
