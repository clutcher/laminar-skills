import fs from "node:fs";
import { joinFilesystemPath } from "../../../files/paths.mjs";

export function readTextOf(repository, given) {
  try {
    const absolute = joinFilesystemPath(repository, given);
    if (!fs.statSync(absolute).isFile()) return null;
    return fs.readFileSync(absolute, "utf8");
  } catch { return null; }
}

export function readRepositoryFileLines(repository, given) {
  const text = readTextOf(repository, given);
  return text === null ? [] : text.split(/\r?\n/);
}

export function listFolderChildPaths(repository, folder) {
  try {
    return fs.readdirSync(joinFilesystemPath(repository, folder || "."))
      .filter(name => !name.startsWith(".")).sort().map(name => `${folder ? folder + "/" : ""}${name}`);
  } catch { return []; }
}

export function listFolderFileNames(repository, folder) {
  try {
    return fs.readdirSync(joinFilesystemPath(repository, folder || "."), { withFileTypes: true })
      .filter(child => child.isFile() && !child.name.startsWith(".")).map(child => child.name).sort();
  } catch { return []; }
}

export function listFolderSubfolderNames(repository, folder) {
  try {
    return fs.readdirSync(joinFilesystemPath(repository, folder || "."), { withFileTypes: true })
      .filter(child => child.isDirectory() && !child.name.startsWith(".")).map(child => child.name).sort();
  } catch { return []; }
}
