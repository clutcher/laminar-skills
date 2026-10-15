import { FILE_STATUS } from "./Hunk.mjs";
import { readFileStem } from "../../../files/paths.mjs";

export const CHANGE_KINDS = Object.freeze({
  CREATED: "CREATED",
  REMOVED: "REMOVED",
  BOUNDARY_CHANGED: "BOUNDARY_CHANGED",
  INTERNALS_CHANGED: "INTERNALS_CHANGED",
  MOVED: "MOVED",
  RENAMED: "RENAMED",
  REFERENCE: "REFERENCE",
});

const KINDS_THAT_CHANGE_THE_CODE = new Set([CHANGE_KINDS.CREATED, CHANGE_KINDS.BOUNDARY_CHANGED, CHANGE_KINDS.INTERNALS_CHANGED]);

const KINDS_THAT_CHANGE_THE_BOUNDARY = new Set([CHANGE_KINDS.CREATED, CHANGE_KINDS.BOUNDARY_CHANGED]);

export const changesTheCode = changeKind => KINDS_THAT_CHANGE_THE_CODE.has(changeKind);

export const changesTheBoundary = changeKind => KINDS_THAT_CHANGE_THE_BOUNDARY.has(changeKind);

export const CHANGE_EVENTS = Object.freeze({
  EXPOSED_MEMBER_CREATED: "EXPOSED_MEMBER_CREATED",
  PRIVATE_MEMBER_CREATED: "PRIVATE_MEMBER_CREATED",
  SIGNATURE_CHANGED: "SIGNATURE_CHANGED",
  FIELD_ADDED: "FIELD_ADDED",
  MEMBER_REMOVED: "MEMBER_REMOVED",
  TYPE_CREATED: "TYPE_CREATED",
  BODY_CHANGED: "BODY_CHANGED",
});

const BOUNDARY_EVENTS = new Set([
  CHANGE_EVENTS.EXPOSED_MEMBER_CREATED,
  CHANGE_EVENTS.SIGNATURE_CHANGED,
  CHANGE_EVENTS.FIELD_ADDED,
  CHANGE_EVENTS.MEMBER_REMOVED,
]);

const KIND_BY_FILE_STATUS_MAP = Object.freeze({
  [FILE_STATUS.CREATED]: CHANGE_KINDS.CREATED,
  [FILE_STATUS.REMOVED]: CHANGE_KINDS.REMOVED,
});

export const renamesTheFile = changedFile => changedFile.status === FILE_STATUS.RENAMED
  && Boolean(changedFile.oldPath) && readFileStem(changedFile.oldPath) !== readFileStem(changedFile.path);

const readMovedFileChangeKind = (changedFile, events) => {
  if (readChangeKindFromEvents(events) === CHANGE_KINDS.BOUNDARY_CHANGED) return CHANGE_KINDS.BOUNDARY_CHANGED;
  return renamesTheFile(changedFile) ? CHANGE_KINDS.RENAMED : CHANGE_KINDS.MOVED;
};

export function readFileChangeKind(changedFile, events) {
  if (changedFile.status === FILE_STATUS.RENAMED) return readMovedFileChangeKind(changedFile, events);
  return KIND_BY_FILE_STATUS_MAP[changedFile.status] || readChangeKindFromEvents(events);
}

export function readDeclaredMemberChangeKind(alsoStoodOnTheRemovedSide) {
  return alsoStoodOnTheRemovedSide ? CHANGE_KINDS.BOUNDARY_CHANGED : CHANGE_KINDS.CREATED;
}

export function readMemberCreationEvent(isExposed, alsoStoodOnTheRemovedSide) {
  if (alsoStoodOnTheRemovedSide) return CHANGE_EVENTS.SIGNATURE_CHANGED;
  return isExposed ? CHANGE_EVENTS.EXPOSED_MEMBER_CREATED : CHANGE_EVENTS.PRIVATE_MEMBER_CREATED;
}

export function readChangeKindFromEvents(events) {
  if (![...events].length) return null;
  return [...events].some(event => BOUNDARY_EVENTS.has(event)) ? CHANGE_KINDS.BOUNDARY_CHANGED : CHANGE_KINDS.INTERNALS_CHANGED;
}

export const ABSTRACTION_CHANGE_KINDS = Object.freeze({
  ADDED: "ADDED",
  REMOVED: "REMOVED",
  MOVED: "MOVED",
  BODY_CHANGED: "BODY_CHANGED",
  BOUNDARY_MOVED: "BOUNDARY_MOVED",
});

const ABSTRACTION_CHANGE_BY_CHANGE_KIND_MAP = Object.freeze({
  [CHANGE_KINDS.CREATED]: { kind: ABSTRACTION_CHANGE_KINDS.ADDED, detail: "" },
  [CHANGE_KINDS.REMOVED]: { kind: ABSTRACTION_CHANGE_KINDS.REMOVED, detail: "" },
  [CHANGE_KINDS.MOVED]: { kind: ABSTRACTION_CHANGE_KINDS.MOVED, detail: "moved to another folder" },
  [CHANGE_KINDS.RENAMED]: { kind: ABSTRACTION_CHANGE_KINDS.MOVED, detail: "renamed" },
  [CHANGE_KINDS.BOUNDARY_CHANGED]: { kind: ABSTRACTION_CHANGE_KINDS.BOUNDARY_MOVED, detail: "" },
  [CHANGE_KINDS.INTERNALS_CHANGED]: { kind: ABSTRACTION_CHANGE_KINDS.BODY_CHANGED, detail: "" },
});

export class AbstractionChange {
  constructor({ kind, before = null, after = null, changedLines = null, detail = "" }) {
    this.kind = kind;
    this.before = before;
    this.after = after;
    this.changedLines = changedLines;
    this.detail = detail;
    Object.freeze(this);
  }

  static createBetween(before, after, changedLines = null) {
    if (!before) return new AbstractionChange({ kind: ABSTRACTION_CHANGE_KINDS.ADDED, after, changedLines });
    if (!after) return new AbstractionChange({ kind: ABSTRACTION_CHANGE_KINDS.REMOVED, before, changedLines });
    const kind = before.equals(after) ? ABSTRACTION_CHANGE_KINDS.BODY_CHANGED : ABSTRACTION_CHANGE_KINDS.BOUNDARY_MOVED;
    return new AbstractionChange({ kind, before, after, changedLines });
  }

  static createFromChangeKind(changeKind, changedLines = null) {
    const known = ABSTRACTION_CHANGE_BY_CHANGE_KIND_MAP[changeKind];
    return known ? new AbstractionChange({ ...known, changedLines }) : null;
  }

  toJSON() {
    return {
      kind: this.kind,
      ...(this.detail ? { detail: this.detail } : {}),
      ...(this.changedLines ? { changedLines: { ...this.changedLines } } : {}),
    };
  }

  static createFromJSON(saved) {
    return new AbstractionChange({ kind: saved.kind, detail: saved.detail, changedLines: saved.changedLines ? { ...saved.changedLines } : null });
  }
}
