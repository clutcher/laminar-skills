import { Scale } from "../../graph/abstractions/Scale.mjs";

export const PUBLIC_CHANGE_KINDS = Object.freeze({ UNCHANGED: "unchanged", MOVED: "moved", MODIFIED: "modified", CREATED: "created" });

const SCALES_THAT_HOLD_A_PLACE = Object.freeze([Scale.METHOD.name, Scale.CLASS.name]);

const lengthOfSpan = declaration => declaration.to - declaration.from;

const holdsTheLine = (declaration, line) => declaration.from <= line && line <= declaration.to;

const findTheSmallestHolding = (declarations, scale, line) => declarations
  .filter(declaration => declaration.scale === scale && holdsTheLine(declaration, line))
  .sort((left, right) => lengthOfSpan(left) - lengthOfSpan(right))[0] || null;

const stripLeadingDotSlash = given => String(given || "").replace(/^\.\//, "");

const stripTrailingSlash = given => given.replace(/\/+$/, "");

const isTheChildOfTheFolder = (listedPath, folder, named) => listedPath === named
  || listedPath === `${folder}/${named}`
  || (listedPath.startsWith(`${folder}/`) && listedPath.endsWith(`/${named}`));

const indexByPath =entries => new Map(entries.map(entry => [entry.path, entry]));

export class PublicChangeKinds {
  constructor({ kindBase = null, files = [], folders = [], applications = [], renames = [] } = {}) {
    Object.assign(this, { kindBase, files, folders, applications, renames });
    this.filesByPathMap = indexByPath(files);
    this.foldersByPathMap = indexByPath(folders);
    this.applicationsByPathMap = indexByPath(applications);
  }

  readKindOfTheFile(filePath) {
    const file = this.filesByPathMap.get(stripLeadingDotSlash(filePath));
    return file ? file.kind : PUBLIC_CHANGE_KINDS.UNCHANGED;
  }

  readKindOfTheFolder(folder) {
    const found = this.foldersByPathMap.get(stripLeadingDotSlash(folder));
    return found ? found.kind : PUBLIC_CHANGE_KINDS.UNCHANGED;
  }

  readKindOfTheApplication(folder) {
    const found = this.applicationsByPathMap.get(stripLeadingDotSlash(folder));
    return found ? found.kind : PUBLIC_CHANGE_KINDS.UNCHANGED;
  }

  readKindOfTheChildOfTheFolder(folder, child) {
    const named = stripTrailingSlash(stripLeadingDotSlash(child));
    const found = [...this.files, ...this.folders].find(listed => isTheChildOfTheFolder(listed.path, folder, named));
    return found ? found.kind : PUBLIC_CHANGE_KINDS.UNCHANGED;
  }

  holdsAnyKind() {
    return this.files.length > 0 || this.folders.length > 0;
  }

  readKindAtThePlace(filePath, line) {
    const file = this.filesByPathMap.get(stripLeadingDotSlash(filePath));
    if (!file) return this.readKindOfTheFolder(stripTrailingSlash(stripLeadingDotSlash(filePath)));
    for (const scale of SCALES_THAT_HOLD_A_PLACE) {
      const holding = findTheSmallestHolding(file.declarations, scale, Number(line));
      if (holding) return holding.kind;
    }
    return file.kind;
  }

  readKindAtTheScale(scale, filePath, line) {
    if (scale === Scale.APPLICATION.name) return this.readKindOfTheApplication(filePath);
    if (scale === Scale.MODULE.name) return this.readKindOfTheFolder(filePath);
    const file = this.filesByPathMap.get(stripLeadingDotSlash(filePath));
    const holding = file ? findTheSmallestHolding(file.declarations, scale, Number(line)) : null;
    return holding ? holding.kind : this.readKindAtThePlace(filePath, line);
  }

  toJSON() {
    return { kindBase: this.kindBase, renames: this.renames, applications: this.applications, folders: this.folders, files: this.files };
  }

  static createFromJSON(saved) {
    return new PublicChangeKinds(saved || {});
  }
}
