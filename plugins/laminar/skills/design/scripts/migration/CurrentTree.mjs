import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Folders that hold installed packages or build output in the common stacks (npm, Maven, Gradle, most bundlers), never the source a rename changes.
const FOLDERS_OF_NO_SOURCE = new Set(["node_modules", "target", "build", "dist"]);

const LARGEST_SOURCE_BYTES = 1024 * 1024;

const LARGEST_GIT_OUTPUT_BYTES = 1024 * 1024 * 1024;

const NO_TEXT_MARK = "\0";

// A line that brings a name of another file into scope: import in Java, Kotlin, Scala, Swift, JavaScript, TypeScript and Python, from in Python, use in Rust and PHP.
const IMPORT_LINE = /^\s*(?:import|from|use)\s/;

const TREE_LINE = /^\S+ (\S+) \S+ +(\S+)\t([\s\S]*)$/;

const BLOB = "blob";

export class CurrentTreeStop extends Error {}

const isAWordIn = (text, word) => new RegExp(`(^|[^\\w$])${word.replace(/[$]/g, "\\$")}([^\\w$]|$)`).test(text);

const isASourcePath = file => !file.split("/").some(isNoSourceName);

const readSourceText = text => (text !== null && !text.includes(NO_TEXT_MARK) ? text : null);

const runGit = (repositoryRoot, words, input = undefined) => {
  const run = spawnSync("git", ["-C", repositoryRoot, ...words], { input, maxBuffer: LARGEST_GIT_OUTPUT_BYTES });
  if (run.status !== 0) throw new CurrentTreeStop(`current tree: git ${words[0]} failed in ${repositoryRoot}: ${String(run.stderr || run.error?.message || "").trim()}`);
  return run.stdout;
};

const listWorkingTreeFiles = (repositoryRoot, folder, isSkipped) => fs.readdirSync(path.join(repositoryRoot, folder), { withFileTypes: true }).flatMap(child => {
  const childFile = folder ? `${folder}/${child.name}` : child.name;
  if (isSkipped(child.name)) return [];
  if (child.isDirectory()) return listWorkingTreeFiles(repositoryRoot, childFile, isSkipped);
  return child.isFile() ? [childFile] : [];
});

const isNoSourceName = name => name.startsWith(".") || FOLDERS_OF_NO_SOURCE.has(name);

class WorkingTreeSource {
  constructor(repositoryRoot) {
    this.repositoryRoot = repositoryRoot;
    this.label = repositoryRoot;
  }

  listSourceFiles() {
    return listWorkingTreeFiles(this.repositoryRoot, "", isNoSourceName);
  }

  holdsTheFile(file) {
    const filePath = path.join(this.repositoryRoot, file);
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  }

  holdsThePath(treePath) {
    return fs.existsSync(path.join(this.repositoryRoot, treePath));
  }

  listFilesUnder(folder) {
    const folderPath = path.join(this.repositoryRoot, folder);
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) return [];
    return listWorkingTreeFiles(this.repositoryRoot, folder.replace(/\/+$/, ""), () => false);
  }

  readFileText(file) {
    if (!this.holdsTheFile(file) || fs.statSync(path.join(this.repositoryRoot, file)).size > LARGEST_SOURCE_BYTES) return null;
    return fs.readFileSync(path.join(this.repositoryRoot, file), "utf8");
  }

  readFileTexts(files) {
    return new Map(files.map(file => [file, this.readFileText(file)]));
  }
}

const readTreeBlobs = (repositoryRoot, commit) => runGit(repositoryRoot, ["ls-tree", "-r", "-l", "-z", commit]).toString("utf8").split("\0").filter(Boolean).flatMap(line => {
  const blob = TREE_LINE.exec(line);
  return blob && blob[1] === BLOB ? [{ file: blob[3], size: Number(blob[2]) }] : [];
});

// Reads every given file of the commit in 1 git call, because a search for a word reads the whole tree.
const readBlobTexts = (repositoryRoot, commit, files) => {
  const textOfFileMap = new Map();
  if (!files.length) return textOfFileMap;

  const output = runGit(repositoryRoot, ["cat-file", "--batch"], files.map(file => `${commit}:${file}\n`).join(""));
  let at = 0;
  for (const file of files) {
    const headEnd = output.indexOf(10, at);
    const head = output.subarray(at, headEnd).toString("utf8").split(" ");
    if (head[1] !== BLOB) {
      textOfFileMap.set(file, null);
      at = headEnd + 1;
      continue;
    }
    const size = Number(head[2]);
    textOfFileMap.set(file, output.subarray(headEnd + 1, headEnd + 1 + size).toString("utf8"));
    at = headEnd + 1 + size + 1;
  }
  return textOfFileMap;
};

