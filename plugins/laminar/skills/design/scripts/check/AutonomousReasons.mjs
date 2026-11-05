import { isAText, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createDefect } from "./DesignDefect.mjs";
import { readNamedReviewItems } from "./ReviewItems.mjs";

// The 2 reason classes that a script checks, so autonomous mode may take them without a user.
const AUTONOMOUS_REASONS = new Set(["outside the change", "project convention"]);

const QUESTION_TO_THE_AUTHOR = "question to the author";

const createItemKey = (run, number) => `${run ?? ""}:${number}`;

const listItemKeysToConsider = (reviewText, shapeReviews) => [
  ...(reviewText === null ? [] : readNamedReviewItems(reviewText).filter(item => item.toConsider).map(item => createItemKey(undefined, item.number))),
  ...shapeReviews.flatMap(shapeReview => readNamedReviewItems(shapeReview.text).filter(item => item.toConsider).map(item => createItemKey(shapeReview.run, item.number))),
];

const describeTheQuestion = finding => (Number.isFinite(finding.run) ? `shape-run-${finding.run}-item-${finding.number}` : `item-${finding.number}`);

// In autonomous mode the designer leaves a finding only with a reason class a script checks, and the calling session with any reason of its decided list; an item to consider may stay a question to the author, which ends the plan with the outcome question, because autonomous mode never passes a question in silence.
export const findAutonomousReasonResult = (model, reviewText, shapeReviews) => {
  const toConsiderKeys = new Set(listItemKeysToConsider(reviewText, shapeReviews));
  const defects = [];
  const questions = [];
  readList(model.decisions.findings).forEach((finding, at) => {
    if (!isAText(finding.reason) || isAText(finding.decidedBy) || AUTONOMOUS_REASONS.has(finding.reason)) return;
    if (finding.reason === QUESTION_TO_THE_AUTHOR && toConsiderKeys.has(createItemKey(finding.run, finding.number))) {
      questions.push(describeTheQuestion(finding));
      return;
    }
    defects.push(createDefect(DEFECT_CODES.REASON_NOT_AUTONOMOUS, `decisions.findings[${at}].reason`, `the item ${finding.number}${Number.isFinite(finding.run) ? ` of shape run ${finding.run}` : ""} takes ${finding.reason}, and autonomous mode takes only ${[...AUTONOMOUS_REASONS].join(" or ")}, a reason of the decided list, or ${QUESTION_TO_THE_AUTHOR} on an item to consider`));
  });
  return { defects, questions };
};
