import { isAText, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createDefect } from "./DesignDefect.mjs";
import { readNamedReviewItems } from "./ReviewItems.mjs";

// The 2 reason classes that a script checks, so autonomous mode may take them without a user.
const AUTONOMOUS_REASONS = new Set(["outside the change", "project convention"]);

const QUESTION_TO_THE_AUTHOR = "question to the author";

const METHOD_MARK = "#";

const SCALES_OF_A_MEMBER = new Set(["method", "variable"]);

const createItemKey = (run, number) => `${run ?? ""}:${number}`;

const readKeyOfTheFinding = finding => createItemKey(Number.isFinite(finding.run) ? finding.run : undefined, finding.number);

// The display name of an item from its head line, where no finding of the run gives it: a member of a class is named by its class and the member.
const readDisplayNameOfTheHead = item => (SCALES_OF_A_MEMBER.has(item.scale) && item.enclosing ? `${item.enclosing}${METHOD_MARK}${item.name}` : item.name);

// Each item to consider of the run folder and of the shape runs, by its item key.
const mapItemsToConsider = (reviewText, shapeReviews) => new Map([
  ...(reviewText === null ? [] : readNamedReviewItems(reviewText).filter(item => item.toConsider).map(item => [createItemKey(undefined, item.number), item])),
  ...shapeReviews.flatMap(shapeReview => readNamedReviewItems(shapeReview.text).filter(item => item.toConsider).map(item => [createItemKey(shapeReview.run, item.number), item])),
]);

const isAnOpenQuestion = finding => finding.reason === QUESTION_TO_THE_AUTHOR && !isAText(finding.decidedBy);

// The objects of decisions.findings on an item to consider, which a script may leave as a question to the author, because the item claims no defect.
export const listFindingsToConsider = (model, reviewText, shapeReviews) => {
  const itemOfKeyMap = mapItemsToConsider(reviewText, shapeReviews);
  return readList(model.decisions.findings)
    .filter(finding => itemOfKeyMap.has(readKeyOfTheFinding(finding)))
    .map(finding => ({ finding, item: itemOfKeyMap.get(readKeyOfTheFinding(finding)) }));
};

// In autonomous mode the designer leaves a finding only with a reason class a script checks, and the calling session with any reason of its decided list; an item to consider may stay a question to the author, which the plan passes on as a consideration.
export const findAutonomousReasonDefects = (model, reviewText, shapeReviews) => {
  const toConsider = new Set(listFindingsToConsider(model, reviewText, shapeReviews).map(({ finding }) => finding));
  const defects = [];
  readList(model.decisions.findings).forEach((finding, at) => {
    if (!isAText(finding.reason) || isAText(finding.decidedBy) || AUTONOMOUS_REASONS.has(finding.reason)) return;
    if (finding.reason === QUESTION_TO_THE_AUTHOR && toConsider.has(finding)) return;
    defects.push(createDefect(DEFECT_CODES.REASON_NOT_AUTONOMOUS, `decisions.findings[${at}].reason`, `the item ${finding.number}${Number.isFinite(finding.run) ? ` of shape run ${finding.run}` : ""} takes ${finding.reason}, and autonomous mode takes only ${[...AUTONOMOUS_REASONS].join(" or ")}, a reason of the decided list, or ${QUESTION_TO_THE_AUTHOR} on an item to consider`));
  });
  return defects;
};

// The considerations of the plan outcome: 1 per item to consider that the plan leaves as a question to the author with no decidedBy, keyed as the decided list keys a finding; the display name and the check come from a finding of the run where one is given.
export const listConsiderations = (model, reviewText, shapeReviews, findNameOfTheItem) => listFindingsToConsider(model, reviewText, shapeReviews)
  .filter(({ finding }) => isAnOpenQuestion(finding))
  .map(({ finding, item }) => {
    const fromTheRun = Number.isFinite(finding.run) ? null : findNameOfTheItem(finding.number, finding.check);
    return {
      ...(Number.isFinite(finding.run) ? { run: finding.run } : {}),
      number: finding.number,
      displayName: fromTheRun ? fromTheRun.displayName : readDisplayNameOfTheHead(item),
      check: isAText(finding.check) ? finding.check : (fromTheRun ? fromTheRun.check : null),
      says: finding.says,
    };
  });
