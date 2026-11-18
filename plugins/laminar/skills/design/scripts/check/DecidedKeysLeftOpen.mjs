import { isWaitingAfterTheChangesTried, readList } from "../model/DesignModel.mjs";
import { DECIDED_BY_DEFAULT, DECIDED_DEFECT_CODES, decidesTheShapeFinding, listBoundaryMethodNamesOfTheImplementer, readChecksOfTheFinding } from "../plan/DecidedList.mjs";
import { listShapeQuestions } from "./AutonomousReasons.mjs";

const DOES_NOT_CLOSE = "doesNotClose";

const QUESTION_TO_THE_AUTHOR = "question to the author";

// The objects of decisions.findings that end the plan on an item of a shape run: a proof that the item does not close, and a shape question.
const listObjectsThatLeaveTheItemOpen = (model, reviewText, shapeReviews) => [
  ...readList(model.decisions.findings).filter(isWaitingAfterTheChangesTried).map(findingObject => ({ findingObject, ending: DOES_NOT_CLOSE })),
  ...listShapeQuestions(model, reviewText, shapeReviews).map(findingObject => ({ findingObject, ending: QUESTION_TO_THE_AUTHOR })),
];

const findItemOfTheObject = (findingObject, shapeRuns) => {
  const shapeRun = shapeRuns.find(other => other.number === findingObject.run);
  return shapeRun ? { item: shapeRun.run.items.find(other => other.number === findingObject.number) || null, shapeModel: shapeRun.shapeModel } : { item: null, shapeModel: null };
};

// The names under which the decided list decides a finding of a shape run: its own, and the api or spi method that its method implements, read from the model of the shape run, else the design model.
const listNamesOfTheFinding = (finding, shapeModel) => new Set([finding.displayName, ...(shapeModel ? listBoundaryMethodNamesOfTheImplementer(shapeModel, finding.displayName) : [])]);

// Each check of the item that the object names, or every check of the item where it names none, with the first object of the decided list that decides it.
const listDecidedChecksOfTheItem = (findingObject, item, decided, shapeModel) => {
  const decidedChecks = new Map();
  for (const finding of item.findings) {
    const names = listNamesOfTheFinding(finding, shapeModel);
    for (const check of readChecksOfTheFinding(finding).filter(other => findingObject.check === undefined || other === findingObject.check)) {
      const decision = decided.find(other => decidesTheShapeFinding(other, names, finding, check));
      const key = `${finding.displayName}\t${check}`;
      if (decision && !decidedChecks.has(key)) decidedChecks.set(key, { displayName: finding.displayName, check, decision });
    }
  }
  return [...decidedChecks.values()];
};

const describeTheDefect = (findingObject, ending, { displayName, check, decision }) => `the item ${findingObject.number} of shape run ${findingObject.run} holds ${ending} on ${displayName} with the check ${check}, and the decided list already decides that finding as ${decision.reason} by ${decision.decidedBy || DECIDED_BY_DEFAULT}, so the plan may not end on it; write that reason, its says and its decidedBy on the object of the item in place of ${ending}`;

// A proof that an item does not close, and a shape question, stand only on an item whose finding key the decided list does not decide, because the calling session already gave that finding its reason class and the plan carries it instead of ending on it; 1 line per decided check.
export const findDecidedKeyLeftOpenDefects = (model, decided, { shapeRuns = [], reviewText = null, shapeReviews = [] } = {}) => listObjectsThatLeaveTheItemOpen(model, reviewText, shapeReviews).flatMap(({ findingObject, ending }) => {
  const { item, shapeModel } = findItemOfTheObject(findingObject, shapeRuns);
  if (!item) return [];
  return listDecidedChecksOfTheItem(findingObject, item, decided, shapeModel || model)
    .map(decidedCheck => ({ code: DECIDED_DEFECT_CODES.DECIDED_KEY_LEFT_OPEN, name: decidedCheck.displayName, sentence: describeTheDefect(findingObject, ending, decidedCheck) }));
});
