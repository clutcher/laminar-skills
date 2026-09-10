import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readUserCacheRoot } from "../../../code/index.mjs";
import { readSourcesInFolders } from "../../../files/scriptSources.mjs";
import { findAgentFile } from "../../../checks/CheckText.mjs";
import { parseRules } from "./IoRules.mjs";

export const IO_RULE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_SAVED_RULE_FILES = 64;

const SAVED_ENDING = ".json";
const FOLDERS_THE_RULES_REST_ON = ["code", "review/prepare", "files", "checks", "collections"];
const SCREEN_AGENT_FILE = findAgentFile("screen-io");

export const resolveDefaultRuleFolder = () => path.join(readUserCacheRoot(), "laminar-review", "io-rules");

const computeSha256 = hashedValues => {
  const hash = crypto.createHash("sha256");
  for (const hashedValue of hashedValues) hash.update(String(hashedValue)).update("\u0000");
  return hash.digest("hex");
};

const readScreenAgentText = () => { try { return fs.readFileSync(SCREEN_AGENT_FILE, "utf8"); } catch { return ""; } };

let cachedStamp = null;

const computeScriptStamp = () => {
  if (cachedStamp === null) cachedStamp = computeSha256([...readSourcesInFolders(FOLDERS_THE_RULES_REST_ON), readScreenAgentText()]);
  return cachedStamp;
};

export function createRuleKey(dependencies) {
  const given = dependencies || {};
  if (!given.identity) return "";
  return computeSha256([computeScriptStamp(), given.identity, ...(given.files || []).map(file => `${file.path}:${file.sha256}`)]);
}

const isFresh = (file, now, lifetimeMs) => {
  try { return now - fs.statSync(file).mtimeMs < lifetimeMs; } catch { return false; }
};

class SavedByKey {
  constructor(folder, { lifetimeMs, maxFiles }) {
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
      return saved.key === key ? saved.value : null;
    } catch { return null; }
  }

  write(key, value) {
    if (!key || !this.folder) return;
    try {
      fs.mkdirSync(this.folder, { recursive: true });
      const file = this.resolveFile(key);
      const written = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}`;
      fs.writeFileSync(written, JSON.stringify({ key, value }));
      fs.renameSync(written, file);
      this.prune();
    } catch { return; }
  }

  prune() {
    const now = Date.now();
    const saved = fs.readdirSync(this.folder)
      .filter(name => name.endsWith(SAVED_ENDING))
      .map(name => path.join(this.folder, name))
      .map(file => { try { return { file, used: fs.statSync(file).mtimeMs }; } catch { return null; } })
      .filter(Boolean)
      .sort((left, right) => right.used - left.used);
    for (const { file, used } of saved) if (now - used >= this.lifetimeMs) fs.rmSync(file, { force: true });
    for (const { file } of saved.slice(this.maxFiles)) fs.rmSync(file, { force: true });
  }
}

export class IoRuleCache {
  constructor(folder = resolveDefaultRuleFolder()) {
    this.saved = new SavedByKey(folder, { lifetimeMs: IO_RULE_LIFETIME_MS, maxFiles: MAX_SAVED_RULE_FILES });
  }

  read(key) {
    const savedRules = this.saved.read(key);
    return Array.isArray(savedRules) ? parseRules(savedRules).rules : null;
  }

  write(key, rules) {
    if (!rules.length) return;
    this.saved.write(key, rules.map(({ on, callee, answer }) => ({ on, callee, answer })));
  }
}
