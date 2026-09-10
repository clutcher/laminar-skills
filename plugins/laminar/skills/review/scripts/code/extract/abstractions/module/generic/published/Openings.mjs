import path from "node:path";
import { findDriver } from "../../../../../inputs/source/drivers/LanguageRegistry.mjs";

const FILE_EXTENSION_PATTERN = /\.[A-Za-z0-9]+$/;

const INDEX_FILE_PATTERN = /\/(?:index|__init__|mod)$/;

const stripSourceExtension = filePath => (findDriver(filePath) ? filePath.replace(FILE_EXTENSION_PATTERN, "") : filePath);

export const buildOpenedPath = (root, specifier) => {
  const joinedPath = path.posix.normalize(path.posix.join(root || ".", specifier));
  return stripSourceExtension(joinedPath === "." ? "" : joinedPath).replace(/\/+$/, "");
};

export const opensTheFile = (opening, filePath) => {
  const pathWithoutExtension = stripSourceExtension(filePath);
  return pathWithoutExtension === opening.opens
    || pathWithoutExtension.replace(INDEX_FILE_PATTERN, "") === opening.opens
    || filePath.startsWith(`${opening.opens}/`);
};

export const buildOpeningOfLine = (filePath, at, text, opens, names = []) => ({ kind: "declared", path: filePath, line: at + 1, text: String(text).trim(), opens, names });
