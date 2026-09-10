import { RelationFinder } from "../../../finders/RelationFinder.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { NO_IMPORT_CONVENTIONS } from "./imports/ImportConventions.mjs";
import { NO_PACKAGE_SCOPE } from "./imports/PackageScope.mjs";

export class GenericModuleRelationFinder extends RelationFinder {
  constructor() {
    super(Scale.MODULE);
    this.importStatementForms = [];
    this.importConventions = NO_IMPORT_CONVENTIONS;
    this.packageScope = NO_PACKAGE_SCOPE;
  }

  readsAnImportStatement(text, add) {
    return this.importStatementForms.some(readForm => readForm(text, add));
  }

  opensAnImportBlock() {
    return false;
  }

  closesAnImportBlock() {
    return false;
  }

  findImportedPath() {
    return null;
  }

  findDottedImport() {
    return null;
  }

  findWildcardImport() {
    return null;
  }

  findReExport() {
    return null;
  }

  findDefaultExport() {
    return null;
  }

  findNestedImport() {
    return null;
  }

  findCrossModuleImports() {
    return [];
  }
}
