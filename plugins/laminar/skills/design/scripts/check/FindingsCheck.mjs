import { FINDING_REASONS } from "../model/DesignModelForm.mjs";
import { KINDS, getFolderPath, isAText, isMarkedUnchanged, readList } from "../model/DesignModel.mjs";
import { isPlacedByThePlan, readNamedReviewItems, readReviewItems } from "./ReviewItems.mjs";
import { DEFECT_CODES, createDefect } from "./DesignDefect.mjs";
import { describeTheChangeOfTheFolder, describeTheChangeOfTheMember } from "./MemberChange.mjs";

const OUTSIDE_THE_CHANGE = "outside the change";

const isAShapeRunFinding = finding => finding.run !== undefined;

// A finding is closed by the tree, left with a reason, or open after the ceiling of shape runs with its intended change, and exactly 1 of the 3.
const FINDING_ENDING_KEYS = Object.freeze(["closedBy", "reason", "openAfterCeiling"]);

// A part closes a finding only where the design creates, moves, renames or modifies it; a class of an unchanged file, a method marked unchanged and an unchanged folder stay as they are.
const isAnUnchangedPart = (model, displayName) => {
  const folder = model.folders.find(other => getFolderPath(other) === displayName.replace(/\/+$/, ""));
  if (folder) return folder.kind === KINDS.UNCHANGED;
  const theClass = model.findClass(displayName);
  if (!theClass) return false;
  if (!model.isChangedClass(theClass) && !isAText(theClass.oldName)) return true;
  const methods = model.listMethodsOfTheName(displayName);
  return methods.length > 0 && methods.every(isMarkedUnchanged);
};

const findObjectDefects = (model, finding, path) => {
  const endingKeys = FINDING_ENDING_KEYS.filter(key => isAText(finding[key]));
  if (endingKeys.length > 1) return [createDefect(DEFECT_CODES.FINDING_CLOSED_AND_LEFT, path, `the finding ${finding.number} holds ${endingKeys.join(" and ")}, and holds 1 of ${FINDING_ENDING_KEYS.join(", ")}`)];
  if (!endingKeys.length) return [createDefect(DEFECT_CODES.FINDING_NEITHER_CLOSED_NOR_LEFT, path, `the finding ${finding.number} holds none of ${FINDING_ENDING_KEYS.join(", ")}, and holds 1 of them`)];
  if (isAText(finding.openAfterCeiling)) return [];
  if (isAText(finding.closedBy)) {
    if (isAnUnchangedPart(model, finding.closedBy)) return [createDefect(DEFECT_CODES.CLOSED_BY_UNCHANGED_PART, `${path}.closedBy`, `${finding.closedBy} closes the finding ${finding.number}, and the design neither creates, moves, renames nor modifies it`)];
    if (isAShapeRunFinding(finding) || model.holdsTheName(finding.closedBy)) return [];
    return [createDefect(DEFECT_CODES.NAME_UNRESOLVED, `${path}.closedBy`, `${finding.closedBy} names no class or method of the model`)];
  }

  const defects = [];
  if (!FINDING_REASONS.includes(finding.reason)) defects.push(createDefect(DEFECT_CODES.FINDING_REASON_OUTSIDE_LIST, `${path}.reason`, `${JSON.stringify(finding.reason)} is not 1 of ${FINDING_REASONS.join(", ")}`));
  if (!isAText(finding.says)) defects.push(createDefect(DEFECT_CODES.KEY_MISSING, `${path}.says`, "the key says is required here and is missing"));
  return defects;
};

const findItemDefects = (itemNumbers, findingsWithPath, reviewName, scaleWords = "") => {
  const findingNumbers = new Set(findingsWithPath.map(({ finding }) => finding.number));
  const defects = [];
  for (const itemNumber of itemNumbers) {
    if (!findingNumbers.has(itemNumber)) defects.push(createDefect(DEFECT_CODES.FINDING_WITHOUT_OBJECT, "decisions.findings", `the item ${itemNumber} of ${reviewName} has no object under decisions.findings`));
  }
  for (const { finding, path } of findingsWithPath) {
    if (finding.number !== undefined && !itemNumbers.has(finding.number)) defects.push(createDefect(DEFECT_CODES.FINDING_NUMBER_UNKNOWN, `${path}.number`, `${reviewName} holds no item ${finding.number}${scaleWords}`));
  }
  return defects;
};

