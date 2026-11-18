import fs from "node:fs";
import path from "node:path";
import { holdsADecidedReason, isAText, readList } from "../model/DesignModel.mjs";
import { SHAPE_MODEL_FILE } from "../round/RunFolder.mjs";
import { DEFECT_CODES, createDefect, createQuestionDefect } from "./DesignDefect.mjs";

// The shape loop ends on an item only after this many changes of the tree aimed at it, each judged by a shape run that still kept it, because a stop after 1 change ends loops that the next change closes.
export const CHANGES_TRIED = 2;

const holdsDoesNotClose = finding => finding.run !== undefined && isAText(finding.doesNotClose);

const describeTheItem = finding => `the item ${finding.number}${isAText(finding.check) ? ` (${finding.check})` : ""} of shape run ${finding.run}`;

const describeTheKey = key => `${key.displayName} with the check ${key.check}`;

const readTheShapeModelText = shapeRun => {
  const shapeModelPath = path.join(shapeRun.run.runFolder, SHAPE_MODEL_FILE);
  return fs.existsSync(shapeModelPath) ? fs.readFileSync(shapeModelPath, "utf8") : null;
};

// The 1 finding key of the item of the last shape run, by the check of the object where 1 item holds 2 checks.
const readTheKeyOfTheItem = (item, finding) => {
  const keys = new Map(item.findings
    .filter(itemFinding => !isAText(finding.check) || itemFinding.check === finding.check)
    .map(itemFinding => [`${itemFinding.displayName}\t${itemFinding.check}`, { displayName: itemFinding.displayName, check: itemFinding.check }]));
  if (keys.size === 1) return { key: [...keys.values()][0] };
  if (!keys.size) return { problem: `${describeTheItem(finding)} holds no finding${isAText(finding.check) ? ` of the check ${finding.check}` : ""}` };
  return { problem: `${describeTheItem(finding)} holds the checks ${[...keys.values()].map(key => key.check).join(", ")}, so the object names the check that does not close` };
};

// The change tried in 1 earlier shape run: the item of that run with the same key, the closedBy of its object, and a shape model that changed in the next run.
const traceTheChangeTried = (model, key, shapeRunOfNumberMap, run) => {
  const shapeRun = shapeRunOfNumberMap.get(run);
  if (!shapeRun) return { problem: `shape run ${run} is not given as --shape-review` };

  const item = shapeRun.run.items.find(other => other.findings.some(itemFinding => itemFinding.displayName === key.displayName && itemFinding.check === key.check));
  if (!item) return { problem: `shape run ${run} did not keep ${describeTheKey(key)}` };
  const object = readList(model.decisions.findings).find(other => other.run === run && other.number === item.number);
  if (!object || !isAText(object.closedBy)) return { problem: `the object of the item ${item.number} of shape run ${run} holds no closedBy, so no change of the tree was aimed at it` };

  const nextShapeRun = shapeRunOfNumberMap.get(run + 1);
  if (!nextShapeRun) return { problem: `shape run ${run + 1} is not given as --shape-review` };
  const shapeModelText = readTheShapeModelText(shapeRun);
  const nextShapeModelText = readTheShapeModelText(nextShapeRun);
  if (shapeModelText === null || nextShapeModelText === null) return { problem: `shape run ${run} or ${run + 1} holds no ${SHAPE_MODEL_FILE}, so the script cannot show that the tree changed` };
  if (shapeModelText === nextShapeModelText) return { problem: `shape run ${run + 1} judged the same tree as shape run ${run}, so the change of the item ${item.number} of shape run ${run} never reached the tree` };
  return { changeTried: { run, number: item.number, change: object.closedBy } };
};

// The changes tried on 1 finding key in the CHANGES_TRIED shape runs before the given run, oldest first, or the first fact that fails.
const traceTheChangesTried = (model, key, shapeRunOfNumberMap, run) => {
  const changesTried = [];
  for (let earlierRun = run - CHANGES_TRIED; earlierRun < run; earlierRun++) {
    const traced = traceTheChangeTried(model, key, shapeRunOfNumberMap, earlierRun);
    if (traced.problem) return { problem: traced.problem };
    changesTried.push(traced.changeTried);
  }
  return { changesTried };
};

// The proof of an item that does not close, from the shape-run folders: it stands in the last shape run, and each of the CHANGES_TRIED shape runs before it kept its key after a change of the tree aimed at it.
export const traceTheItemThatDoesNotClose = (model, finding, shapeRuns) => {
  const shapeRunOfNumberMap = new Map(shapeRuns.map(shapeRun => [shapeRun.number, shapeRun]));
  const lastShapeRun = Math.max(0, ...shapeRunOfNumberMap.keys());
  if (finding.run !== lastShapeRun) return { problem: `shape run ${lastShapeRun} is the last shape run, so the shape loop went on after shape run ${finding.run}` };
  if (finding.run <= CHANGES_TRIED) return { problem: `${finding.run - 1} shape run(s) stand before shape run ${finding.run}, and the stop needs ${CHANGES_TRIED} changes tried, each judged by a later shape run` };
  const item = shapeRunOfNumberMap.get(finding.run).run.items.find(other => other.number === finding.number);
  if (!item) return { problem: `shape run ${finding.run} holds no item ${finding.number}` };

  const { key, problem } = readTheKeyOfTheItem(item, finding);
  if (problem) return { problem };
  const { changesTried, problem: changeProblem } = traceTheChangesTried(model, key, shapeRunOfNumberMap, finding.run);
  if (changeProblem) return { problem: changeProblem };
  return { proof: { run: finding.run, number: finding.number, displayName: key.displayName, check: key.check, says: finding.doesNotClose, changesTried } };
};

