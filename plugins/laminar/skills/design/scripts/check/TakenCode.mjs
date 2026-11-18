import { isAText } from "../model/DesignModel.mjs";
import { holdsALinesFingerprint, isAClassSource, isACreatedMethod, listDecisionsOfTheSource, listMethodsThatTakeCode, namesTheHoldingClass } from "../plan/DecidedReview.mjs";
import { DEFECT_CODES, createDefect } from "./DesignDefect.mjs";

const namesTheMethodAndTheCheck = source => isAText(source.displayName) && isAText(source.check);

const readScaleWord = source => (isAClassSource(source) ? "class" : "method");

const describeWhyNoDecisionIsTaken = (theClass, method, source, decisionsOfTheSource) => {
  if (!isACreatedMethod(method)) return "the method is marked unchanged or renamed by oldName, so it stands in the current tree, and only a method the change creates takes the decision of the code it takes";
  if (!namesTheMethodAndTheCheck(source)) return "the source names no displayName and check as text, so it carries no decision; name the decided method and the check whose finding is about the moved lines";
  if (isAClassSource(source) && !namesTheHoldingClass(source, theClass)) return `${source.displayName} is not the class ${theClass.name} that holds the method, so a decision of it is not about code the method took; name only a class decision of ${theClass.name}, or remove the source`;
  if (!decisionsOfTheSource.length) return `no decision of the input run folder, of a shape run or of an earlier plan holds ${source.check} on that ${readScaleWord(source)}, so the key would set apart a finding that nobody ruled on; name only a check that the source holds as decided, or remove the source`;
  return `no decision of ${source.check} on that ${readScaleWord(source)} holds a lines fingerprint, so a taken decision would hold whatever the code becomes; remove the source`;
};

const formatTheSource = source => [source.check, source.displayName].filter(isAText).join(" ") || "a source with no name";

// A key takesCodeFrom only carries a decision that exists onto the code it moved into, so a source is a defect where it can carry none: on a method the change does not create, on a class that does not hold the method, or where the named method or class holds no decision of the named check with a lines fingerprint.
export const findTakenCodeDefects = (model, decisions) => listMethodsThatTakeCode(model).flatMap(({ theClass, method, displayName, sources }) => sources
  .map(source => ({ source, decisionsOfTheSource: listDecisionsOfTheSource(decisions, source, theClass) }))
  .filter(({ decisionsOfTheSource }) => !isACreatedMethod(method) || !decisionsOfTheSource.some(holdsALinesFingerprint))
  .map(({ source, decisionsOfTheSource }) => createDefect(
    DEFECT_CODES.TAKES_CODE_FROM_NO_DECISION,
    `${model.getMethodPath(theClass, method)}.takesCodeFrom`,
    `${displayName} takes code from ${formatTheSource(source)}, and ${describeWhyNoDecisionIsTaken(theClass, method, source, decisionsOfTheSource)}`,
  )));