class CommitSource {
  constructor(repositoryRoot, commit) {
    this.repositoryRoot = repositoryRoot;
    this.commit = runGit(repositoryRoot, ["rev-parse", "--verify", `${commit}^{commit}`]).toString("utf8").trim();
    this.label = `${repositoryRoot} at the base commit ${this.commit}`;
    this.sizeOfFileMap = new Map(readTreeBlobs(repositoryRoot, this.commit).map(({ file, size }) => [file, size]));
  }

  listSourceFiles() {
    return [...this.sizeOfFileMap.keys()].filter(isASourcePath);
  }

  holdsTheFile(file) {
    return this.sizeOfFileMap.has(path.posix.normalize(file));
  }

  holdsThePath(treePath) {
    const normalized = path.posix.normalize(treePath).replace(/\/+$/, "");
    return this.holdsTheFile(normalized) || this.listFilesUnder(normalized).length > 0;
  }

  listFilesUnder(folder) {
    const folderPrefix = `${path.posix.normalize(folder).replace(/\/+$/, "")}/`;
    return [...this.sizeOfFileMap.keys()].filter(file => file.startsWith(folderPrefix));
  }

  readFileTexts(files) {
    const readable = files.filter(file => (this.sizeOfFileMap.get(path.posix.normalize(file)) ?? Infinity) <= LARGEST_SOURCE_BYTES);
    const textOfFileMap = readBlobTexts(this.repositoryRoot, this.commit, readable.map(file => path.posix.normalize(file)));
    return new Map(files.map(file => [file, textOfFileMap.get(path.posix.normalize(file)) ?? null]));
  }

  readFileText(file) {
    return this.readFileTexts([file]).get(file);
  }
}

class CurrentTree {
  constructor(source) {
    this.source = source;
    this.files = source.listSourceFiles();
    this.textOfFileMap = new Map();
    this.isEveryFileRead = false;
  }

  describe() {
    return this.source.label;
  }

  holdsTheFile(file) {
    return this.source.holdsTheFile(file);
  }

  holdsThePath(treePath) {
    return this.source.holdsThePath(treePath);
  }

  listFilesUnder(folder) {
    return this.source.listFilesUnder(folder);
  }

  readFileText(file) {
    if (!this.textOfFileMap.has(file)) this.textOfFileMap.set(file, readSourceText(this.source.readFileText(file)));
    return this.textOfFileMap.get(file);
  }

  readEveryFileText() {
    if (this.isEveryFileRead) return;

    const unreadFiles = this.files.filter(file => !this.textOfFileMap.has(file));
    for (const [file, text] of this.source.readFileTexts(unreadFiles)) this.textOfFileMap.set(file, readSourceText(text));
    this.isEveryFileRead = true;
  }

  holdsTheWord(file, word) {
    const text = this.readFileText(file);
    return text !== null && isAWordIn(text, word);
  }

  listFilesThatHoldEveryWord(words) {
    this.readEveryFileText();
    return this.files.filter(file => words.every(word => this.holdsTheWord(file, word)));
  }

  listParameterTextsOf(file, methodName) {
    const text = this.readFileText(file);
    if (text === null) return [];
    const parameterLists = new RegExp(`(?:^|[^\\w$])${methodName.replace(/[$]/g, "\\$")}\\s*\\(([^()]*)\\)`, "g");
    return [...text.matchAll(parameterLists)].map(match => match[1]);
  }

  holdsTheSignature(file, method) {
    const parameters = Array.isArray(method.parameters) ? method.parameters : [];
    return this.listParameterTextsOf(file, method.name).some(parameterText => {
      const parameterTexts = parameterText.split(",").map(text => text.trim()).filter(Boolean);
      return parameterTexts.length === parameters.length && parameters.every(parameter => isAWordIn(parameterText, parameter.name));
    });
  }

  listFilesThatImport(word) {
    this.readEveryFileText();
    return this.files.filter(file => {
      const text = this.readFileText(file);
      return text !== null && text.split("\n").some(line => IMPORT_LINE.test(line) && isAWordIn(line, word));
    });
  }
}

// The tree before the change: the working folder, or, where a base commit is given, that commit, so the files a writer already changed are never read as the current tree.
export const readCurrentTree = (repositoryRoot, baseCommit = null) => new CurrentTree(baseCommit ? new CommitSource(repositoryRoot, baseCommit) : new WorkingTreeSource(repositoryRoot));
