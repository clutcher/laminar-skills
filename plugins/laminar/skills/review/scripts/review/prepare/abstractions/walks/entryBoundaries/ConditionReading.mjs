import { findDeployableFolder, findDriver, isADecisionLine, isALanguageWordOrAnEverydayName, readLanguageFamily, formatDisplayNameOfMethod, buildAnyValueDeclarationPattern, buildWholeWordPattern } from "../../../../../code/index.mjs";
import { readFileName } from "../../../../../files/paths.mjs";

export const MAX_CONDITION_METHOD_LINES = 6;
export const MAX_CONDITION_CALLS = 3;
export const MAX_DECLARED_LINES = 4;

const CONDITION_THAT_GOES_ON_PATTERN = /^\s*(?:\?|:(?!:)|&&|\|\|)/;
const LITERAL_VALUE_PATTERN = /=\s*(?:"[^"]*"|'[^']*'|`[^`$]*`|-?\d[\d_.]*[a-zA-Z]?|true|false)\s*[;,]?\s*$/;
const NAMED_VALUE_PATTERN = /=\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\s*[;,]?\s*$/;
const FILE_EXTENSION_PATTERN = /\.[^.]+$/;

const readNumberedLine = (lines, line) => ({ line, text: String(lines[line - 1] ?? "") });

const isShort = method => method.to - method.line + 1 <= MAX_CONDITION_METHOD_LINES;

const liesOutside = (method, span) => method.to < span.from || method.line > span.to;

const findNextCodeLine = (lines, at) => lines.slice(at + 1).find(line => String(line.text).trim()) || { text: "" };

const holdsACondition = (lines, at) => isADecisionLine(lines[at].text) || CONDITION_THAT_GOES_ON_PATTERN.test(findNextCodeLine(lines, at).text);

const collectCalledNames = (references, filePath, lines) => [...new Set(lines.filter((line, at) => holdsACondition(lines, at))
  .flatMap(line => references.lines.listCalledNamesAtLine(filePath, line.line)))];

const findDeclarationInTheFile = (references, filePath, fileLines, name) => {
  const declaring = buildAnyValueDeclarationPattern(name);
  return references.lines.listLinesNaming(filePath, name).find(line => declaring.test(String(fileLines[line - 1] ?? ""))) || 0;
};

const holdsALiteral = text => LITERAL_VALUE_PATTERN.test(String(text));

const collectConstantsReadByTheMethod = (references, filePath, fileLines, method) => [...new Set(readNumberedLines(fileLines, method.line, method.to)
  .flatMap(numberedLine => references.lines.listBareNamesAtLine(filePath, numberedLine.line))
  .map(name => findDeclarationInTheFile(references, filePath, fileLines, name))
  .filter(line => line && (line < method.line || line > method.to) && holdsALiteral(fileLines[line - 1])))]
  .slice(0, MAX_DECLARED_LINES).sort((left, right) => left - right)
  .map(line => readNumberedLine(fileLines, line));

const buildConditionCall = (references, fileLines, filePath, method) => ({
  displayName: formatDisplayNameOfMethod(method),
  path: filePath,
  from: method.line,
  to: method.to,
  lines: readNumberedLines(fileLines, method.line, method.to),
  declaredInTheFile: collectConstantsReadByTheMethod(references, filePath, fileLines, method),
});

export function findConditionCalls(callGraph, references, fileLines, span) {
  const methods = callGraph ? callGraph.methodsByPathMap.get(span.path) || [] : [];
  const found = [];
  for (const name of collectCalledNames(references, span.path, span.lines)) {
    for (const method of methods.filter(method => method.name === name && isShort(method) && liesOutside(method, span))) {
      if (found.length < MAX_CONDITION_CALLS) found.push(buildConditionCall(references, fileLines, span.path, method));
    }
  }
  return found;
}

const findTheDeclarationLineAbove = (references, filePath, fileLines, line, name) => {
  const declaring = buildAnyValueDeclarationPattern(name);
  return references.lines.listLinesNaming(filePath, name).filter(above => above < line && declaring.test(String(fileLines[above - 1] ?? ""))).pop() || 0;
};