const listObjectsWithTheEnding = model => readList(model.decisions.findings)
  .map((finding, at) => ({ finding, path: `decisions.findings[${at}].doesNotClose` }))
  .filter(({ finding }) => holdsDoesNotClose(finding));

const describeTheChangesTried = changesTried => changesTried.map(changeTried => `shape run ${changeTried.run}, item ${changeTried.number}: ${changeTried.change}`).join("; ");

// A stop without its proof is refused, because the shape loop has no ceiling of its own; a proven stop with no decided reason is a question for the user, and in autonomous mode the plan ends with the outcome stop.
export const findItemsThatDoNotCloseDefects = (model, shapeRuns) => listObjectsWithTheEnding(model).flatMap(({ finding, path: findingPath }) => {
  const { proof, problem } = traceTheItemThatDoesNotClose(model, finding, shapeRuns);
  if (problem) return [createDefect(DEFECT_CODES.DOES_NOT_CLOSE_WITHOUT_PROOF, findingPath, `${describeTheItem(finding)} holds doesNotClose, and ${problem}; change the tree for the item and run the next shape run`)];
  if (holdsADecidedReason(finding)) return [];
  return [createQuestionDefect(DEFECT_CODES.ITEM_DOES_NOT_CLOSE, findingPath, `${describeTheItem(finding)} keeps ${describeTheKey(proof)} after ${CHANGES_TRIED} changes of the tree, ${describeTheChangesTried(proof.changesTried)}, so the shape loop ends on it; ask the user with the changes tried, or where no user can answer, the plan ends with the outcome stop`)];
});

// The proven items that do not close and hold no decided reason, each with its finding key and the changes tried, as outcome.json lists them.
export const listItemsThatDoNotClose = (model, shapeRuns) => listObjectsWithTheEnding(model)
  .filter(({ finding }) => !holdsADecidedReason(finding))
  .map(({ finding }) => traceTheItemThatDoesNotClose(model, finding, shapeRuns).proof)
  .filter(Boolean);

const listKeysOfTheItem = item => [...new Map(item.findings.map(itemFinding => [`${itemFinding.displayName}\t${itemFinding.check}`, { displayName: itemFinding.displayName, check: itemFinding.check }])).values()];

// An object answers a proven item where it holds a decided reason, or where it ends the loop with doesNotClose in the last shape run.
const isAnsweredOnTheObject = (model, run, number, key, lastShapeRun) => readList(model.decisions.findings)
  .filter(object => object.run === run && object.number === number && (object.check === undefined || object.check === key.check))
  .some(object => holdsADecidedReason(object) || (run === lastShapeRun && holdsDoesNotClose(object)));

// Every item of a shape run whose proof is complete, so the designer never judges convergence itself: the plan ends on it with item-does-not-close, and a plan ready or a later shape run over it, unanswered, is a defect.
export const findProvenItemDefects = (model, shapeRuns) => {
  const shapeRunOfNumberMap = new Map(shapeRuns.map(shapeRun => [shapeRun.number, shapeRun]));
  const lastShapeRun = Math.max(0, ...shapeRunOfNumberMap.keys());
  const defects = [];
  for (const shapeRun of shapeRuns.filter(other => other.number > CHANGES_TRIED)) {
    for (const item of shapeRun.run.items) {
      for (const key of listKeysOfTheItem(item)) {
        const { changesTried } = traceTheChangesTried(model, key, shapeRunOfNumberMap, shapeRun.number);
        if (!changesTried || isAnsweredOnTheObject(model, shapeRun.number, item.number, key, lastShapeRun)) continue;
        const later = shapeRun.number < lastShapeRun ? `, and shape run ${lastShapeRun} judged a later tree over it` : "";
        defects.push(createDefect(DEFECT_CODES.PROVEN_ITEM_NOT_STOPPED, `shape run ${shapeRun.number} item ${item.number}`, `the item ${item.number} of shape run ${shapeRun.number} keeps ${describeTheKey(key)} after ${CHANGES_TRIED} changes of the tree, ${describeTheChangesTried(changesTried)}${later}, so the plan ends with item-does-not-close: write doesNotClose on its object and run no further shape run on it, or in the mode with a user ask the user with the changes tried`));
      }
    }
  }
  return defects;
};

export const holdsAnItemThatDoesNotClose = model => listObjectsWithTheEnding(model).length > 0;
