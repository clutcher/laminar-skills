import { findDiffDriver, readFamilyOfLanguage } from "../../inputs/source/Languages.mjs";

const contextByLanguageMap = new Map();

const listNames = frameworks => [...new Set(frameworks.map(framework => (typeof framework === "string" ? framework : framework.name)))].sort();

export class FinderContext {
  constructor({ language = null, frameworks = [], file = null } = {}) {
    this.language = language || null;
    this.family = readFamilyOfLanguage(this.language);
    this.frameworks = Object.freeze(listNames(frameworks));
    this.file = file;
    this.key = [this.language, this.frameworks.join(","), this.language ? "" : this.file].join("|");
    Object.freeze(this);
  }

  static createForLanguage(language) {
    const key = language || null;
    if (!contextByLanguageMap.has(key)) contextByLanguageMap.set(key, new FinderContext({ language: key }));
    return contextByLanguageMap.get(key);
  }

  static createForFile(filePath, frameworks = []) {
    return new FinderContext({ language: findDiffDriver(filePath), frameworks, file: filePath });
  }

  static createForAWalkedFile(filePath, markedFrameworks, applications) {
    return FinderContext.createForFile(filePath, applications.listFrameworksFor(filePath, markedFrameworks));
  }

  speaks(strategy) {
    if (strategy.family) return strategy.family === this.family;
    return strategy.language !== null && strategy.language === this.language;
  }

  admits(strategy) {
    return this.speaks(strategy) && (!strategy.framework || this.frameworks.includes(strategy.framework));
  }
}
