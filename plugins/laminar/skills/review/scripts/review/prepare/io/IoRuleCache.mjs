import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readUserCacheRoot } from "../../../code/index.mjs";
import { readSourcesInFolders } from "../../../files/scriptSources.mjs";
import { findAgentFile } from "../../../checks/CheckText.mjs";
import { parseRules } from "./IoRules.mjs";
import { SavedByKey } from "../../cache/SavedByKey.mjs";

export const IO_RULE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_SAVED_RULE_FILES = 64;

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
