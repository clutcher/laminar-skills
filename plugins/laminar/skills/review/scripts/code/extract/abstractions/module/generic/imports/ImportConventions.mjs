export class ImportConventions {
  constructor({
    importsNameFolders = false,
    importsBindNoDottedName = false,
    relativeImportsUseDots = false,
    importedNameMayBeAModule = false,
    packagesAreFoldersWithInitFiles = false,
    defaultExportsNameTheModule = false,
  } = {}) {
    this.importsNameFolders = importsNameFolders;
    this.importsBindNoDottedName = importsBindNoDottedName;
    this.relativeImportsUseDots = relativeImportsUseDots;
    this.importedNameMayBeAModule = importedNameMayBeAModule;
    this.packagesAreFoldersWithInitFiles = packagesAreFoldersWithInitFiles;
    this.defaultExportsNameTheModule = defaultExportsNameTheModule;
    Object.freeze(this);
  }
}

export const NO_IMPORT_CONVENTIONS = new ImportConventions();
