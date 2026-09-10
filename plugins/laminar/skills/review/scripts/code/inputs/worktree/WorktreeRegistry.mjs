import path from "node:path";
import { readGitOutputIn } from "../repository/GitCommands.mjs";

const findWorktreeInBlock = block => {
  const lines = block.split(/\r?\n/);
  const named = lines.find(line => line.startsWith("worktree "));
  const head = lines.find(line => line.startsWith("HEAD "));
  return named ? { folder: path.resolve(named.slice("worktree ".length)), head: head ? head.slice("HEAD ".length) : "" } : null;
};

export const listRegisteredWorktrees = top => (readGitOutputIn(top, ["worktree", "list", "--porcelain"]) || "").split(/\r?\n\r?\n/).map(findWorktreeInBlock).filter(Boolean);
