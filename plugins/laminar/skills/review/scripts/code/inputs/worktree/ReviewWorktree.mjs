import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { listRegisteredWorktrees } from "./WorktreeRegistry.mjs";
import { readCommonGitFolderOf, runGitIn, readGitOutputIn } from "../repository/GitCommands.mjs";
import { markLastUsed } from "./LastUsedMarker.mjs";
import { WORKTREE_PREFIX } from "./ReviewWorktreeSweep.mjs";
import { resolveAbsolutePath, isSamePath, convertToRepositoryPath } from "../../../files/paths.mjs";

export const WORKTREES_FOLDER = Object.freeze([".claude", "worktrees"]);
export const EXCLUDE_LINE = "/.claude/worktrees/";

const MAX_SLUG_LENGTH = 40;
const REF_HASH_LENGTH = 6;
const COMMIT_KEY_LENGTH = 12;
const COMMIT_ID_PATTERN = /^[0-9a-f]{7,40}$/i;

export class WorktreeStop extends Error {}

export function findHeadOfRevisions(revisions) {
  const text = String(revisions || "");
  const ends = text.split(text.includes("...") ? "..." : "..");
  if (ends.length !== 2) return null;
  const [base, head] = ends.map(end => end.trim());
  return base && head ? head : null;
}

const buildSlug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");

const computeShortHash = text => crypto.createHash("sha256").update(text).digest("hex").slice(0, REF_HASH_LENGTH);

export function buildWorktreeKey(head, sha) {
  if (COMMIT_ID_PATTERN.test(head)) return sha.slice(0, COMMIT_KEY_LENGTH);
  const slug = buildSlug(head);
  return slug ? `${slug}-${computeShortHash(head)}` : computeShortHash(head);
}

const runGitOrStopIn = (folder, args) => {
  const finished = runGitIn(folder, args);
  if (finished.error || finished.status !== 0) throw new WorktreeStop(`git ${args.join(" ")} failed: ${String(finished.stderr || (finished.error && finished.error.message) || "").trim()}`);
  return finished.stdout.trim();
};

function addALineToTheExcludeFile(top, line) {
  const commonFolder = readCommonGitFolderOf(top);
  if (!commonFolder) throw new WorktreeStop(`git rev-parse --git-common-dir failed in ${top}`);
  const excludeFile = path.join(commonFolder, "info", "exclude");
  fs.mkdirSync(path.dirname(excludeFile), { recursive: true });
  let excludeText = "";
  try { excludeText = fs.readFileSync(excludeFile, "utf8"); } catch { excludeText = ""; }
  const separator = excludeText && !excludeText.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(excludeFile, `${excludeText}${separator}${line}\n`);
}

function ensureIgnored(top, folder) {
  const ignored = runGitIn(top, ["check-ignore", "-q", "--", convertToRepositoryPath(path.relative(top, folder))]);
  if (ignored.status === 0) return;
  addALineToTheExcludeFile(top, EXCLUDE_LINE);
}

export class ReviewWorktree {
  constructor(repository, head, now = Date.now()) {
    this.top = readGitOutputIn(repository, ["rev-parse", "--show-toplevel"]);
    if (!this.top) throw new WorktreeStop(`${repository} is not a git working tree`);
    this.sha = readGitOutputIn(repository, ["rev-parse", "--verify", "--quiet", `${head}^{commit}`]);
    if (!this.sha) throw new WorktreeStop(`the head commit ${head} is not in the repository at ${this.top}; fetch it first, then run again`);
    this.worktreesFolder = path.join(this.top, ...WORKTREES_FOLDER);
    this.folder = path.join(this.worktreesFolder, `${WORKTREE_PREFIX}${buildWorktreeKey(head, this.sha)}`);
    this.now = now;
  }

  get reason() {
    return `the worktree ${convertToRepositoryPath(path.relative(this.top, this.folder))} at ${this.sha.slice(0, COMMIT_KEY_LENGTH)}`;
  }

  prepareAtTheHead() {
    ensureIgnored(this.top, this.folder);
    if (fs.existsSync(this.folder)) this.moveToHead();
    else this.create();
    this.markUsed();
    return { folder: resolveAbsolutePath(this.folder), reason: this.reason };
  }

  moveToHead() {
    const registered = listRegisteredWorktrees(this.top).find(registeredWorktree => isSamePath(registeredWorktree.folder, this.folder));
    if (!registered) throw new WorktreeStop(`the folder ${this.folder} exists but is not a worktree of this repository; move it away, then run again`);
    if (registered.head !== this.sha) runGitOrStopIn(this.folder, ["checkout", "--detach", "--force", this.sha]);
  }

  create() {
    runGitIn(this.top, ["worktree", "prune"]);
    fs.mkdirSync(this.worktreesFolder, { recursive: true });
    runGitOrStopIn(this.top, ["worktree", "add", "--detach", this.folder, this.sha]);
  }

  markUsed() {
    if (!markLastUsed(this.folder, this.now)) throw new WorktreeStop(`git rev-parse --absolute-git-dir failed in ${this.folder}`);
  }
}
