import { isAText, readList } from "../model/DesignModel.mjs";
import { PLAN_SCALES } from "./FindingList.mjs";

const SENT_TO = Object.freeze({ DESIGNER: "designer", WRITER: "writer" });

const findObjectOfTheItem = (model, number, check) => readList(model.decisions.findings)
  .find(other => other.run === undefined && other.number === number && (other.check === undefined || other.check === check));

const writeTheReason = decision => ({ reason: decision.reason, says: decision.says, ...(isAText(decision.decidedBy) ? { decidedBy: decision.decidedBy } : {}) });

// The ending of 1 check of 1 item: the decision of the decided list, else for an item the model places its object of decisions.findings, else a writer where the plan gives a finding step and the designer where the model removes the abstraction.
const decideTheEnding = (model, number, check, findings, context) => {
  const decision = findings.map(finding => context.decisionOfFindingMap.get(finding.index)).find(Boolean);
  if (decision) return writeTheReason(decision);
  if (PLAN_SCALES.has(findings[0].scale)) {
    const findingObject = findObjectOfTheItem(model, number, check);
    if (!findingObject) return null;
    return isAText(findingObject.reason) ? writeTheReason(findingObject) : { to: SENT_TO.DESIGNER };
  }
  const isWithNoStep = context.noStepKeys.has(`${number}\t${check}`);
  return isWithNoStep ? { to: SENT_TO.DESIGNER } : { to: SENT_TO.WRITER };
};

// The dispositions file of the round that the review of the plan before ran, in the form recordRound.mjs reads: 1 object per item, and 1 per check where 1 item holds 2 checks.
export const listRoundDispositions = (model, run, context) => run.items.flatMap(item => {
  const checks = [...new Set(item.findings.map(finding => finding.check))];
  return checks.flatMap(check => {
    const ending = decideTheEnding(model, item.number, check, item.findings.filter(finding => finding.check === check), context);
    if (!ending) return [];
    return [{ number: item.number, ...(checks.length > 1 ? { check } : {}), ...ending }];
  });
});
