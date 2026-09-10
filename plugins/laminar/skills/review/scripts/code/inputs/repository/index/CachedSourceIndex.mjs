import { IndexCache } from "./IndexCache.mjs";
import { FamilyFiles } from "./FamilyFiles.mjs";
import { readTextOf } from "../RepositoryFiles.mjs";
import { SourceIndex } from "./SourceIndex.mjs";

export class CachedSourceIndex {
  constructor(repository, { cacheFolder } = {}) {
    this.repository = repository;
    this.cacheFolder = cacheFolder;
  }

  readIndexCache() {
    if (!this.cachedIndexCache) this.cachedIndexCache = new IndexCache(this.repository, this.cacheFolder);
    return this.cachedIndexCache;
  }

  readSourceIndex() {
    if (!this.cachedIndex) this.cachedIndex = new SourceIndex(this.repository, (family, paths) => this.readOrBuildFamilyFiles(family, paths));
    return this.cachedIndex;
  }

  readOrBuildFamilyFiles(family, paths) {
    const cache = this.readIndexCache();
    const saved = cache.read(family, paths);
    if (saved) return FamilyFiles.createFromSaved(saved);
    const built = FamilyFiles.buildFamilyFiles(family, paths, given => readTextOf(this.repository, given));
    cache.write(family, paths, () => built.convertToSaved());
    return built;
  }

  findFamilyFiles(family) {
    return this.readSourceIndex().findFamilyFiles(family);
  }

  readIndexUse() {
    return this.cachedIndex ? this.readIndexCache().use : null;
  }
}
