import { Abstraction, ABSTRACTION_KINDS, formatAbstractionId, readFileClassName, findTheTypeThatIsTheFile, isADeclaredType } from "../../graph/abstractions/Abstraction.mjs";
import { Place } from "../../graph/abstractions/Place.mjs";
import { recordTheWalkedReferences } from "./WalkedReferenceRecording.mjs";
import { Evidence, EVIDENCE_KINDS } from "../../graph/Evidence.mjs";
import { Role } from "../../graph/abstractions/Role.mjs";
import { CLASS_FINDER_REGISTRY } from "../abstractions/class/index.mjs";
import { Scale } from "../../graph/abstractions/Scale.mjs";
import { Signature } from "../../graph/abstractions/Signature.mjs";
import { findDeployableFolder } from "../abstractions/application/generic/ApplicationFolders.mjs";
import { ApplicationFrameworks, createMarkedFramework } from "../abstractions/application/generic/frameworks/ApplicationFrameworks.mjs";
import { isATopLevelType } from "../../inputs/source/declarations/SourceHeads.mjs";
import { FilePlacement } from "./FilePlacement.mjs";
import { readFileName, readFolderPath } from "../../../files/paths.mjs";

const readFolderName = folder => folder || ".";

const buildKey = (filePath, line) => `${filePath}\u0000${line}`;

const createPlaceOfSpan = (filePath, span) => new Place({ file: filePath, startLine: span.from, endLine: span.to });

const buildMeasures = declaration => ({
  ...(declaration.windows && declaration.windows.length ? { windows: declaration.windows } : {}),
  ...(declaration.readAsAField ? { holdsAValue: declaration.holdsAValue } : {}),
});


const giveTheRoles = (abstraction, roles) => {
  for (const role of roles) abstraction.addRole(new Role({ ...role, of: abstraction }));
};

function buildQualifiedName(declaration, parent) {
  if (declaration.scale !== Scale.CLASS.name) return `${parent.name}#${declaration.name}`;
  return isADeclaredType(parent) ? `${parent.qualifiedName}.${declaration.name}` : declaration.name;
}

const NO_SHAPES = Object.freeze({ findFolderRole: () => null });

export class AbstractionWalker {
  constructor(graph, { roots = [], applications = new ApplicationFrameworks(roots), shapes = NO_SHAPES } = {}) {
    this.graph = graph;
    this.roots = roots;
    this.shapes = shapes;
    this.applicationFrameworks = applications;
    this.applicationsByFolderMap = new Map();
    this.modulesByFolderMap = new Map();
    this.fileClassesByPathMap = new Map();
    this.fileClassesBesideTheTypeByPathMap = new Map();
    this.declaredByKeyMap = new Map();
  }

  walk(files) {
    this.applicationFrameworks.noteTheMarksOf(files);
    for (const file of files) this.walkTheFile(file);
    return this;
  }

  findOrAddTheApplication(folder) {
    if (!this.applicationsByFolderMap.has(folder)) {
      this.applicationsByFolderMap.set(folder, this.graph.add(new Abstraction({
        id: formatAbstractionId(Scale.APPLICATION, null, readFolderName(folder)),
        scale: Scale.APPLICATION,
        name: readFileName(folder) || ".",
        qualifiedName: readFolderName(folder),
        place: new Place({ file: folder }),
        frameworks: this.applicationFrameworks.findFrameworksOfApplication(folder),
      })));
    }
    return this.applicationsByFolderMap.get(folder);
  }

  findOrAddTheModule(folder) {
    if (!this.modulesByFolderMap.has(folder)) {
      const applicationFolder = findDeployableFolder(folder, this.roots) ?? "";
      const parent = folder === applicationFolder ? this.findOrAddTheApplication(applicationFolder) : this.findOrAddTheModule(readFolderPath(folder));
      this.modulesByFolderMap.set(folder, this.graph.add(new Abstraction({
        id: formatAbstractionId(Scale.MODULE, null, readFolderName(folder)),
        scale: Scale.MODULE,
        kind: ABSTRACTION_KINDS.FOLDER,
        name: readFileName(folder) || ".",
        qualifiedName: readFolderName(folder),
        place: new Place({ file: folder }),
      }), parent));
      this.giveTheFolderRole(this.modulesByFolderMap.get(folder), folder);
    }
    return this.modulesByFolderMap.get(folder);
  }

