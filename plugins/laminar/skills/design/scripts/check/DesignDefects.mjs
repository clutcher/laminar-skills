import { readList } from "../model/DesignModel.mjs";
import { readCurrentTree } from "../migration/CurrentTree.mjs";
import { findCompletenessDefects } from "./CompletenessCheck.mjs";
import { findCurrentTreeDefects } from "./CurrentTreeCheck.mjs";
import { findCycleCheckDefects } from "./CycleCheck.mjs";
import { findDataFlowDefects } from "./DataFlowCheck.mjs";
import { findNameOfThePath } from "./DefectNames.mjs";
import { findExitListResult } from "./ExitList.mjs";
import { findExitReachDefects } from "./ExitReach.mjs";
import { findFailureHandlingDefects } from "./FailureHandling.mjs";
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

const markTheScriptCases = (model, defects) => {
  const scriptCaseKeys = new Set(readList(model.decisions.scriptCases).map(scriptCase => joinScriptCaseKey(scriptCase.code, scriptCase.name, scriptCase.text)));
  return defects.map(defect => {
    const name = findNameOfThePath(model, defect.path) || defect.path;
    return { ...defect, name, foundWrong: defect.recheck && scriptCaseKeys.has(joinScriptCaseKey(defect.code, name, defect.sentence)) };
  });
};

const listUnmatchedScriptCases = (model, markedDefects) => {
  const foundWrongKeys = new Set(markedDefects.filter(defect => defect.foundWrong).map(defect => joinScriptCaseKey(defect.code, defect.name, defect.sentence)));
  return readList(model.decisions.scriptCases).filter(scriptCase => !foundWrongKeys.has(joinScriptCaseKey(scriptCase.code, scriptCase.name, scriptCase.text)));
};

// With a base commit, the current tree is that commit, never the working folder, which may hold the files of a writer.
export const checkDesignModel = (model, repositoryRoot = null, reviewText = null, shapeReviews = [], baseCommit = null) => {
  const currentTree = repositoryRoot ? readCurrentTree(repositoryRoot, baseCommit) : null;
  const zoneOrder = readZoneOrder(model.decisions.conventions?.zoneOrder, currentTree, model.listScopeFolderPaths());
  const completeness = findCompletenessDefects(model, zoneOrder);
  const cycleCheck = findCycleCheckDefects(model, zoneOrder);
  const dataFlow = findDataFlowDefects(model);
  const exitList = findExitListResult(model);
  const fieldList = currentTree ? findFieldListResult(model, currentTree) : null;
  const defects = [
    ...completeness.defects,
    ...findFindingsDefects(model, reviewText, shapeReviews, currentTree),
    ...(currentTree ? findCurrentTreeDefects(model, currentTree) : []),
    ...(fieldList ? fieldList.defects : []),
    ...cycleCheck.defects,
    ...findExitReachDefects(model, zoneOrder),
    ...findFailureHandlingDefects(model),
    ...findGroupOrderDefects(model, listMigrationSteps(model, currentTree)),
    ...dataFlow.defects,
    ...exitList.defects,
  ];
  const markedDefects = markTheScriptCases(model, defects);
  return {
    headLines: [...cycleCheck.headLines, dataFlow.headLine, describeCurrentTree(currentTree), ...(fieldList ? [fieldList.headLine] : []), exitList.headLine, describeResponseTypes(completeness.libraryTypeNames), describeReview(reviewText), describeShapeReviews(shapeReviews)],
    defects: markedDefects,
    unmatchedScriptCases: listUnmatchedScriptCases(model, markedDefects),
    keyCountMap: completeness.keyCountMap,
  };
};
