import { AbstractionChange } from "../../inputs/change/AbstractionChange.mjs";
import { Evidence } from "../Evidence.mjs";
import { Boundary } from "./Boundary.mjs";
import { Place } from "./Place.mjs";
import { Role, ROLE_KINDS } from "./Role.mjs";
import { Scale } from "./Scale.mjs";
import { NO_SIGNATURE, Signature } from "./Signature.mjs";
import { readFileName, readFileStem } from "../../../files/paths.mjs";
import { FILE_NAMES_SET_BY_THE_LANGUAGE, isTheSameNameAcrossConventions } from "../../inputs/source/names/NamingConventions.mjs";

export const ABSTRACTION_KINDS = Object.freeze({ FILE: "FILE", FOLDER: "FOLDER", LOCAL: "LOCAL" });

export const isPlacedInSource = abstraction => Boolean(abstraction.place) && abstraction.place.hasASourceLine;

export const isADeclaredType = abstraction => abstraction.scale === Scale.CLASS && abstraction.kind !== ABSTRACTION_KINDS.FILE;

export const isTheClassOfAFile = abstraction => Boolean(abstraction.parent) && abstraction.parent.scale === Scale.MODULE;

export const findTheOnlyTopType = topTypes => (topTypes.length === 1 ? topTypes[0] : null);

export const isNamedForTheFile = (name, filePath) => isTheSameNameAcrossConventions(name, readFileStem(filePath));

export const isAFileNamedByTheLanguage = filePath => FILE_NAMES_SET_BY_THE_LANGUAGE.has(readFileStem(filePath));

export const findTheTypeThatIsTheFile = (filePath, topTypes) => {
  const onlyType = findTheOnlyTopType(topTypes);
  return onlyType && (isAFileNamedByTheLanguage(filePath) || isNamedForTheFile(onlyType.name, filePath)) ? onlyType : null;
};

export const readFileClassName = (filePath, topTypeNames) => (topTypeNames.includes(readFileStem(filePath)) ? readFileName(filePath) : readFileStem(filePath));

export const formatAbstractionId = (scale, file, qualifiedName) => [scale.name, file, qualifiedName].filter(piece => piece !== null && piece !== undefined).join(":");

const isOnTheParentBoundary = abstraction => abstraction.onParentBoundary === true;

const createFramework = ({ name, evidence }) => Object.freeze({ name, evidence: Evidence.createFrom(evidence) });

const mapFrameworkToJson = framework => ({ name: framework.name, evidence: framework.evidence.toJSON() });

const freezeMembers = members => members.map(({ name, line }) => Object.freeze({ name, line }));

const KNOWN_ABSTRACTION_KINDS = new Set(Object.values(ABSTRACTION_KINDS));

const requireAKnownKind = kind => {
  if (kind !== null && !KNOWN_ABSTRACTION_KINDS.has(kind)) throw new Error(`Unknown abstraction kind: ${kind}`);
  return kind;
};

export class Abstraction {
  #roles = [];

  constructor({ id, reviewId = null, scale, kind = null, name, qualifiedName = name, place = null, signature = NO_SIGNATURE, visibility = null, onParentBoundary = null, frameworks = [], complete = true, enclosingTypeName = null, abstract = false, declaredMembers = [], members = [], measures = {} }) {
    Object.assign(this, { id, reviewId, scale, kind: requireAKnownKind(kind), name, qualifiedName, place, signature, visibility, onParentBoundary, complete, enclosingTypeName, abstract });
    this.frameworks = frameworks.map(createFramework);
    this.declaredMembers = freezeMembers(declaredMembers);
    this.members = freezeMembers(members);
    this.measures = Object.freeze({ ...measures });
    this.parent = null;
    this.children = [];
    this.change = null;
  }

