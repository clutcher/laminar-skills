import { readFolderPath } from "../../../../../../files/paths.mjs";
import { listAncestors, isBelow, findOneSegmentBelow } from "../../generic/reading/FolderPaths.mjs";
import { GenericModuleFinder } from "../../generic/GenericModuleFinder.mjs";

export class JvmSpringModuleFinder extends GenericModuleFinder {
  family = "jvm";
  framework = "spring";
  rootForm = "the folder 1 segment below the folder that holds the application class";

  findModuleRoot(reading, folder, driver) {
    const applicationRoot = this.findApplicationRoot(reading, folder, driver);
    return applicationRoot === null || !isBelow(folder, applicationRoot) ? "" : findOneSegmentBelow(folder, applicationRoot);
  }

  findApplicationPackage(reading, packageLine, folder, driver) {
    const applicationRoot = this.findApplicationRoot(reading, folder, driver);
    if (applicationRoot === null) return "";
    for (const file of reading.folderFiles.listFiles(applicationRoot)) {
      for (const line of reading.folderFiles.readFileLines(file.path)) {
        const found = packageLine.exec(line);
        if (found) return found[1];
      }
    }
    return "";
  }

  findApplicationRoot(reading, folder, driver) {
    const started = new Set(reading.findApplicationStarts(driver.diffDriver).map(readFolderPath));
    return listAncestors(folder).find(ancestor => started.has(ancestor)) ?? null;
  }
}
