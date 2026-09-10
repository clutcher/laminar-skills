import fs from "node:fs";
import path from "node:path";
import { resolveAbsolutePath, joinFilesystemPath, convertToRepositoryPath } from "../../../files/paths.mjs";
import { ChangedFile, FILE_STATUS, Hunk } from "./Hunk.mjs";
import { runNoIndexDiff, runWithDiffDrivers } from "./DiffDrivers.mjs";
import { readGitOutputOrFail } from "../repository/GitCommands.mjs";
import { movesAmong } from "./MovedFiles.mjs";
import { joinLinesAsFileText } from "../source/SourceText.mjs";

export const CHANGE_MODES = Object.freeze({ REPOSITORY: "REPOSITORY", PATCH: "PATCH" });

export const chooseRepositoryToRead = (mode, repository) => (mode === CHANGE_MODES.REPOSITORY && repository ? repository : null);

export const findRepositoryToRead = change => chooseRepositoryToRead(change.mode, change.repository);

const DIFF_HEADER_PATTERN = /^diff --git a\/(.*?) b\/(.*)$/;
const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

function parseDiff(text) {
  const files = [];
  let current = null;
  let hunk = null;
  for (const line of text.split(/\r?\n/)) {
    const header = DIFF_HEADER_PATTERN.exec(line);
    if (header) {
      current = new ChangedFile(header[2], header[1] === header[2] ? null : header[1], FILE_STATUS.CHANGED);
      files.push(current);
      hunk = null;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("new file mode")) { current.status = FILE_STATUS.CREATED; current.oldPath = null; }
    else if (line.startsWith("deleted file mode")) { current.status = FILE_STATUS.REMOVED; current.oldPath = null; }
    else if (line.startsWith("rename from")) { current.status = FILE_STATUS.RENAMED; current.oldPath = line.slice("rename from ".length).trim(); }
    else if (line.startsWith("rename to")) current.path = line.slice("rename to ".length).trim();
    else if (!hunk && line === "--- /dev/null" && current.status === FILE_STATUS.CHANGED) { current.status = FILE_STATUS.CREATED; current.oldPath = null; }
    const hunkHeader = HUNK_HEADER_PATTERN.exec(line);
    if (hunkHeader) {
      hunk = new Hunk(parseInt(hunkHeader[1], 10), hunkHeader[2] === undefined ? 1 : parseInt(hunkHeader[2], 10), (hunkHeader[3] || "").trim());
      current.hunks.push(hunk);
      continue;
    }
    if (!hunk) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) hunk.addAddedLine(line.slice(1));
    else if (line.startsWith("-") && !line.startsWith("---")) hunk.addRemovedLine(line.slice(1));
    else if (line.startsWith(" ")) hunk.addContextLine(line.slice(1));
    else if (line === "" && !hunk.holdsEveryNewLine) hunk.addContextLine("");
  }
  for (const file of files) file.hunks = file.hunks.filter(hunk => hunk.holdsChange());
  return files;
}

const REBUILT_FILE_PATTERN = /^after\/(\d+)\b/;

const readExtension = filePath => path.posix.extname(filePath).toLowerCase();


const stageEachMoveNumbered = moves => (before, after) => moves.forEach(({ removed, created }, number) => {
  fs.writeFileSync(path.join(before, `${number}${readExtension(removed.path)}`), joinLinesAsFileText(removed.lines));
  fs.writeFileSync(path.join(after, `${number}${readExtension(created.path)}`), joinLinesAsFileText(created.lines));
});

const parseTheMoveNumberOf = rebuiltPath => parseInt(REBUILT_FILE_PATTERN.exec(rebuiltPath)[1], 10);

const parseHunksByMoveNumber = output => new Map(parseDiff(output).map(file => [parseTheMoveNumberOf(file.path), file.hunks]));

function rebuildHunks(moves) {
  const wholeFile = `-U${Math.max(...moves.map(({ created }) => created.lines.length), 1)}`;
  const output = runNoIndexDiff("laminar-moves-", stageEachMoveNumbered(moves), [wholeFile]);
  if (output === null) return null;
  const hunksByNumberMap = parseHunksByMoveNumber(output);
  return moves.map((move, number) => hunksByNumberMap.get(number) || []);
}

const createShownFile = (file, linesOf) => ({ path: file.path, lines: file.hunks.flatMap(linesOf) });

function pairUnnamedMoves(files) {
  const removed = files.filter(file => file.status === FILE_STATUS.REMOVED).map(file => createShownFile(file, hunk => hunk.removedLines));
  const created = files.filter(file => file.status === FILE_STATUS.CREATED).map(file => createShownFile(file, hunk => hunk.addedLines));
  const found = removed.length && created.length ? movesAmong(removed, created) : [];
  if (!found.length) return files;
  const moves = found.map(({ from, to }) => ({ removed: removed.find(file => file.path === from), created: created.find(file => file.path === to) }));
  const hunks = rebuildHunks(moves);
  if (!hunks) return files;
  moves.forEach(({ removed: { path: oldPath }, created: { path: newPath } }, number) => {
    const file = files.find(file => file.path === newPath);
    Object.assign(file, { status: FILE_STATUS.RENAMED, oldPath, hunks: hunks[number] });
  });
  const movedAway = new Set(moves.map(({ removed: { path: oldPath } }) => oldPath));
  return files.filter(file => !(file.status === FILE_STATUS.REMOVED && movedAway.has(file.path)));
}

