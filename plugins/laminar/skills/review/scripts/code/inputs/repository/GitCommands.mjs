import { spawnSync } from "node:child_process";

export const MAX_BUFFER = 1 << 28;

const UNQUOTED_PATHS_CONFIG = Object.freeze(["-c", "core.quotePath=false"]);

export const PLAIN_PATCH_OPTIONS = Object.freeze(["--no-ext-diff", "--no-textconv", "--src-prefix=a/", "--dst-prefix=b/", "--inter-hunk-context=0"]);

export const runGitProcess = (args, cwd, environment = {}) =>
  spawnSync("git", [...UNQUOTED_PATHS_CONFIG, ...args], { cwd, encoding: "utf8", maxBuffer: MAX_BUFFER, env: { ...process.env, ...environment } });

export const hasSucceeded = finished => !finished.error && finished.status === 0;

export const readGitOutput = (args, cwd) => {
  const finished = runGitProcess(args, cwd);
  return hasSucceeded(finished) ? finished.stdout : null;
};

export const readTrimmedGitOutput = (args, cwd) => {
  const output = readGitOutput(args, cwd);
  return output === null ? null : output.trim();
};

export const runGitIn = (folder, args, environment = {}) => runGitProcess(["-C", folder, ...args], undefined, environment);

export const readGitOutputIn = (folder, args) => readTrimmedGitOutput(["-C", folder, ...args]);

export const readTopFolderOf = folder => readGitOutputIn(folder, ["rev-parse", "--show-toplevel"]);

export const readCommonGitFolderOf = folder => readTrimmedGitOutput(["rev-parse", "--path-format=absolute", "--git-common-dir"], folder);

export function readGitOutputOrFail(args, cwd) {
  const finished = runGitProcess(args, cwd);
  if (finished.error) throw new Error(`git ${args.join(" ")} failed: ${finished.error.message}`);
  if (finished.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${(finished.stderr || "").trim()}`);
  return finished.stdout;
}
