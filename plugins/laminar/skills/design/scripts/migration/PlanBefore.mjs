import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PLAN_COMMIT_FILE } from "../plan/PlanFolder.mjs";

// The exit status of git merge-base --is-ancestor: 0 where the first commit is an ancestor of the second or the same commit, 1 where it is not, and any other status where git cannot read either commit.
const ANCESTOR_STATUS = 0;

const NOT_AN_ANCESTOR_STATUS = 1;

const readPlanCommitBesideTheModel = modelPath => {
  const commitPath = path.join(path.dirname(path.resolve(modelPath)), PLAN_COMMIT_FILE);
  if (!fs.existsSync(commitPath)) return null;
  return fs.readFileSync(commitPath, "utf8").trim() || null;
};

// The model of the plan before describes the tree of its own plan commit, which plans/<n-1>/plan-commit.txt holds. Where that commit is no ancestor of the current tree, the model was built on another tree: the diff against it reads each test that tree held and this model does not as removed, and the cut leaves out groups whose writers never wrote on this tree. So the migration stops; it says nothing where either commit is not known.
export const findPlanBeforeOnAnotherTree = (repositoryRoot, beforePath, treeCommit) => {
  const commitBefore = readPlanCommitBesideTheModel(beforePath);
  if (!repositoryRoot || !treeCommit || !commitBefore) return null;

  const run = spawnSync("git", ["-C", repositoryRoot, "merge-base", "--is-ancestor", commitBefore, treeCommit], { encoding: "utf8" });
  if (run.status === ANCESTOR_STATUS) return null;
  const why = run.status === NOT_AN_ANCESTOR_STATUS ? `is no ancestor of the current tree ${treeCommit}` : `cannot be compared with the current tree ${treeCommit} in ${repositoryRoot}: ${String(run.stderr || run.error?.message || "").trim()}`;
  return `before: the model of the plan before, ${beforePath}, was built on the plan commit ${commitBefore}, which ${why}, so it describes another tree; plan this tree in a new results folder`;
};
