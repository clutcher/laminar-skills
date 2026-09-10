import crypto from "node:crypto";
import fs from "node:fs";
import { readTrackedPaths } from "../../../../../inputs/repository/TrackedFiles.mjs";
import { joinFilesystemPath } from "../../../../../../files/paths.mjs";
import { pickDependencyLines } from "./DependencyFormats.mjs";
import { findFinderReadingTheFile } from "../../index.mjs";

const VENDORED_PATH_PATTERN = /(?:^|\/)(?:vendor|third_party|node_modules|bower_components)\//;

export const isADependencyFile = filePath => Boolean(findFinderReadingTheFile(filePath)) && !VENDORED_PATH_PATTERN.test(filePath);

const selectDistinctLines = lines => [...new Set(lines)];

function readDependencyFile(repository, filePath) {
  let text;
  try { text = fs.readFileSync(joinFilesystemPath(repository, filePath), "utf8"); } catch { return null; }
  const lines = text.split(/\r?\n/);
  const picked = selectDistinctLines(pickDependencyLines(findFinderReadingTheFile(filePath), filePath, lines));
  return {
    path: filePath,
    sha256: crypto.createHash("sha256").update(text).digest("hex"),
    lineCount: lines.length,
    dependencyLines: picked.length,
    lines: picked,
  };
}

export const readDependencyFiles = repository => (readTrackedPaths(repository) || [])
  .filter(isADependencyFile)
  .sort()
  .map(filePath => readDependencyFile(repository, filePath))
  .filter(Boolean);
