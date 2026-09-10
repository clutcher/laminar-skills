import path from "node:path";
import { listRegisteredWorktrees } from "./WorktreeRegistry.mjs";
import { runGitIn } from "../repository/GitCommands.mjs";
import { readLastUsedTime } from "./LastUsedMarker.mjs";
import { isSamePath } from "../../../files/paths.mjs";

export const WORKTREE_PREFIX = "laminar-review-";
export const DAYS_UNUSED_BEFORE_REMOVAL = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const mayBeSwept = (worktree, { worktreesFolder, keptFolder }) => path.basename(worktree.folder).startsWith(WORKTREE_PREFIX)
  && isSamePath(path.dirname(worktree.folder), worktreesFolder)
  && !isSamePath(worktree.folder, keptFolder);

const isUnused = (worktree, now) => {
  const lastUsed = readLastUsedTime(worktree.folder);
  return lastUsed !== null && now - lastUsed > DAYS_UNUSED_BEFORE_REMOVAL * MS_PER_DAY;
};

export function sweepUnusedReviewWorktrees({ top, worktreesFolder, keptFolder, now }) {
  for (const worktree of listRegisteredWorktrees(top).filter(registeredWorktree => mayBeSwept(registeredWorktree, { worktreesFolder, keptFolder }) && isUnused(registeredWorktree, now))) {
    runGitIn(top, ["worktree", "remove", "--force", worktree.folder]);
  }
  runGitIn(top, ["worktree", "prune"]);
}

export const sweepUnusedReviewWorktreesBeside = worktree =>
  sweepUnusedReviewWorktrees({ top: worktree.top, worktreesFolder: worktree.worktreesFolder, keptFolder: worktree.folder, now: worktree.now });
