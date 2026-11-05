import { readList } from "../model/DesignModel.mjs";
import { readCurrentTree } from "../migration/CurrentTree.mjs";
import { findCompletenessDefects } from "./CompletenessCheck.mjs";
import { findCurrentTreeDefects } from "./CurrentTreeCheck.mjs";
import { findCycleCheckDefects, findFolderPairOutsideTheBase } from "./CycleCheck.mjs";
import { DEFECT_CODES, createDefect } from "./DesignDefect.mjs";
import { findDataFlowDefects } from "./DataFlowCheck.mjs";
import { findNameOfThePath } from "./DefectNames.mjs";
import { findExitListResult } from "./ExitList.mjs";
import { findExitReachDefects } from "./ExitReach.mjs";
import { findExitFailureResult, findFailureHandlingDefects } from "./FailureHandling.mjs";
import { findFieldListResult } from "./FieldListCheck.mjs";
import { listMigrationSteps } from "../migration/MigrationSteps.mjs";
import { findGroupOrderDefects } from "../migration/GroupOrder.mjs";
import { findFindingsDefects } from "./FindingsCheck.mjs";
import { readZoneOrder } from "./ZoneOrder.mjs";

const describeCurrentTree = currentTree => (currentTree
  ? `current tree: read from ${currentTree.describe()}`
  : "current tree: not read, no --repo given, so old paths, old names, removed names, current classes, current members, the fields of modified classes, the methods marked unchanged, the conventions files and each shape-run item left outside the change are not checked");

const describeResponseTypes = libraryTypeNames => (libraryTypeNames.length
  ? `response types: library type, not checked: ${libraryTypeNames.join(", ")}`
  : "response types: each a class of the model");

const describeReview = reviewText => (reviewText === null
  ? "review: not read, no --review given, so the items of review.md are not matched with decisions.findings"
  : "review: read, each item at the application, module and class scales matched with decisions.findings");

const describeShapeReviews = shapeReviews => (shapeReviews.length
  ? `shape reviews: read for shape runs ${shapeReviews.map(shapeReview => shapeReview.run).join(", ")}, each item matched with decisions.findings of its run`
  : "shape reviews: not read, no --shape-review given, so the items of the shape runs are not matched with decisions.findings");

const joinScriptCaseKey = (code, name, text) => JSON.stringify([code, name, text]);

const OUTSIDE_THE_CHANGE = "outside the change";

// A folder cycle whose object of scriptCases holds the reason outside the change is cleared only where the current tree, the base commit, makes every edge of the cycle, so the cycle predates the change.
const findWhyTheCycleIsNotOutside = (defect, currentTree) => {
  if (!currentTree) return "no --repo given, so its edges are not read in the base commit";
  const folderPair = findFolderPairOutsideTheBase(defect.folderPairs, currentTree);
  return folderPair ? `no relation of the base commit makes its edge ${folderPair.fromFolder} -> ${folderPair.toFolder}` : "";
};

const markTheScriptCases = (model, defects, currentTree) => {
  const scriptCaseOfKeyMap = new Map(readList(model.decisions.scriptCases).map(scriptCase => [joinScriptCaseKey(scriptCase.code, scriptCase.name, scriptCase.text), scriptCase]));
  const outsideDefects = [];
  const markedDefects = defects.map(({ folderPairs, ...defect }) => {
    const name = findNameOfThePath(model, defect.path) || defect.path;
    const scriptCase = defect.recheck ? scriptCaseOfKeyMap.get(joinScriptCaseKey(defect.code, name, defect.sentence)) : undefined;
    if (!scriptCase) return { ...defect, name, foundWrong: false, matched: false };
    if (defect.code !== DEFECT_CODES.FOLDER_CYCLE || scriptCase.reason !== OUTSIDE_THE_CHANGE) return { ...defect, name, foundWrong: true, matched: true };

    const why = findWhyTheCycleIsNotOutside({ ...defect, folderPairs }, currentTree);
    if (why) outsideDefects.push({ ...createDefect(DEFECT_CODES.OUTSIDE_THE_CHANGE_BUT_CHANGED, defect.path, `the folder cycle is left as ${OUTSIDE_THE_CHANGE}, and ${why}`), name, foundWrong: false, matched: false });
    return { ...defect, name, foundWrong: !why, matched: true };
  });
  return [...markedDefects, ...outsideDefects];
};

const listUnmatchedScriptCases = (model, markedDefects) => {
  const matchedKeys = new Set(markedDefects.filter(defect => defect.matched).map(defect => joinScriptCaseKey(defect.code, defect.name, defect.sentence)));
  return readList(model.decisions.scriptCases).filter(scriptCase => !matchedKeys.has(joinScriptCaseKey(scriptCase.code, scriptCase.name, scriptCase.text)));
};

// The base tree, where a line older than the change stands, is the base commit where it differs from the commit of the current tree.
const readBaseTree = (repositoryRoot, commits, currentTree) => {
  if (!repositoryRoot || !commits.baseCommit || commits.baseCommit === commits.treeCommit) return currentTree;
  return readCurrentTree(repositoryRoot, commits.baseCommit);
};

// With a tree commit, the current tree is that commit, never the working folder, which may hold the files of a writer.
export const checkDesignModel = (model, repositoryRoot = null, reviewText = null, shapeReviews = [], commits = { treeCommit: null, baseCommit: null }) => {
  const currentTree = repositoryRoot ? readCurrentTree(repositoryRoot, commits.treeCommit) : null;
  const baseTree = readBaseTree(repositoryRoot, commits, currentTree);
  const zoneOrder = readZoneOrder(model.decisions.conventions?.zoneOrder, currentTree, model.listScopeFolderPaths());
  const completeness = findCompletenessDefects(model, zoneOrder);
  const cycleCheck = findCycleCheckDefects(model, zoneOrder);
  const dataFlow = findDataFlowDefects(model);
  const exitList = findExitListResult(model);
  const fieldList = currentTree ? findFieldListResult(model, currentTree) : null;
  const exitFailure = findExitFailureResult(model);
  const defects = [
    ...completeness.defects,
    ...findFindingsDefects(model, reviewText, shapeReviews, baseTree),
    ...(currentTree ? findCurrentTreeDefects(model, currentTree) : []),
    ...(fieldList ? fieldList.defects : []),
    ...cycleCheck.defects,
    ...findExitReachDefects(model, zoneOrder),
    ...findFailureHandlingDefects(model),
    ...exitFailure.defects,
    ...findGroupOrderDefects(model, listMigrationSteps(model, currentTree)),
    ...dataFlow.defects,
    ...exitList.defects,
  ];
  const markedDefects = markTheScriptCases(model, defects, baseTree);
  return {
    headLines: [...cycleCheck.headLines, dataFlow.headLine, describeCurrentTree(currentTree), ...(fieldList ? [fieldList.headLine] : []), exitList.headLine, exitFailure.headLine, describeResponseTypes(completeness.libraryTypeNames), describeReview(reviewText), describeShapeReviews(shapeReviews)],
    defects: markedDefects,
    unmatchedScriptCases: listUnmatchedScriptCases(model, markedDefects),
    keyCountMap: completeness.keyCountMap,
  };
};
