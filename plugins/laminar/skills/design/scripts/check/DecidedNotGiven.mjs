import { isAText, readList } from "../model/DesignModel.mjs";
import { listFormerNames } from "../round/FormerNames.mjs";
import { DECIDED_BY_DEFAULT, DECIDED_DEFECT_CODES, createFindingCheckKey, listBoundaryMethodNamesOfTheImplementer, readChecksOfTheFinding } from "../plan/DecidedList.mjs";

const readDecidedByOfTheList = decided => decided.decidedBy || DECIDED_BY_DEFAULT;

// The decidedBy values that only the calling session gives: each of the decided list, caller where an object names none, and each of a decision the input run set apart; a value of no such source, such as user in the mode with a user, is the designer's own record.
const listSourcesOfTheDecisions = (decided, inputRun) => new Set([
  ...decided.map(readDecidedByOfTheList),
  ...(inputRun ? [...inputRun.decidedFindings, ...inputRun.changedSinceFindings].map(finding => finding.decidedBy).filter(isAText) : []),
]);

const claimsADecisionOfTheCaller = (findingObject, sources) => isAText(findingObject.reason) && isAText(findingObject.decidedBy) && !isAText(findingObject.closedBy) && sources.has(findingObject.decidedBy);

const listChecksOfTheObject = (findingObject, finding) => readChecksOfTheFinding(finding)
  .filter(check => findingObject.check === undefined || check === findingObject.check)
  .map(check => ({ finding, check }));

const findItemOfTheObject = (findingObject, inputRun, shapeRuns) => {
  if (!Number.isFinite(findingObject.run)) return inputRun ? inputRun.items.find(item => item.number === findingObject.number) || null : null;
  const shapeRun = shapeRuns.find(other => other.number === findingObject.run);
  return shapeRun ? shapeRun.run.items.find(item => item.number === findingObject.number) || null : null;
};

const readModelOfTheShapeRun = (findingObject, shapeRuns, model) => {
  const shapeRun = shapeRuns.find(other => other.number === findingObject.run);
  return (shapeRun && shapeRun.shapeModel) || model;
};

// An item of the input run is given where the decided list, resolved on the run, rules on its check with the same decidedBy.
const isGivenOnTheInputRun = (findingObject, { finding, check }, decisionOfFindingCheckMap) => {
  const decision = decisionOfFindingCheckMap.get(createFindingCheckKey(finding, check));
  return Boolean(decision) && decision.decidedBy === findingObject.decidedBy;
};

// An item of a shape run is given where an object of the decided list with the same decidedBy names its finding key with the check, under its own name or a former name the design model gives it, or the api or spi method that its method implements.
const isGivenOnTheShapeRun = (findingObject, { finding, check }, decided, shapeModel) => {
  const keys = new Set([...listFormerNames(shapeModel, null, finding.displayName), ...(shapeModel ? listBoundaryMethodNamesOfTheImplementer(shapeModel, finding.displayName) : [])]);
  return decided.some(other => isAText(other.displayName) && other.check === check && keys.has(other.displayName) && readDecidedByOfTheList(other) === findingObject.decidedBy);
};

const describeTheItem = findingObject => `the item ${findingObject.number}${Number.isFinite(findingObject.run) ? ` of shape run ${findingObject.run}` : ""}`;

// An object of decisions.findings that carries the decidedBy of the decided list, or of a decision of the input run, stands only on an item that an object of the list with that decidedBy decides, by its finding key with each check of the object, or for a shape run through its interface method, because a decidedBy copied onto another item sets apart a finding that nobody decided.
export const findDecidedNotGivenDefects = (model, decided, { inputRun = null, decisionOfFindingCheckMap = new Map(), shapeRuns = [] } = {}) => {
  const sources = listSourcesOfTheDecisions(decided, inputRun);
  const defects = [];
  for (const findingObject of readList(model.decisions.findings).filter(other => claimsADecisionOfTheCaller(other, sources))) {
    const item = findItemOfTheObject(findingObject, inputRun, shapeRuns);
    if (!item) continue;

    const shapeModel = Number.isFinite(findingObject.run) ? readModelOfTheShapeRun(findingObject, shapeRuns, model) : null;
    const isGiven = findingCheck => (Number.isFinite(findingObject.run) ? isGivenOnTheShapeRun(findingObject, findingCheck, decided, shapeModel) : isGivenOnTheInputRun(findingObject, findingCheck, decisionOfFindingCheckMap));
    const notGiven = item.findings.flatMap(finding => listChecksOfTheObject(findingObject, finding)).filter(findingCheck => !isGiven(findingCheck));
    defects.push(...notGiven.map(({ finding, check }) => ({ code: DECIDED_DEFECT_CODES.DECIDED_NOT_GIVEN, name: finding.displayName, sentence: `${describeTheItem(findingObject)} carries decidedBy ${findingObject.decidedBy}, and the decided list gives no object with that decidedBy on ${finding.displayName} with the check ${check}; an object that names its check carries the decision of that check only` })));
  }
  return defects;
};
