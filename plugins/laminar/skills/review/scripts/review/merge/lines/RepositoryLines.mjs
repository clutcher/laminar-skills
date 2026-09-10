import { readRepositoryFileLines } from "../../../code/index.mjs";
import { stripLeadingDotSlash } from "../abstractions/AbstractionsAtPlaces.mjs";

export class RepositoryLines {
  constructor(repository) {
    this.repository = repository;
    this.linesByFileMap = new Map();
  }

  holdsARepository() {
    return Boolean(this.repository);
  }

  readFileLines(file) {
    const relative = stripLeadingDotSlash(file);
    if (!this.linesByFileMap.has(relative)) this.linesByFileMap.set(relative, readRepositoryFileLines(this.repository, relative));
    return this.linesByFileMap.get(relative);
  }
}
