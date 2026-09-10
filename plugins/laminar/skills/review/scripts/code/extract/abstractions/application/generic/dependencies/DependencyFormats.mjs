import { readFileName } from "../../../../../../files/paths.mjs";

const NO_DEPENDENCY_LINES = Object.freeze([]);

const isFormatNaming = fileName => format => format.name.test(fileName);

export const readsTheDependenciesOf = (finder, filePath) => finder.dependencyFormats.some(isFormatNaming(readFileName(filePath)));

export function pickDependencyLines(finder, filePath, lines) {
  const format = finder.dependencyFormats.find(isFormatNaming(readFileName(filePath)));
  return format ? format.readLines(lines) : NO_DEPENDENCY_LINES;
}