  get roles() {
    return Object.freeze([...this.#roles]);
  }

  applyDescription({ signature = this.signature, enclosingTypeName = this.enclosingTypeName, abstract = this.abstract, declaredMembers = this.declaredMembers }) {
    Object.assign(this, { signature, enclosingTypeName, abstract });
    this.declaredMembers = freezeMembers(declaredMembers);
    return this;
  }

  applyFrameworks(frameworks) {
    this.frameworks = frameworks.map(createFramework);
    return this;
  }

  applyMeasures(measures) {
    this.measures = Object.freeze({ ...this.measures, ...measures });
    return this;
  }

  add(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  addRole(role) {
    if (!this.hasRole(role.kind)) this.#roles.push(role);
    return role;
  }

  hasRole(kind) {
    return this.#roles.some(role => role.kind === kind);
  }

  findAncestorAt(scale) {
    for (let at = this; at; at = at.parent) if (at.scale === scale) return at;
    return null;
  }

  isInTheSameApplicationAs(other) {
    return this.findAncestorAt(Scale.APPLICATION) === other.findAncestorAt(Scale.APPLICATION);
  }

  collectDescendants() {
    return this.children.flatMap(child => [child, ...child.collectDescendants()]);
  }

  findRolesBelow(kind) {
    return this.collectDescendants().flatMap(descendant => descendant.roles.filter(role => role.kind === kind));
  }

  get boundary() {
    const isTheApplication = this.scale === Scale.APPLICATION;
    return new Boundary({
      abstraction: this,
      name: this.name,
      signature: this.signature,
      exposed: this.children.filter(isOnTheParentBoundary).map(child => child.boundary),
      entryBoundaries: isTheApplication ? this.findRolesBelow(ROLE_KINDS.ENTRY_BOUNDARY) : [],
      exits: isTheApplication ? this.findRolesBelow(ROLE_KINDS.EXIT_BOUNDARY) : [],
    });
  }

  get hidden() {
    return this.children.filter(child => !isOnTheParentBoundary(child));
  }

  get exposedUpTo() {
    let at = this;
    while (true) {
      if (at.hasRole(ROLE_KINDS.ENTRY_BOUNDARY)) return this.findAncestorAt(Scale.APPLICATION) || at;
      if (!at.parent || !isOnTheParentBoundary(at)) return at;
      at = at.parent;
    }
  }

  toJSON() {
    return {
      id: this.id,
      ...(this.reviewId ? { reviewId: this.reviewId } : {}),
      scale: this.scale.name,
      ...(this.kind ? { kind: this.kind } : {}),
      name: this.name,
      qualifiedName: this.qualifiedName,
      ...(this.parent ? { parent: this.parent.id } : {}),
      ...(this.place ? { place: this.place.toJSON() } : {}),
      ...(this.signature.isEmpty() ? {} : { signature: this.signature.toJSON() }),
      ...(this.visibility ? { visibility: this.visibility } : {}),
      ...(this.onParentBoundary === null ? {} : { onParentBoundary: this.onParentBoundary }),
      ...(this.roles.length ? { roles: this.roles.map(role => role.toJSON()) } : {}),
      ...(this.scale === Scale.APPLICATION || this.frameworks.length ? { frameworks: this.frameworks.map(mapFrameworkToJson) } : {}),
      ...(this.complete ? {} : { complete: false }),
      ...(this.enclosingTypeName === null ? {} : { enclosingTypeName: this.enclosingTypeName }),
      ...(this.abstract ? { abstract: true } : {}),
      ...(this.declaredMembers.length ? { declaredMembers: this.declaredMembers.map(member => ({ ...member })) } : {}),
      ...(this.members.length ? { members: this.members.map(member => ({ ...member })) } : {}),
      ...(Object.keys(this.measures).length ? { measures: { ...this.measures } } : {}),
      ...(this.change ? { change: this.change.toJSON() } : {}),
    };
  }

  static createFromJSON(saved) {
    const abstraction = new Abstraction({
      ...saved,
      scale: Scale.findNamed(saved.scale),
      place: saved.place ? Place.createFromJSON(saved.place) : null,
      signature: Signature.createFromJSON(saved.signature),
    });
    for (const role of saved.roles || []) abstraction.addRole(Role.createFromJSON(role, abstraction));
    if (saved.change) abstraction.change = AbstractionChange.createFromJSON(saved.change);
    return abstraction;
  }
}
