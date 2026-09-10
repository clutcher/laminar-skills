import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const scriptsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const listFilesInFolder = folder => fs.readdirSync(folder, { withFileTypes: true })
  .flatMap(child => child.isDirectory() ? listFilesInFolder(path.join(folder, child.name)) : [path.join(folder, child.name)]);

const readFolderSources = folder => listFilesInFolder(path.join(scriptsFolder, folder))
  .map(file => path.relative(scriptsFolder, file).split(path.sep).join("/"))
  .sort()
  .flatMap(file => [file, fs.readFileSync(path.join(scriptsFolder, file), "utf8")]);

export const readSourcesInFolders = folders => folders.flatMap(readFolderSources);