  giveTheFolderRole(module, folder) {
    const shapeRole = this.shapes.findFolderRole(folder);
    if (shapeRole && shapeRole.kind) { this.giveTheShapeRole(module, shapeRole); return; }
    const folderRoles = CLASS_FINDER_REGISTRY.genericRoleFinder;
    const kind = folderRoles.findFolderRoleKind(folder);
    if (kind) module.addRole(new Role({ kind, of: module, evidence: new Evidence({ kind: EVIDENCE_KINDS.CONVENTION, foundBy: folderRoles.name, detail: `the folder ${readFolderName(folder)}` }) }));
  }

  giveTheShapeRole(module, shapeRole) {
    module.addRole(new Role({ kind: shapeRole.kind, of: module, detail: shapeRole.detail, facts: shapeRole.facts, evidence: new Evidence({ kind: EVIDENCE_KINDS.CONVENTION, foundBy: shapeRole.foundBy, detail: shapeRole.evidence }) }));
  }

  findOrAddTheFileClass(filePath) {
    if (!this.fileClassesByPathMap.has(filePath)) this.fileClassesByPathMap.set(filePath, this.addTheFileKindClass(filePath));
    return this.fileClassesByPathMap.get(filePath);
  }

  findWalkedFileClass(filePath) {
    return this.fileClassesByPathMap.get(filePath) || null;
  }

  findAbstractionDeclaredAt(filePath, line, scale, name) {
    const walkedDeclaration = this.declaredByKeyMap.get(buildKey(filePath, line));
    return walkedDeclaration && walkedDeclaration.declaration.scale === scale && walkedDeclaration.declaration.name === name ? walkedDeclaration.abstraction : null;
  }

  findAbstractionOfDeclarationAt(filePath, line) {
    const walkedDeclaration = this.declaredByKeyMap.get(buildKey(filePath, line));
    return walkedDeclaration ? walkedDeclaration.abstraction : null;
  }

  findOrAddTheFileClassBesideTheType(filePath, topTypes) {
    if (!this.fileClassesBesideTheTypeByPathMap.has(filePath)) this.fileClassesBesideTheTypeByPathMap.set(filePath, this.addTheFileKindClass(filePath, topTypes));
    return this.fileClassesBesideTheTypeByPathMap.get(filePath);
  }

  addTheFileKindClass(filePath, topTypes = []) {
    const name = readFileClassName(filePath, topTypes.map(type => type.name));
    return this.graph.add(new Abstraction({
      id: this.graph.chooseFreeId(formatAbstractionId(Scale.CLASS, filePath, name)),
      scale: Scale.CLASS,
      kind: ABSTRACTION_KINDS.FILE,
      name,
      place: new Place({ file: filePath }),
    }), this.findOrAddTheModule(readFolderPath(filePath)));
  }

  walkTheFile({ path: filePath, declarations, references = [], roles = [], visibleForTesting = [], frameworks = [] }) {
    const topTypes = declarations.filter(isATopLevelType);
    const filesOwnType = findTheTypeThatIsTheFile(filePath, topTypes);
    if (filesOwnType) this.fileClassesByPathMap.set(filePath, this.place(filePath, filesOwnType, this.findOrAddTheModule(readFolderPath(filePath))));
    const fileClass = this.findOrAddTheFileClass(filePath);
    const placement = new FilePlacement(this, { filePath, declarations, topTypes, filesOwnType, fileClass });
    placement.placeEveryDeclaration();
    recordTheWalkedReferences(this.graph, filePath, references, placement.listPlacedOtherThanTheFileClass(), fileClass);
    giveTheRoles(fileClass, roles);
    if (visibleForTesting.length) fileClass.applyMeasures({ visibleForTesting });
    if (frameworks.length) fileClass.applyFrameworks(frameworks.map(createMarkedFramework));
  }

  place(filePath, declaration, parent) {
    const scale = Scale.findNamed(declaration.scale);
    const qualifiedName = buildQualifiedName(declaration, parent);
    const abstraction = this.graph.add(new Abstraction({
      id: this.graph.chooseFreeId(formatAbstractionId(scale, filePath, qualifiedName)),
      scale,
      name: declaration.name,
      qualifiedName,
      place: createPlaceOfSpan(filePath, declaration.span),
      signature: new Signature({ text: String(declaration.text).trim() }),
      members: declaration.members || [],
      measures: buildMeasures(declaration),
    }), parent);
    giveTheRoles(abstraction, declaration.roles || []);
    this.declaredByKeyMap.set(buildKey(filePath, declaration.line), { declaration, abstraction });
    return abstraction;
  }
}
