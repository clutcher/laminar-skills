import { readList } from "../model/DesignModel.mjs";
import { DECIDED_DEFECT_CODES } from "../plan/DecidedList.mjs";
import { PLAN_SCALES, buildItemNumberOfFindingMap } from "../plan/FindingList.mjs";

const isTheObjectOfTheFinding = (findingObject, number, check) => findingObject.run === undefined && findingObject.number === number && (findingObject.check === undefined || findingObject.check === check);

const describeTheDifference = (findingObject, decision) => ["reason", "says", "decidedBy"]
  .filter(key => findingObject[key] !== decision[key])
  .map(key => `${key} ${JSON.stringify(findingObject[key] ?? null)} in place of ${JSON.stringify(decision[key])}`)
  .join(", ");

// Each finding at the application, module or class scale that the decided list decided stands in decisions.findings with the same reason, says and decidedBy, because the designer carries a decision of the calling session and never changes it.
export const findDecidedDefects = (model, run, decisionOfFindingMap) => {
  const itemNumberOfFindingMap = buildItemNumberOfFindingMap(run);
  const defects = [];
  for (const finding of run.findings.filter(other => PLAN_SCALES.has(other.scale) && decisionOfFindingMap.has(other.index))) {
    const number = itemNumberOfFindingMap.get(finding.index);
    const decision = decisionOfFindingMap.get(finding.index);
    const findingObject = readList(model.decisions.findings).find(other => isTheObjectOfTheFinding(other, number, finding.check));
    const difference = findingObject ? describeTheDifference(findingObject, decision) : "";
    if (findingObject && !difference) continue;

    const why = findingObject ? `its object of decisions.findings holds ${difference}` : "decisions.findings holds no object of it";
    defects.push({ code: DECIDED_DEFECT_CODES.DECIDED_NOT_CARRIED, name: finding.displayName, sentence: `item ${number} is decided as ${decision.reason} by ${decision.decidedBy}, and ${why}` });
  }
  return defects;
};
