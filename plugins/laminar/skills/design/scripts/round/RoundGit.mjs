import { spawnSync } from "node:child_process";
import { RoundStop } from "./RunFolder.mjs";

// A file that the fixes created, or a file a rename moved in: the status A, or R with its similarity, in git diff --name-status.
const FIX_CREATED_STATUS = /^(?:A|R\d*)$/;

const NEW_SIDE_OF_A_HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

const runGit = (repositoryRoot, words) => {
  const result = spawnSync("git", words, { cwd: repositoryRoot, encoding: "utf8" });
  if (result.status !== 0) throw new RoundStop(`git ${words.join(" ")} failed in ${repositoryRoot}: ${(result.stderr || result.error || "").toString().trim()}`);
  return result.stdout;
};

export const readHeadCommit = repositoryRoot => runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();

export const listFixCreatedFiles = (repositoryRoot, earlierHead) => new Set(runGit(repositoryRoot, ["diff", "--name-status", "--find-renames", `${earlierHead}..HEAD`])
  .split("\n")
  .map(line => line.split("\t"))
  .filter(columns => FIX_CREATED_STATUS.test(columns[0]))
  .map(columns => columns[columns.length - 1]));

const listChangedLineSpans = diffText => diffText.split("\n")
  .map(line => NEW_SIDE_OF_A_HUNK.exec(line))
  .filter(Boolean)
  .map(match => ({ first: Number(match[1]), count: match[2] === undefined ? 1 : Number(match[2]) }));

const isTheLineChanged = (spans, line) => spans.some(span => line >= span.first && line < span.first + Math.max(span.count, 1));

// The place of a finding that the change since the base commit touched: its line where the place has one, else any line of its file or folder.
export const createChangedPlaceFinder = (repositoryRoot, baseCommit) => places => {
  for (const place of places) {
    if (!place.file) continue;
    const diffText = runGit(repositoryRoot, ["diff", "--unified=0", `${baseCommit}..HEAD`, "--", place.file]);
    if (!diffText.trim()) continue;
    if (place.line === null) return place.file;
    if (isTheLineChanged(listChangedLineSpans(diffText), place.line)) return `${place.file}:${place.line}`;
  }
  return null;
};
