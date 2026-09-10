import { GenericModuleFinder } from "../generic/GenericModuleFinder.mjs";
import { buildOpeningOfLine } from "../generic/published/Openings.mjs";
import { readFileName } from "../../../../../files/paths.mjs";

const EXPORTS_LINE_PATTERN = /^\s*exports\s+([A-Za-z_][\w.]*)/;

const PUBLIC_WORD_PATTERN = /(^|[^\w$])public([^\w$]|$)/;

export class JavaModuleFinder extends GenericModuleFinder {
  language = "java";
  packageLine = /^\s*package\s+([A-Za-z_][\w.]*)\s*;?\s*$/;
  importLine = /^\s*import\s+(?:static\s+)?([A-Za-z_][\w.]*)\s*;?\s*$/;

  findLanguageOpeningsAddedBy(filePath, addedLines) {
    if (readFileName(filePath) !== "module-info.java") return [];
    return addedLines.map(addedLine => this.parseExportsOpening(filePath, addedLine)).filter(Boolean);
  }

  parseExportsOpening(filePath, addedLine) {
    const exportsLine = EXPORTS_LINE_PATTERN.exec(addedLine.text);
    if (!exportsLine) return null;
    const [, exportedPackage] = exportsLine;
    return { ...buildOpeningOfLine(filePath, addedLine.line - 1, addedLine.text, ""), packagePath: exportedPackage.split(".").join("/") };
  }

  isExposed(head) {
    return PUBLIC_WORD_PATTERN.test(head);
  }
}
