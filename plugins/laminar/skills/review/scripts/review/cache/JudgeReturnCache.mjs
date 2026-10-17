import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readUserCacheRoot } from "../../code/index.mjs";
import { findAgentFile } from "../../checks/CheckText.mjs";
import { scriptsFolder } from "../../files/scriptSources.mjs";
import { resolveAbsolutePath } from "../../files/paths.mjs";
import { readJsonFile, writeJsonFile } from "../../files/jsonFile.mjs";

export const JUDGE_RETURN_FORMAT = 1;
export const JUDGE_RETURN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_SAVED_JUDGE_RETURNS = 4096;
export const JUDGE_CACHE_FILE = "judge-cache.json";

const SAVED_ENDING = ".json";
const JUDGE_WORKFLOW_FILE = path.join(scriptsFolder, "..", "..", "..", "workflows", "review-judge.js");
const RUN_FOLDER_MARK = "<run>";
const REPOSITORY_MARK = "<repo>";
const OWN_ID_MARK = "<id>";
const NAMED_PATH_PATTERN = /(?:[A-Za-z]:)?[\w@.+-]*(?:\/[\w@.+-]+)+/g;

export const resolveDefaultJudgeReturnFolder = () => path.join(readUserCacheRoot(), "laminar-review", "judge-returns");

const computeSha256 = hashedValues => {
  const hash = crypto.createHash("sha256");
  for (const hashedValue of hashedValues) hash.update(String(hashedValue)).update("\u0000");
  return hash.digest("hex");
};

const readTextOrNothing = file => { try { return fs.readFileSync(file, "utf8"); } catch { return ""; } };

const isAFile = file => { try { return fs.statSync(file).isFile(); } catch { return false; } };

const isInsideFolder = (file, folder) => Boolean(folder) && (file === folder || file.startsWith(`${folder}/`));

const escapeForPattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stampsByJudgeTypeMap = new Map();

const readJudgeStamp = judgeType => {
  if (!stampsByJudgeTypeMap.has(judgeType)) stampsByJudgeTypeMap.set(judgeType, computeSha256([JUDGE_RETURN_FORMAT, readTextOrNothing(findAgentFile(judgeType)), readTextOrNothing(JUDGE_WORKFLOW_FILE)]));
  return stampsByJudgeTypeMap.get(judgeType);
};

export class JudgeReturnKeys {
  constructor(runFolder, repositoryRoot) {
    this.runFolder = resolveAbsolutePath(runFolder);
    this.repositoryRoot = repositoryRoot ? resolveAbsolutePath(repositoryRoot) : "";
  }

  replaceTheRoots(text) {
    const roots = [[this.runFolder, RUN_FOLDER_MARK], [this.repositoryRoot, REPOSITORY_MARK]]
      .filter(([root]) => root)
      .sort(([left], [right]) => right.length - left.length);
    return roots.reduce((replaced, [root, mark]) => replaced.split(root).join(mark), text);
  }

  replaceTheOwnId(text, codeUnderReviewId) {
    return text.replace(new RegExp(`\\b${escapeForPattern(codeUnderReviewId)}\\b`, "g"), OWN_ID_MARK);
  }

  resolveNamedFile(named) {
    const absolute = path.isAbsolute(named) ? resolveAbsolutePath(named) : this.repositoryRoot ? resolveAbsolutePath(path.join(this.repositoryRoot, named)) : "";
    return absolute && isAFile(absolute) ? absolute : "";
  }

  readNamedFileHash(file) {
    if (isInsideFolder(file, this.runFolder)) return computeSha256([this.replaceTheRoots(readTextOrNothing(file))]);
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  }

  listNamedFileHashes(text) {
    const files = [...new Set((text.match(NAMED_PATH_PATTERN) || []).map(named => this.resolveNamedFile(named)).filter(Boolean))].sort();
    return files.flatMap(file => [this.replaceTheRoots(file), this.readNamedFileHash(file)]);
  }

  createKey(codeUnderReview, file) {
    const text = readTextOrNothing(path.join(this.runFolder, file));
    if (!text) return "";
    const comparable = this.replaceTheOwnId(this.replaceTheRoots(text), codeUnderReview.id);
    return computeSha256([readJudgeStamp(codeUnderReview.judgeType), codeUnderReview.judgeType, comparable, ...this.listNamedFileHashes(text)]);
  }
}

const isFresh = (file, now, lifetimeMs) => {
  try { return now - fs.statSync(file).mtimeMs < lifetimeMs; } catch { return false; }
};

export class JudgeReturnCache {
  constructor(folder = resolveDefaultJudgeReturnFolder(), { lifetimeMs = JUDGE_RETURN_LIFETIME_MS, maxFiles = MAX_SAVED_JUDGE_RETURNS } = {}) {
    this.folder = folder;
    this.lifetimeMs = lifetimeMs;
    this.maxFiles = maxFiles;
  }

