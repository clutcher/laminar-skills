import path from "node:path";

export const resolveAbsolutePath = given => path.resolve(given).split(path.sep).join("/");

export const convertToRepositoryPath = given => String(given).split(path.sep).join("/");

export const convertToPathPrefix = given => String(given).replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");

export const joinFilesystemPath = (repository, relative) => path.join(repository, ...String(relative).split("/"));

export const readFolderPath = given => {
  const folder = path.posix.dirname(String(given));
  return folder === "." ? "" : folder;
};

const listFolders = given => {
  const folder = readFolderPath(given);
  return folder ? folder.split("/") : [];
};

export const measureSharedFolderDepth = (left, right) => {
  const leftFolders = listFolders(left);
  const rightFolders = listFolders(right);
  let depth = 0;
  while (depth < leftFolders.length && depth < rightFolders.length && leftFolders[depth] === rightFolders[depth]) depth++;
  return depth;
};

export const countFolderSteps = (left, right) => {
  const shared = measureSharedFolderDepth(left, right);
  return listFolders(left).length - shared + listFolders(right).length - shared;
};

export const readFileName = given => path.posix.basename(String(given));

const convertToComparablePath = given => {
  const resolved = path.resolve(given);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

export const isSamePath = (left, right) => convertToComparablePath(left) === convertToComparablePath(right);

export const readFileStem = given => path.posix.parse(readFileName(given)).name;
