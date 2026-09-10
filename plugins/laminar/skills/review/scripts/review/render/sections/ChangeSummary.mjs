import { ABSTRACTION_KINDS, CHANGE_KINDS, Scale } from "../../../code/index.mjs";

const MOST_NAMES_SHOWN = 3;

const CHANGED_KINDS = new Set([CHANGE_KINDS.INTERNALS_CHANGED, CHANGE_KINDS.BOUNDARY_CHANGED]);

const MOVED_KINDS = new Set([CHANGE_KINDS.MOVED, CHANGE_KINDS.RENAMED]);

const TOUCHED_KINDS = new Set([...CHANGED_KINDS, ...MOVED_KINDS, CHANGE_KINDS.CREATED, CHANGE_KINDS.REMOVED]);

const readScale = abstraction => Scale.findNamed(String(abstraction.scale || "")) || Scale.VARIABLE;

const compareFromTheLargestScale = (left, right) => (readScale(left).isAbove(readScale(right)) ? -1 : readScale(right).isAbove(readScale(left)) ? 1 : 0);

const listEveryAbstractionWithItsEnclosing = (abstractions, enclosing = null) => (abstractions || [])
  .flatMap(abstraction => [{ abstraction, enclosing }, ...listEveryAbstractionWithItsEnclosing(abstraction.children, abstraction)]);

const isALocalVariable = ({ abstraction, enclosing }) => abstraction.kind === ABSTRACTION_KINDS.LOCAL
  || (readScale(abstraction) === Scale.VARIABLE && Boolean(enclosing) && readScale(enclosing) === Scale.METHOD);

const holdsTheKind = (abstraction, kinds) => Boolean(abstraction) && kinds.has(abstraction.changeKind);

const isTheTopOfItsKind = ({ abstraction, enclosing }, kinds) => holdsTheKind(abstraction, kinds) && !holdsTheKind(enclosing, kinds);

const holdsATouchedChildAboveAVariable = abstraction => (abstraction.children || [])
  .some(child => holdsTheKind(child, TOUCHED_KINDS) && readScale(child).isAbove(Scale.VARIABLE));

const isAChangeNamedOnItsOwn = ({ abstraction }) => holdsTheKind(abstraction, CHANGED_KINDS) && !holdsATouchedChildAboveAVariable(abstraction);

const formatName = abstraction => `${String(abstraction.scale || "").toLowerCase()} \`${abstraction.displayName || abstraction.name || abstraction.path}\``;

const joinNames = names => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]);

const formatNames = abstractions => {
  const ordered = [...abstractions].sort(compareFromTheLargestScale);
  const shown = ordered.slice(0, MOST_NAMES_SHOWN).map(formatName);
  const more = ordered.length - shown.length;
  return joinNames(more ? [...shown, `${more} more`] : shown);
};

const formatVerbPhrase = (verb, abstractions) => (abstractions.length ? `${verb} ${formatNames(abstractions)}` : "");

const formatFileNames = files => {
  const shown = files.slice(0, MOST_NAMES_SHOWN).map(file => `\`${file}\``);
  const more = files.length - shown.length;
  return joinNames(more ? [...shown, `${more} more`] : shown);
};

const formatFileCount = files => `${files} file${files === 1 ? "" : "s"}`;

const formatWhatTheChangeMade = (created, moved, removed) => {
  const phrases = [formatVerbPhrase("created", created), formatVerbPhrase("moved", moved), formatVerbPhrase("removed", removed)].filter(Boolean);
  return phrases.length ? `The change ${joinNames(phrases)}.` : "The change created, moved and removed no abstraction.";
};

const formatWhatTheChangeChanged = (changed, files) => (changed.length
  ? `It changed ${formatNames(changed)}, in ${formatFileCount(files)}.`
  : `It changed no other abstraction, in ${formatFileCount(files)}.`);

const formatTheChangedFiles = (changedFiles, files) => (changedFiles.length
  ? `It changed ${formatFileNames(changedFiles)}.`
  : formatWhatTheChangeChanged([], files));

export function formatChangeSummary(reviewed) {
  const everyAbstraction = listEveryAbstractionWithItsEnclosing(reviewed.abstractions).filter(placed => !isALocalVariable(placed));
  const topOfTheKind = kinds => everyAbstraction.filter(placed => isTheTopOfItsKind(placed, kinds)).map(placed => placed.abstraction);
  const created = topOfTheKind(new Set([CHANGE_KINDS.CREATED]));
  const moved = topOfTheKind(MOVED_KINDS);
  const removed = topOfTheKind(new Set([CHANGE_KINDS.REMOVED]));
  const changed = everyAbstraction.filter(isAChangeNamedOnItsOwn).map(placed => placed.abstraction);
  const files = Number((reviewed.counts || {}).files) || 0;
  const namesNoAbstraction = ![...created, ...moved, ...removed, ...changed].length;
  const whatItChanged = namesNoAbstraction
    ? formatTheChangedFiles(Object.keys(reviewed.changedLines || {}).sort(), files)
    : formatWhatTheChangeChanged(changed, files);
  return `${formatWhatTheChangeMade(created, moved, removed)} ${whatItChanged}`;
}
