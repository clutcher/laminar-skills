import { createSourceTextOfChangedFile } from "../../inputs/change/ChangedFileText.mjs";
import { SourceText } from "../../inputs/source/SourceText.mjs";
import { findDriver } from "../../inputs/source/drivers/LanguageRegistry.mjs";
import { isANamedPlaceScale, Scale } from "./Scale.mjs";

const isAHead = abstraction => Boolean(abstraction.signature.text);

const compareByLine = (left, right) => left.place.startLine - right.place.startLine;

const createTag = abstraction => Object.freeze({
  line: abstraction.place.startLine,
  scale: abstraction.scale.name,
  name: abstraction.name,
  text: abstraction.signature.text,
  span: Object.freeze({ from: abstraction.place.startLine, to: abstraction.place.endLine }),
});

const findSourceTextOf = (filePath, driver, { changedFile, lines }) => {
  if (changedFile) return createSourceTextOfChangedFile(changedFile, driver);
  return lines ? SourceText.createForFile(filePath, lines, driver) : null;
};

export class FileDeclarations {
  constructor(filePath, tags, valueEnds) {
    this.path = filePath;
    this.tags = tags;
    this.valueEnds = valueEnds;
  }

  static createFromGraph(graph, filePath, given) {
    const driver = findDriver(filePath);
    const source = driver ? findSourceTextOf(filePath, driver, given) : null;
    if (!source) return null;
    return new FileDeclarations(filePath, graph.findAbstractionsIn(filePath).filter(isAHead).sort(compareByLine).map(createTag), line => source.readValueEndAt(line));
  }

  readSpan(tag) {
    return tag.span;
  }

  readValueEndAt(line) {
    return this.valueEnds(line);
  }
}

const isANamedPlaceOf = driver => abstraction => isANamedPlaceScale(abstraction.scale) || (driver.fileHoldsTypesOnly && abstraction.scale === Scale.VARIABLE);

const findAbstractionsWithAHeadIn = (graph, filePath) => graph.findAbstractionsIn(filePath).filter(abstraction => abstraction.signature.text).sort(compareByLine);

const readTypeDisplayName = (driver, type, application) => driver.findTypeDisplayName(type.signature.text, type.name, application) || type.qualifiedName;

const readEnclosingNameOfAMember = (driver, member, application) => {
  const enclosingAbstraction = member.parent;
  if (!enclosingAbstraction) return member.name;
  return driver.fileHoldsTypesOnly && enclosingAbstraction.scale === Scale.CLASS ? readTypeDisplayName(driver, enclosingAbstraction, application) : enclosingAbstraction.qualifiedName;
};

const formatDisplayNameOfTheAbstraction = (driver, abstraction, application) => (abstraction.scale === Scale.CLASS
  ? readTypeDisplayName(driver, abstraction, application)
  : `${readEnclosingNameOfAMember(driver, abstraction, application)}#${abstraction.name}`);

export function findNamedPlaces(graph, filePath, application = "") {
  const driver = findDriver(filePath);
  if (!driver) return [];
  return findAbstractionsWithAHeadIn(graph, filePath).filter(isANamedPlaceOf(driver)).map(abstraction => ({
    from: abstraction.place.startLine,
    to: abstraction.place.endLine,
    scale: abstraction.scale.name,
    displayName: formatDisplayNameOfTheAbstraction(driver, abstraction, application),
  }));
}
