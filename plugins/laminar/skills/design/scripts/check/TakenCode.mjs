import { holdsALinesFingerprint, isACreatedMethod, listDecisionsOfTheSource, listMethodsThatTakeCode } from "../plan/DecidedReview.mjs";
import { DEFECT_CODES, createDefect } from "./DesignDefect.mjs";

const describeWhyNoDecisionIsTaken = (method, decisionsOfTheSource) => {
  if (!isACreatedMethod(method)) return "the method is marked unchanged or renamed by oldName, so it stands in the current tree, and only a method the change creates takes the decision of the code it takes";
  if (!decisionsOfTheSource.length) return "no decision of the input run folder, of a shape run or of an earlier plan holds that method, so the key would set apart a finding that nobody ruled on; remove the key";
  return "no decision of that method holds a lines fingerprint, so a taken decision would hold whatever the code becomes; remove the key";
};

// A key takesCodeFrom only carries a decision that exists onto the code it moved into, so it is a defect where it can carry none: on a method the change does not create, or where the named method holds no decision with a lines fingerprint.
export const findTakenCodeDefects = (model, decisions) => listMethodsThatTakeCode(model).flatMap(({ theClass, method, displayName, sources }) => sources
  .map(source => ({ source, decisionsOfTheSource: listDecisionsOfTheSource(decisions, source) }))
  .filter(({ decisionsOfTheSource }) => !isACreatedMethod(method) || !decisionsOfTheSource.some(holdsALinesFingerprint))
  .map(({ source, decisionsOfTheSource }) => createDefect(
    DEFECT_CODES.TAKES_CODE_FROM_NO_DECISION,
    `${model.getMethodPath(theClass, method)}.takesCodeFrom`,
    `${displayName} takes code from ${source}, and ${describeWhyNoDecisionIsTaken(method, decisionsOfTheSource)}`,
  )));