export function findDeclarationsReadByTheLine(references, filePath, fileLines, line, shownLines) {
  const shown = new Set(shownLines.map(shownLine => shownLine.line));
  const found = new Set();
  const read = (from, onlyLiterals) => {
    for (const name of references.lines.listBareNamesAtLine(filePath, from)) {
      const declared = findTheDeclarationLineAbove(references, filePath, fileLines, from, name);
      if (declared && (!onlyLiterals || holdsALiteral(fileLines[declared - 1]))) found.add(declared);
    }
  };
  read(line, false);
  for (const declared of [...found]) read(declared, true);
  return [...found].filter(declaredLine => !shown.has(declaredLine)).slice(0, MAX_DECLARED_LINES).sort((left, right) => left - right)
    .map(declaredLine => readNumberedLine(fileLines, declaredLine));
}

const holdsAFixedValue = text => LITERAL_VALUE_PATTERN.test(String(text)) || NAMED_VALUE_PATTERN.test(String(text));

const namesTheWord = (text, word) => buildWholeWordPattern(word).test(String(text));

const readStem = filePath => readFileName(filePath).replace(FILE_EXTENSION_PATTERN, "");

export class ImportedConstantLookup {
  constructor(repositoryText, testCode, roots, references) {
    this.repositoryText = repositoryText;
    this.testCode = testCode;
    this.roots = roots;
    this.references = references;
  }

  findNamesReadThroughAnImport(filePath, line) {
    const qualified = this.references.lines.listQualifiedNamesAtLine(filePath, line);
    const bare = this.references.lines.listBareNamesAtLine(filePath, line).map(name => ({ name, importedAs: name }));
    return [...qualified, ...bare].filter(read => !isALanguageWordOrAnEverydayName(read.name));
  }

  findImportLine(filePath, fileLines, importedAs) {
    const driver = findDriver(filePath);
    if (!driver) return "";
    const line = this.references.lines.listLinesNaming(filePath, importedAs).find(lineNumber => driver.isImportLine(String(fileLines[lineNumber - 1] ?? "")));
    return line ? String(fileLines[line - 1]) : "";
  }

  readDeclaration(filePath, name, importLine) {
    const applicationFolder = findDeployableFolder(filePath, this.roots);
    const declaring = buildAnyValueDeclarationPattern(name);
    const place = this.references.findNamingPlaces(name, readLanguageFamily(filePath))
      .filter(namingPlace => namingPlace.path !== filePath && findDeployableFolder(namingPlace.path, this.roots) === applicationFolder && !this.testCode.isTestPlace(namingPlace))
      .filter(namingPlace => namesTheWord(importLine, readStem(namingPlace.path)))
      .map(namingPlace => ({ path: namingPlace.path, ...readNumberedLine(this.repositoryText.readFileLines(namingPlace.path) || [], namingPlace.line) }))
      .find(numberedLine => declaring.test(numberedLine.text) && holdsAFixedValue(numberedLine.text));
    return place || null;
  }

  findDeclaredLinesRead(filePath, fileLines, conditionLines) {
    const declaredByPlaceMap = new Map();
    for (const read of conditionLines.flatMap(conditionLine => this.findNamesReadThroughAnImport(filePath, conditionLine.line))) {
      if (findDeclarationInTheFile(this.references, filePath, fileLines, read.name)) continue;
      const importLine = this.findImportLine(filePath, fileLines, read.importedAs);
      const declared = importLine ? this.readDeclaration(filePath, read.name, importLine) : null;
      if (declared) declaredByPlaceMap.set(`${declared.path}:${declared.line}`, declared);
    }
    const kept = [...declaredByPlaceMap.values()].slice(0, MAX_DECLARED_LINES);
    return [...new Set(kept.map(declaredValue => declaredValue.path))]
      .map(declaredPath => ({ path: declaredPath, lines: kept.filter(declaredValue => declaredValue.path === declaredPath).map(({ line, text }) => ({ line, text })).sort((left, right) => left.line - right.line) }));
  }

  findDeclaredLinesReadByTheConditions(filePath, fileLines, lines) {
    return this.findDeclaredLinesRead(filePath, fileLines, lines.filter((line, at) => holdsACondition(lines, at)));
  }
}

export const readNumberedLines = (lines, from, to) => {
  const numbered = [];
  for (let line = from; line <= to; line++) numbered.push(readNumberedLine(lines, line));
  return numbered;
};
