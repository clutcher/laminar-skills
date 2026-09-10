import { EXPOSED_SETS } from "../../../../graph/abstractions/Boundary.mjs";
import { GenericModuleFinder } from "../generic/GenericModuleFinder.mjs";
import { buildOpenedPath, buildOpeningOfLine } from "../generic/published/Openings.mjs";
import { readFileName, readFolderPath } from "../../../../../files/paths.mjs";

const EXPORTS_FIELD_PATTERN = /^\s*"exports"\s*:/;

const RELATIVE_SPECIFIER_PATTERN = /^\.\.?\//;

const PACKAGE_EXPORT_VALUE_PATTERN = /(?:^|[:[,])\s*"(\.\/[^"]+)"(?=\s*(?:[,}\]]|$))/g;

const countSigns = (text, sign) => text.split(sign).length - 1;

const findExportTargetsOnTheLine = text => [...text.matchAll(PACKAGE_EXPORT_VALUE_PATTERN)].map(([, exportTarget]) => exportTarget);

const readExportsValueText = (packageLines, at, exportsFieldAt) => (at === exportsFieldAt ? packageLines[at].replace(EXPORTS_FIELD_PATTERN, "") : packageLines[at]);

const findExportTargetsOfThePackage = packageLines => {
  const exportsFieldAt = packageLines.findIndex(line => EXPORTS_FIELD_PATTERN.test(line));
  if (exportsFieldAt < 0) return [];
  const exportTargets = [];
  let openBracesOfTheExportsField = 0;
  let exportsValueHasStarted = false;
  for (let at = exportsFieldAt; at < packageLines.length; at++) {
    const valueText = readExportsValueText(packageLines, at, exportsFieldAt);
    for (const exportTarget of findExportTargetsOnTheLine(valueText)) exportTargets.push({ at, text: packageLines[at], value: exportTarget });
    openBracesOfTheExportsField += countSigns(valueText, "{") - countSigns(valueText, "}");
    exportsValueHasStarted ||= valueText.trim() !== "";
    if (exportsValueHasStarted && openBracesOfTheExportsField <= 0) break;
  }
  return exportTargets;
};

const EXPORT_WORD_PATTERN = /(^|[^\w$])export([^\w$]|$)/;

export class TypeScriptModuleFinder extends GenericModuleFinder {
  language = "javascript";
  rootForm = "the nearest folder that holds a barrel file";
  rootFileNames = ["index.ts", "index.tsx", "index.mts", "index.cts", "index.js", "index.jsx", "index.mjs", "index.cjs"];
  boundaryDeclarations = [/^\s*export\s+(?:\*|\{|type\s*\{)/];
  exposedSet = EXPOSED_SETS.RE_EXPORTS;
  reExportLine = /^\s*export\s+(?:type\s+)?(?:(\*)|\{([^}]*)\})\s*(?:as\s+([A-Za-z_$][\w$]*)\s*)?from\s*["']([^"']+)["']/;

  isExposed(head) {
    return EXPORT_WORD_PATTERN.test(head);
  }

  findTheReExportOpening(filePath, at, line) {
    const reExportMatch = this.reExportLine.exec(line);
    if (!reExportMatch || !RELATIVE_SPECIFIER_PATTERN.test(reExportMatch[4])) return null;
    const names = reExportMatch[2] ? reExportMatch[2].split(",").map(name => name.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, "").trim()).filter(Boolean) : [];
    return buildOpeningOfLine(filePath, at, line, buildOpenedPath(readFolderPath(filePath), reExportMatch[4]), names);
  }

  findPackageExportOpenings(filePath, addedLines, fileLines) {
    const addedLineNumbers = new Set(addedLines.map(addedLine => addedLine.line));
    return findExportTargetsOfThePackage(fileLines)
      .filter(({ at }) => addedLineNumbers.has(at + 1))
      .map(({ at, text, value }) => buildOpeningOfLine(filePath, at, text, buildOpenedPath(readFolderPath(filePath), value)));
  }

  findLanguageOpeningsAddedBy(filePath, addedLines, fileLines) {
    const fileName = readFileName(filePath);
    if (fileName === "package.json") return this.findPackageExportOpenings(filePath, addedLines, fileLines);
    if (!this.isARootFilePath(filePath)) return [];
    return addedLines.map(addedLine => this.findTheReExportOpening(filePath, addedLine.line - 1, addedLine.text)).filter(Boolean);
  }

  findRootFiles(reading, root) {
    return reading.folderFiles.listFiles(root).filter(file => this.isARootFile(file));
  }

  findPackageFile(reading, root) {
    return reading.folderFiles.listFiles(root).find(file => file.name === "package.json") || null;
  }

  findReExportOpeningsOfTheBarrel(reading, file) {
    return reading.folderFiles.readFileLines(file.path).map((line, at) => this.findTheReExportOpening(file.path, at, line)).filter(Boolean);
  }

  findLanguageOpenings(reading, root) {
    const fromBarrels = this.findRootFiles(reading, root).flatMap(file => this.findReExportOpeningsOfTheBarrel(reading, file));
    const packageFile = this.findPackageFile(reading, root);
    const fromThePackage = packageFile ? findExportTargetsOfThePackage(reading.folderFiles.readFileLines(packageFile.path))
      .map(({ at, text, value }) => buildOpeningOfLine(packageFile.path, at, text, buildOpenedPath(root, value))) : [];
    return [...fromBarrels, ...fromThePackage];
  }
}