const findMemberOfTheItem = (model, item) => {
  if (item.scale === "method") return { theClass: model.findClass(item.enclosing), methods: model.listMethodsOfTheName(`${item.enclosing}#${item.name}`) };
  if (item.scale === "variable" && model.findMethod(item.enclosing)) return { theClass: model.findClass(item.enclosing), methods: model.listMethodsOfTheName(item.enclosing) };
  if (item.scale === "class") {
    const theClass = model.findClass(item.name);
    return { theClass, methods: theClass ? readList(theClass.methods) : [] };
  }
  return null;
};

const findOutsideTheChangeDefect = (model, item, path, currentTree) => {
  if (item.scale === "module") {
    const folderChange = describeTheChangeOfTheFolder(model, item.name, currentTree);
    return folderChange ? createDefect(DEFECT_CODES.OUTSIDE_THE_CHANGE_BUT_CHANGED, `${path}.reason`, `the item ${item.number} is left as ${OUTSIDE_THE_CHANGE}, and ${folderChange}`) : null;
  }

  const member = findMemberOfTheItem(model, item);
  if (!member || !member.theClass || (item.scale !== "class" && !member.methods.length)) {
    return createDefect(DEFECT_CODES.OUTSIDE_THE_CHANGE_BUT_CHANGED, `${path}.reason`, `the item ${item.number} names no class or method of the model, so the script cannot show it ${OUTSIDE_THE_CHANGE}`);
  }

  const change = describeTheChangeOfTheMember(model, member.theClass, member.methods, currentTree);
  if (!change) return null;
  return createDefect(DEFECT_CODES.OUTSIDE_THE_CHANGE_BUT_CHANGED, `${path}.reason`, `the item ${item.number} is left as ${OUTSIDE_THE_CHANGE}, and ${change}`);
};

const listFindingsWithPath = model => readList(model.decisions.findings).map((finding, at) => ({ finding, path: `decisions.findings[${at}]` }));

const findShapeRunDefects = (model, shapeReview, currentTree) => {
  const items = readNamedReviewItems(shapeReview.text);
  const findingsWithPath = listFindingsWithPath(model).filter(({ finding }) => finding.run === shapeReview.run);
  const defects = findItemDefects(new Set(items.map(item => item.number)), findingsWithPath, `the review.md of shape run ${shapeReview.run}`);
  if (!currentTree) return defects;

  for (const { finding, path } of findingsWithPath) {
    const item = items.find(other => other.number === finding.number);
    if (!item || finding.reason !== OUTSIDE_THE_CHANGE) continue;
    const defect = findOutsideTheChangeDefect(model, item, path, currentTree);
    if (defect) defects.push(defect);
  }
  return defects;
};

export const findFindingsDefects = (model, reviewText, shapeReviews, currentTree) => {
  const defects = [];
  for (const { finding, path } of listFindingsWithPath(model)) {
    if (finding.number === undefined) defects.push(createDefect(DEFECT_CODES.KEY_MISSING, `${path}.number`, "the key number is required here and is missing"));
    defects.push(...findObjectDefects(model, finding, path));
  }
  if (reviewText !== null) {
    const itemNumbers = new Set(readReviewItems(reviewText).filter(isPlacedByThePlan).map(item => item.number));
    defects.push(...findItemDefects(itemNumbers, listFindingsWithPath(model).filter(({ finding }) => !isAShapeRunFinding(finding)), "review.md", " at the application, module or class scale"));
  }
  for (const shapeReview of shapeReviews) defects.push(...findShapeRunDefects(model, shapeReview, currentTree));
  return defects;
};
