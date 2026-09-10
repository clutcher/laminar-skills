import { findLinesInsideBlocks, findTomlDependencyLines } from "../generic/dependencies/DependencyLines.mjs";
import { findQuotedWords, stripComment } from "../generic/dependencies/BuildFileText.mjs";
import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

const filterPlainLines = marker => lines => lines.map(line => stripComment(line, marker)).filter(line => line && !line.startsWith("-"));

function findListAfterAKey(lines, key) {
  const found = [];
  let inList = false;
  for (const raw of lines) {
    const text = stripComment(raw, "#");
    if (!inList && key.test(text)) {
      found.push(...findQuotedWords(text.slice(text.search(key))));
      inList = text.includes("[") && !text.includes("]");
      continue;
    }
    if (!inList) continue;
    found.push(...findQuotedWords(text));
    if (text.includes("]")) inList = false;
  }
  return found;
}

export class PythonApplicationFinder extends GenericApplicationFinder {
  buildSystem = "python";
  buildFileNames = ["pyproject.toml", "setup.py"];
  buildFileSuffixes = [];
  dependencyFormats = [
    { name: /^requirements.*\.txt$/, readLines: filterPlainLines("#") },
    { name: /^pyproject\.toml$/, readLines: findTomlDependencyLines },
    { name: /^Pipfile$/, readLines: findTomlDependencyLines },
    { name: /^setup\.py$/, readLines: lines => findListAfterAKey(lines, /\b(?:install_requires|extras_require|requires)\s*=/) },
    { name: /^setup\.cfg$/, readLines: lines => findLinesInsideBlocks(lines, /^install_requires\s*=/) },
  ];
}
