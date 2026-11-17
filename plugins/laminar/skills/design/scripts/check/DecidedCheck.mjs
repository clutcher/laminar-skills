import { readList } from "../model/DesignModel.mjs";
import { DECIDED_DEFECT_CODES, createFindingCheckKey, readChecksOfTheFinding } from "../plan/DecidedList.mjs";
import { PLAN_SCALES, buildItemNumberOfFindingMap } from "../plan/FindingList.mjs";

const isTheObjectOfTheFinding = (findingObject, number, check) => findingObject.run === undefined && findingObject.number === number && (findingObject.check === undefined || findingObject.check === check);

const describeTheDifference = (findingObject, decision) => ["reason", "says", "decidedBy"]
  .filter(key => findingObject[key] !== decision[key])
  .map(key => `${key} ${JSON.stringify(findingObject[key] ?? null)} in place of ${JSON.stringify(decision[key])}`)
  .join(", ");

// The check named only where the item holds a result the merge combined, so the sentence says which check of it the decided list decided.
const describeTheItem = (number, finding, check) => (readChecksOfTheFinding(finding).length > 1 ? `item ${number} with the check ${check}` : `item ${number}`);

// Each check at the application, module or class scale that the decided list decided stands in decisions.findings with the same reason, says and decidedBy, because the designer carries a decision of the calling session and never changes it; a combined result is checked per check, by an object that names that check or no check.
export const findDecidedDefects = (model, run, decisionOfFindingCheckMap) => {
  const itemNumberOfFindingMap = buildItemNumberOfFindingMap(run);
  const defects = [];
  for (const finding of run.findings.filter(other => PLAN_SCALES.has(other.scale))) {
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
