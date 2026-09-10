import { listAncestors, isBelow } from "../../generic/reading/FolderPaths.mjs";
import { GenericModuleFinder } from "../../generic/GenericModuleFinder.mjs";
import { buildOpeningOfLine } from "../../generic/published/Openings.mjs";
import { readFolderPath } from "../../../../../../files/paths.mjs";

const MAX_FOLDERS_WALKED_FOR_OPENINGS = 400;
const MAX_OPENED_FOLDERS = 40;

const NAMED_INTERFACE_PATTERN = /@(?:[\w.]+\.)?NamedInterface\s*\(\s*(?:value\s*=\s*)?"([^"]*)"/;
const APPLICATION_MODULE_PATTERN = /@(?:[\w.]+\.)?ApplicationModule\s*\(/;

function findNamedInterface(reading, openedSubPackage, folder) {
  for (const file of reading.folderFiles.listFiles(folder)) {
    const lines = reading.folderFiles.readFileLines(file.path);
    for (let at = 0; at < lines.length; at++) {
      const found = openedSubPackage.exec(lines[at]);
      if (found) return { kind: "declared", folder, path: file.path, line: at + 1, text: lines[at].trim(), name: found[1] || "" };
    }
  }
  return null;
}

function findOpeningsBelow(reading, openedSubPackage, root) {
  const found = [];
  const waiting = reading.folderFiles.listFolders(root).map(below => below.path);
  let walked = 0;
  while (waiting.length && walked < MAX_FOLDERS_WALKED_FOR_OPENINGS && found.length < MAX_OPENED_FOLDERS) {
    const folder = waiting.shift();
    walked++;
    const opening = findNamedInterface(reading, openedSubPackage, folder);
    if (opening) found.push(opening);
    waiting.push(...reading.folderFiles.listFolders(folder).map(below => below.path));
  }
  return found;
}

const findOpeningsFromFolderToRoot = (reading, openedSubPackage, folder, root) => listAncestors(folder)
  .filter(ancestor => isBelow(ancestor, root))
  .map(ancestor => findNamedInterface(reading, openedSubPackage, ancestor))
  .filter(Boolean);

export class JvmSpringModulithModuleFinder extends GenericModuleFinder {
  family = "jvm";
  framework = "spring-modulith";
  openedSubPackage = NAMED_INTERFACE_PATTERN;
  boundaryDeclarations = [APPLICATION_MODULE_PATTERN, NAMED_INTERFACE_PATTERN];

  findLanguageOpeningsAddedBy(filePath, addedLines) {
    return addedLines.filter(addedLine => this.openedSubPackage.test(addedLine.text)).map(addedLine => buildOpeningOfLine(filePath, addedLine.line - 1, addedLine.text, readFolderPath(filePath)));
  }

  findOpenings(reading, folder, root, isRoot) {
    return isRoot ? findOpeningsBelow(reading, this.openedSubPackage, root) : findOpeningsFromFolderToRoot(reading, this.openedSubPackage, folder, root);
  }
}
