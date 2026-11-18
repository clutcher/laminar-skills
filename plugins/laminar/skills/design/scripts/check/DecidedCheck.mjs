import { isAText, readList } from "../model/DesignModel.mjs";
import { DECIDED_DEFECT_CODES, createFindingCheckKey, readChecksOfTheFinding } from "../plan/DecidedList.mjs";
import { PLAN_SCALES, buildItemNumberOfFindingMap } from "../plan/FindingList.mjs";

const isTheObjectOfTheFinding = (findingObject, number, check) => findingObject.run === undefined && findingObject.number === number && (findingObject.check === undefined || findingObject.check === check);

const describeTheDifference = (findingObject, decision) => ["reason", "says", "decidedBy"]
  .filter(key => findingObject[key] !== decision[key])
  .map(key => `${key} ${JSON.stringify(findingObject[key] ?? null)} in place of ${JSON.stringify(decision[key])}`)
  .join(", ");

// The check named only where the item holds a result the merge combined, so the sentence says which check of it the decided list decided.
const describeTheItem = (number, finding, check) => (readChecksOfTheFinding(finding).length > 1 ? `item ${number} with the check ${check}` : `item ${number}`);

// Each check at the application, module or class scale that the decided list decided stands in decisions.findings with the same reason, says and decidedBy, because the designer carries a decision of the calling session and never changes it; a combined result is checked per check, by an object that names that check or no check. A finding that no item of its scale shows has no object of decisions.findings, which holds 1 object per item, so findings.json carries its decision by its finding key.
export const findDecidedDefects = (model, run, decisionOfFindingCheckMap) => {
  const itemNumberOfFindingMap = buildItemNumberOfFindingMap(run);
  const defects = [];
  for (const finding of run.findings.filter(other => PLAN_SCALES.has(other.scale) && itemNumberOfFindingMap.has(other.index))) {
    for (const check of readChecksOfTheFinding(finding).filter(other => decisionOfFindingCheckMap.has(createFindingCheckKey(finding, other)))) {
      const number = itemNumberOfFindingMap.get(finding.index);
      const decision = decisionOfFindingCheckMap.get(createFindingCheckKey(finding, check));
      const findingObject = readList(model.decisions.findings).find(other => isTheObjectOfTheFinding(other, number, check));
      const difference = findingObject ? describeTheDifference(findingObject, decision) : "";
      if (findingObject && !difference) continue;

      const why = findingObject ? `its object of decisions.findings holds ${difference}` : "decisions.findings holds no object of it";
      defects.push({ code: DECIDED_DEFECT_CODES.DECIDED_NOT_CARRIED, name: finding.displayName, sentence: `${describeTheItem(number, finding, check)} is decided as ${decision.reason} by ${decision.decidedBy}, and ${why}` });
    }
  }
  return defects;
};

const describeTheInterfaceMethod = shapeItem => (shapeItem.decidedThrough ? ` through its interface method ${shapeItem.decidedThrough}` : "");

const isTheObjectOfTheShapeItem =(findingObject, shapeItem) => findingObject.run === shapeItem.shapeRun && findingObject.number === shapeItem.number && (findingObject.check === undefined || findingObject.check === shapeItem.check);

// Each item of a shape run that the decided list decided by its finding key stands in decisions.findings with the same reason, says and decidedBy, beside openAfterCeiling where it has one, because the designer carries a decision of the calling session and never changes it; an item that the tree closed needs no decision.
export const findShapeDecidedDefects = (model, decidedShapeItems) => {
  const defects = [];
  for (const shapeItem of decidedShapeItems) {
    const findingObject = readList(model.decisions.findings).find(other => isTheObjectOfTheShapeItem(other, shapeItem));
    if (findingObject && isAText(findingObject.closedBy)) continue;
    const difference = findingObject ? describeTheDifference(findingObject, shapeItem.decision) : "";
    if (findingObject && !difference) continue;

    const why = findingObject ? `its object of decisions.findings holds ${difference}` : "decisions.findings holds no object of it";
    defects.push({ code: DECIDED_DEFECT_CODES.DECIDED_NOT_CARRIED, name: shapeItem.displayName, sentence: `shape run ${shapeItem.shapeRun}, item ${shapeItem.number} is decided as ${shapeItem.decision.reason} by ${shapeItem.decision.decidedBy}${describeTheInterfaceMethod(shapeItem)}, and ${why}` });
  }
  return defects;
};