  resolveFile(key) {
    return path.join(this.folder, `${key.slice(0, 40)}${SAVED_ENDING}`);
  }

  read(key) {
    if (!key || !this.folder) return null;
    const file = this.resolveFile(key);
    if (!isFresh(file, Date.now(), this.lifetimeMs)) return null;
    try {
      const saved = JSON.parse(fs.readFileSync(file, "utf8"));
      return saved.key === key && saved.returnsByTail && typeof saved.returnsByTail === "object" ? saved.returnsByTail : null;
    } catch { return null; }
  }

  write(key, tail, returned) {
    if (!key || !tail || !this.folder) return;
    try {
      fs.mkdirSync(this.folder, { recursive: true });
      const file = this.resolveFile(key);
      const written = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}`;
      fs.writeFileSync(written, JSON.stringify({ key, returnsByTail: { ...(this.read(key) || {}), [tail]: returned } }));
      fs.renameSync(written, file);
    } catch { return; }
  }

  prune() {
    try {
      const now = Date.now();
      const saved = fs.readdirSync(this.folder)
        .filter(name => name.endsWith(SAVED_ENDING))
        .map(name => path.join(this.folder, name))
        .map(file => { try { return { file, used: fs.statSync(file).mtimeMs }; } catch { return null; } })
        .filter(Boolean)
        .sort((left, right) => right.used - left.used);
      for (const { file, used } of saved) if (now - used >= this.lifetimeMs) fs.rmSync(file, { force: true });
      for (const { file } of saved.slice(this.maxFiles)) fs.rmSync(file, { force: true });
    } catch { return; }
  }
}

const THE_ID = "{id}";
const THE_JUDGE_TYPE = "{judgeType}";

const resolveCodeUnderReviewFile = (fileForm, codeUnderReview) => fileForm.replace(THE_ID, codeUnderReview.id).replace(THE_JUDGE_TYPE, codeUnderReview.judgeType);

export function findSavedJudgeReturns(runFolder, everyCodeUnderReview, { fileForm, repositoryRoot = "", cache = new JudgeReturnCache(), readTheCache = true } = {}) {
  const keys = new JudgeReturnKeys(runFolder, repositoryRoot);
  const unitsById = {};
  const savedTailsById = {};
  for (const codeUnderReview of everyCodeUnderReview) {
    const key = keys.createKey(codeUnderReview, resolveCodeUnderReviewFile(fileForm, codeUnderReview));
    const saved = readTheCache && key ? cache.read(key) : null;
    unitsById[codeUnderReview.id] = { key, ...(saved ? { saved } : {}) };
    if (saved) savedTailsById[codeUnderReview.id] = Object.keys(saved);
  }
  writeJsonFile(path.join(runFolder, JUDGE_CACHE_FILE), unitsById);
  return savedTailsById;
}

const stampedWith = (returnedItems, codeUnderReviewId) => (returnedItems || []).map(returnedItem => ({ ...returnedItem, codeUnderReviewId }));

const unstampedOf = (returnedItems, codeUnderReviewId) => (returnedItems || [])
  .filter(returnedItem => returnedItem.codeUnderReviewId === codeUnderReviewId)
  .map(({ codeUnderReviewId: unused, ...returnedItem }) => returnedItem);

const readCalls = calls => (Array.isArray(calls) ? calls : []).filter(call => Array.isArray(call) && call.length === 2 && call.every(field => typeof field === "string" && field));

export class JudgeCacheUse {
  constructor(runFolder, { cache = new JudgeReturnCache() } = {}) {
    const file = path.join(runFolder, JUDGE_CACHE_FILE);
    this.unitsById = isAFile(file) ? readJsonFile(file) : {};
    this.cache = cache;
  }

  addTheSavedReturns(returned) {
    const answered = readCalls((returned.judgeCache || {}).hits)
      .map(([codeUnderReviewId, tail]) => [codeUnderReviewId, ((this.unitsById[codeUnderReviewId] || {}).saved || {})[tail]])
      .filter(([, saved]) => saved);
    return {
      ...returned,
      findings: [...(returned.findings || []), ...answered.flatMap(([codeUnderReviewId, saved]) => stampedWith(saved.findings, codeUnderReviewId))],
      covered: [...(returned.covered || []), ...answered.flatMap(([codeUnderReviewId, saved]) => stampedWith(saved.covered, codeUnderReviewId))],
    };
  }

  keepTheFreshReturns(returned) {
    const fresh = readCalls((returned.judgeCache || {}).fresh);
    for (const [codeUnderReviewId, tail] of fresh) {
      const key = (this.unitsById[codeUnderReviewId] || {}).key;
      this.cache.write(key, tail, { findings: unstampedOf(returned.findings, codeUnderReviewId), covered: unstampedOf(returned.covered, codeUnderReviewId) });
    }
    if (fresh.length) this.cache.prune();
  }
}
