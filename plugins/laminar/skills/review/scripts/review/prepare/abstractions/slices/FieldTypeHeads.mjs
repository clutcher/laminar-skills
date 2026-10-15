import { buildWholeWordPattern, findClosingParenthesis, formatPlacedSliceLine, listHeadLineNumbers, ONLY_PARENTHESES, Scale } from "../../../../code/index.mjs";
import { OutsideDeclarations } from "../OutsideDeclarations.mjs";

export const MAX_FIELD_TYPES = 6;
export const MAX_LINES_OF_A_FIELD_TYPE = 8;

const keepOnceEach = numbers => [...new Set(numbers)].sort((left, right) => left - right);

const readComponentListText = headText => {
  const opening = headText.indexOf(ONLY_PARENTHESES);
  if (opening < 0) return "";
  const closing = findClosingParenthesis(headText, opening, ONLY_PARENTHESES);
  return headText.slice(opening + 1, closing < 0 ? headText.length : closing);
};

const isNamedIn = text => name => buildWholeWordPattern(name).test(text);

export class FieldTypeHeads {
  constructor(references) {
    this.references = references;
    this.outsideDeclarations = references.graph ? new OutsideDeclarations(references.graph, references) : null;
  }

  listLines(abstraction) {
    if (!this.outsideDeclarations || abstraction.scale !== Scale.CLASS.name || !abstraction.lines) return [];
    return this.findTheFieldTypes(abstraction)
      .slice(0, MAX_FIELD_TYPES)
      .flatMap(type => this.listDeclaringLines(type));
  }

  findTheFieldTypes(abstraction) {
    const types = this.listNamesOfTheFieldTypes(abstraction)
      .filter(name => name !== abstraction.name)
      .map(name => this.outsideDeclarations.findNearestType({ name, enclosingTypeName: null, usedFrom: abstraction.path }))
      .filter(found => found && found.type.place.file !== abstraction.path)
      .map(found => found.type);
    return [...new Set(types)];
  }

  listNamesOfTheFieldTypes(abstraction) {
    const lines = this.readLines(abstraction.path);
    const headLines = listHeadLineNumbers(lines, abstraction.lines.from);
    const componentListText = readComponentListText(headLines.map(line => String(lines[line - 1] ?? "")).join(" "));
    const namesInTheHead = [...this.references.lines.collectNamesAtLines(abstraction.path, headLines)].filter(isNamedIn(componentListText));
    const namesOnTheFieldLines = [...this.references.lines.collectNamesAtLines(abstraction.path, this.listFieldLines(abstraction, headLines))];
    return [...new Set([...namesInTheHead, ...namesOnTheFieldLines])];
  }

  listFieldLines(abstraction, headLines) {
    const type = this.references.abstractionLookup.findAbstractionAt(abstraction.path, abstraction.lines.from, abstraction.name);
    return (type ? type.members || [] : []).map(member => member.line).filter(line => !headLines.includes(line));
  }

  listDeclaringLines(type) {
    const filePath = type.place.file;
    const lines = this.readLines(filePath);
    return keepOnceEach([...listHeadLineNumbers(lines, type.place.startLine), ...(type.members || []).map(member => member.line)])
      .slice(0, MAX_LINES_OF_A_FIELD_TYPE)
      .map(line => formatPlacedSliceLine(filePath, line, String(lines[line - 1] ?? "").trim()));
  }

  readLines(filePath) {
    return this.references.readFileLines(filePath) || [];
  }
}
