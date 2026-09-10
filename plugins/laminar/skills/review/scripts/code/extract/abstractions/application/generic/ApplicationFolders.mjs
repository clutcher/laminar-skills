import { readFileName, readFolderPath } from "../../../../../files/paths.mjs";

export const findDeployableFolder = (filePath, roots) => {
  let best = null;
  for (const root of roots) {
    const folder = readFolderPath(root);
    if (folder !== "" && filePath !== folder && !filePath.startsWith(folder + "/")) continue;
    if (best === null || folder.length > best.length) best = folder;
  }
  return best;
};

export const liesInAnotherApplication = (homePath, placePath, roots) => {
  const homeFolder = findDeployableFolder(homePath || "", roots);
  const placeFolder = findDeployableFolder(placePath || "", roots);
  return Boolean(homeFolder) && Boolean(placeFolder) && placeFolder !== homeFolder;
};

export const readApplicationName = (filePath, roots) => readFileName(findDeployableFolder(filePath, roots) || "");
