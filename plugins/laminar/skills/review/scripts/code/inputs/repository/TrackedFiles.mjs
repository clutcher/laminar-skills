import { readGitOutput } from "./GitCommands.mjs";

export function readTrackedIndexLines(repository) {
  const listed = readGitOutput(["ls-files", "-s", "-z"], repository);
  return listed === null ? null : listed.split("\u0000");
}

export function readTrackedPaths(repository) {
  const lines = readTrackedIndexLines(repository);
  return lines === null ? null : lines.filter(Boolean).map(line => line.slice(line.indexOf("\t") + 1));
}
