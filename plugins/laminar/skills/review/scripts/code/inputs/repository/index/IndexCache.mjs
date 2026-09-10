import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import v8 from "node:v8";
import zlib from "node:zlib";
import { readGitOutput } from "../GitCommands.mjs";
import { joinFilesystemPath } from "../../../../files/paths.mjs";
import { readSourcesInFolders } from "../../../../files/scriptSources.mjs";

export const INDEX_FORMAT = 2;
export const MAX_SAVED_INDEXES = 64;

const SAVED_ENDING = ".index";
const FOLDERS_THE_INDEX_HOLDS = ["code", "files", "collections"];

export const INDEX_SECTION = "index";

const computeSha256 = hashedValues => {
  const hash = crypto.createHash("sha256");
  for (const hashedValue of hashedValues) hash.update(String(hashedValue)).update("\u0000");
  return hash.digest("hex");
};

let cachedStamp = null;

export function readFormatStamp() {
  if (cachedStamp === null) cachedStamp = computeSha256([INDEX_FORMAT, process.versions.v8, ...readSourcesInFolders(FOLDERS_THE_INDEX_HOLDS)]);
  return cachedStamp;
}

export function readUserCacheRoot() {
  if (process.platform === "win32") return process.env.LOCALAPPDATA || os.tmpdir();
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Caches");
  return process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
}

export const readDefaultCacheFolder = () => path.join(readUserCacheRoot(), "laminar-review", "source-index");

const computeContentHash = (repository, given) => {
  try { return crypto.createHash("sha256").update(fs.readFileSync(joinFilesystemPath(repository, given))).digest("hex"); } catch { return "absent"; }
};

const STATUS_WIDTH = 3;

const MOVE_STATUS_PATTERN = /[RC]/;

const parseChangedPaths = porcelain => {
  const statusFields = porcelain.split("\u0000").filter(Boolean);
  const paths = [];
  for (let at = 0; at < statusFields.length; at++) {
    const status = statusFields[at].slice(0, STATUS_WIDTH - 1);
    paths.push(statusFields[at].slice(STATUS_WIDTH));
    if (MOVE_STATUS_PATTERN.test(status) && at + 1 < statusFields.length) paths.push(statusFields[++at]);
  }
  return [...new Set(paths)].sort();
};

export function findTreeKeyWithLocalChanges(repository) {
  const tree = readGitOutput(["rev-parse", "--verify", "--quiet", "HEAD^{tree}"], repository);
  const differing = readGitOutput(["--no-optional-locks", "status", "--porcelain=v1", "-z", "--untracked-files=no"], repository);
  if (!tree || differing === null) return null;
  const localChanges = parseChangedPaths(differing).map(given => `${given}\u0001${computeContentHash(repository, given)}`);
  return computeSha256([tree.trim(), ...localChanges]);
}

const isInside = (folder, outer) => {
  const relative = path.relative(path.resolve(outer), path.resolve(folder));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

export class IndexCache {
  constructor(repository, folder = readDefaultCacheFolder()) {
    this.folder = folder;
    this.treeKey = folder && !isInside(folder, repository) ? findTreeKeyWithLocalChanges(repository) : null;
    this.use = { folder, read: [], built: [] };
    this.useBySectionMap = new Map();
  }

  useOf(section) {
    if (section === INDEX_SECTION) return this.use;
    if (!this.useBySectionMap.has(section)) this.useBySectionMap.set(section, { folder: this.folder, read: [], built: [] });
    return this.useBySectionMap.get(section);
  }

  computeKey(family, paths, section = INDEX_SECTION) {
    const named = section === INDEX_SECTION ? family : `${section}\u0000${family}`;
    return computeSha256([readFormatStamp(), this.treeKey, named, ...paths]);
  }

  resolveFile(key) {
    return path.join(this.folder, `${key.slice(0, 40)}${SAVED_ENDING}`);
  }

  read(family, paths, section = INDEX_SECTION) {
    if (!this.treeKey) return null;
    const key = this.computeKey(family, paths, section);
    try {
      const file = this.resolveFile(key);
      const saved = v8.deserialize(zlib.gunzipSync(fs.readFileSync(file)));
      if (saved.key !== key || !saved.index) return null;
      const now = new Date();
      fs.utimesSync(file, now, now);
      this.useOf(section).read.push(family);
      return saved.index;
    } catch { return null; }
  }

  write(family, paths, savedIndex, section = INDEX_SECTION) {
    this.useOf(section).built.push(family);
    if (!this.treeKey) return;
    const key = this.computeKey(family, paths, section);
    try {
      fs.mkdirSync(this.folder, { recursive: true });
      const file = this.resolveFile(key);
      const written = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}`;
      fs.writeFileSync(written, zlib.gzipSync(v8.serialize({ key, index: savedIndex() }), { level: 1 }));
      fs.renameSync(written, file);
      this.prune();
    } catch { return; }
  }

  prune() {
    const saved = fs.readdirSync(this.folder)
      .filter(name => name.endsWith(SAVED_ENDING))
      .map(name => { try { return { file: path.join(this.folder, name), used: fs.statSync(path.join(this.folder, name)).mtimeMs }; } catch { return null; } })
      .filter(Boolean)
      .sort((left, right) => right.used - left.used);
    for (const { file } of saved.slice(MAX_SAVED_INDEXES)) fs.rmSync(file, { force: true });
  }
}
