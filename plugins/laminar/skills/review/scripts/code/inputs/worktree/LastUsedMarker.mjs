import fs from "node:fs";
import path from "node:path";
import { readGitOutputIn } from "../repository/GitCommands.mjs";

export const LAST_USED_FILE = "laminar-review-last-used";

const readAdminFolder = worktreeFolder => readGitOutputIn(worktreeFolder, ["rev-parse", "--absolute-git-dir"]);

const readMarkerFileIn = adminFolder => path.join(adminFolder, LAST_USED_FILE);

export function markLastUsed(worktreeFolder, time) {
  const adminFolder = readAdminFolder(worktreeFolder);
  if (!adminFolder) return false;
  fs.writeFileSync(readMarkerFileIn(adminFolder), `${new Date(time).toISOString()}\n`);
  return true;
}

export function readLastUsedTime(worktreeFolder) {
  const adminFolder = readAdminFolder(worktreeFolder);
  if (!adminFolder) return null;
  let marked = NaN;
  try { marked = Date.parse(fs.readFileSync(readMarkerFileIn(adminFolder), "utf8").trim()); } catch { marked = NaN; }
  if (!Number.isNaN(marked)) return marked;
  try { return fs.statSync(adminFolder).mtimeMs; } catch { return null; }
}