function formatWholeFileAsDiff(repository, relative) {
  const lines = fs.readFileSync(joinFilesystemPath(repository, relative), "utf8").split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return `diff --git a/${relative} b/${relative}\nnew file mode 100644\n@@ -0,0 +1,${lines.length} @@\n${lines.map(line => "+" + line).join("\n")}`;
}

function formatNamedFilesAsDiff(repository, given) {
  const fileDiffs = [];
  const walk = directory => {
    for (const child of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (child.isDirectory()) { if (!child.name.startsWith(".")) walk(path.join(directory, child.name)); }
      else fileDiffs.push(formatWholeFileAsDiff(repository, convertToRepositoryPath(path.relative(repository, path.join(directory, child.name)))));
    }
  };
  for (const name of given) {
    const absolute = path.join(repository, name);
    let stats;
    try { stats = fs.statSync(absolute); } catch { continue; }
    if (stats.isDirectory()) walk(absolute);
    else if (stats.isFile()) fileDiffs.push(formatWholeFileAsDiff(repository, convertToRepositoryPath(path.relative(repository, absolute))));
  }
  return fileDiffs.join("\n");
}

const isExcluded = (filePath, excluded) =>
  excluded.some(prefix => filePath === prefix || filePath.startsWith(prefix.replace(/\/+$/, "") + "/"));

function chooseTheModeFor(repository, files, treeReason) {
  if (!repository) return { mode: CHANGE_MODES.PATCH, reason: "no tree was given" };
  if (!fs.existsSync(path.join(repository, ".git"))) return { mode: CHANGE_MODES.PATCH, reason: "the target is not a git working tree" };
  const missing = files.filter(file => file.existsAfterTheChange && !fs.existsSync(joinFilesystemPath(repository, file.path)));
  if (missing.length) return { mode: CHANGE_MODES.PATCH, reason: `${missing.length} path(s) of the change are not in the tree` };
  return { mode: CHANGE_MODES.REPOSITORY, reason: treeReason || "the tree holds every path of the change" };
}

export class ChangeReader {
  constructor(repository, diffText, excluded, treeReason = null) {
    const parsed = parseDiff(diffText);
    this.repository = repository;
    this.excluded = parsed.filter(file => isExcluded(file.path, excluded)).map(file => file.path);
    this.files = parsed.filter(file => !this.excluded.includes(file.path));
    const { mode, reason } = chooseTheModeFor(repository, this.files, treeReason);
    this.mode = mode;
    this.modeReason = reason;
    this.namesWholeFiles = false;
    this.readTheWholeFiles();
  }

  static createFromRevisions(repository, revisions, namedFiles, excluded, headTree = null) {
    const text = runWithDiffDrivers(driverArgs => {
      const args = [...driverArgs, "diff", "-U0", "--no-color", "--find-renames"];
      if (revisions) args.push(revisions);
      if (namedFiles.length) args.push("--", ...namedFiles);
      return readGitOutputOrFail(args, repository);
    });
    return headTree ? new ChangeReader(headTree.folder, text, excluded, headTree.reason) : new ChangeReader(repository, text, excluded);
  }

  static createFromNamedFiles(repository, namedFiles, excluded) {
    const reader = new ChangeReader(repository, formatNamedFilesAsDiff(repository, namedFiles), excluded);
    reader.namesWholeFiles = true;
    return reader;
  }

  static createFromPatch(patchFile, repository, excluded) {
    const reader = new ChangeReader(repository, fs.readFileSync(patchFile, "utf8"), excluded);
    reader.files = pairUnnamedMoves(reader.files);
    return reader;
  }

  static readBackFrom(saved) {
    const reader = Object.create(ChangeReader.prototype);
    Object.assign(reader, {
      repository: saved.repository,
      excluded: [...saved.excluded],
      files: saved.files.map(ChangedFile.createFromJSON),
      mode: saved.mode,
      modeReason: saved.modeReason,
      namesWholeFiles: saved.namesWholeFiles,
    });
    reader.readTheWholeFiles();
    return reader;
  }

  toJSON() {
    return {
      repository: this.repository,
      excluded: this.excluded,
      mode: this.mode,
      modeReason: this.modeReason,
      namesWholeFiles: this.namesWholeFiles,
      files: this.files.map(file => file.toJSON()),
    };
  }

  readTheWholeFiles() {
    if (this.mode === CHANGE_MODES.REPOSITORY) for (const file of this.files) file.lines = this.readFileLines(file.path);
  }

  readAddedLinesByPath() {
    return new Map(this.files.map(file => [file.path, file.collectAddedLineNumbers()]));
  }

  readFileLines(relative) {
    if (!this.repository) return null;
    try { return fs.readFileSync(joinFilesystemPath(this.repository, relative), "utf8").split(/\r?\n/); } catch { return null; }
  }

  get hunkCount() {
    return this.files.reduce((total, file) => total + file.hunks.length, 0);
  }

  get target() {
    return this.repository ? resolveAbsolutePath(this.repository) : null;
  }
}
