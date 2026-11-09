import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SAVED_ENDING = ".json";

const isFresh = (file, now, lifetimeMs) => {
  try { return now - fs.statSync(file).mtimeMs < lifetimeMs; } catch { return false; }
};

export class SavedByKey {
  constructor(folder, { lifetimeMs, maxFiles, pruneOnWrite = true, refreshOnRead = false }) {
    this.folder = folder;
    this.lifetimeMs = lifetimeMs;
    this.maxFiles = maxFiles;
    this.pruneOnWrite = pruneOnWrite;
    this.refreshOnRead = refreshOnRead;
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
      if (saved.key !== key) return null;
      if (this.refreshOnRead) this.refresh(file);
      return saved.value;
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
      if (this.pruneOnWrite) this.prune();
    } catch { return; }
  }

  refresh(file) {
    try { const now = new Date(); fs.utimesSync(file, now, now); } catch { return; }
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
