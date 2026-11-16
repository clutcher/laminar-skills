import { isAncestorCommitIn } from "../../../code/index.mjs";

const readEndsOfTheRevisions = revisions => {
  const text = String(revisions || "");
  const ends = text.split(text.includes("...") ? "..." : "..").map(end => end.trim());
  return ends.length === 2 && ends.every(Boolean) ? { base: ends[0], head: ends[1] } : null;
};

// A plan decides the code from its base commit on, so its decisions apply to a review whose revisions hold that commit: the base of the review at or before it, and the head after it.
export const findWhyThePlanBaseLiesOutsideTheRevisions = (repository, revisions, baseCommit) => {
  const ends = readEndsOfTheRevisions(revisions);
  if (!ends) return `the revisions ${revisions} have no base and head`;
  if (!baseCommit) return "the file names no baseCommit";
  if (!isAncestorCommitIn(repository, baseCommit, ends.head)) return `the plan base ${baseCommit} is not an ancestor of the reviewed head ${ends.head}`;
  if (!isAncestorCommitIn(repository, ends.base, baseCommit)) return `the plan base ${baseCommit} lies before the base ${ends.base} of the reviewed range`;
  return "";
};
