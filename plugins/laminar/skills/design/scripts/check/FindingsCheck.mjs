import { FINDING_REASONS } from "../model/DesignModelForm.mjs";
import { KINDS, getFolderPath, holdsADecidedReason, holdsAnOpenEnding, isAText, isMarkedUnchanged, isWaitingAfterTheCeiling, readList } from "../model/DesignModel.mjs";
import { isPlacedByThePlan, readNamedReviewItems, readReviewItems } from "./ReviewItems.mjs";
import { DEFECT_CODES, createDefect, createQuestionDefect } from "./DesignDefect.mjs";
import { describeTheChangeOfTheFields, describeTheChangeOfTheFolder, describeTheChangeOfTheMember } from "./MemberChange.mjs";

const OUTSIDE_THE_CHANGE = "outside the change";

// Shape mode names a group of fields by their names joined with this separator.
const FIELD_GROUP_SEPARATOR = ", ";

const isAShapeRunFinding = finding => finding.run !== undefined;

// A finding is closed by the tree, left with a reason, open after the ceiling of shape runs with its intended change, or not closed by the changes tried, and exactly 1 of the 4; a finding open after the ceiling or not closed may also hold the reason that the user or the decided list gave it.
const FINDING_ENDING_KEYS = Object.freeze(["closedBy", "reason", "openAfterCeiling", "doesNotClose"]);

const isAnOpenEndingWithADecidedReason = (finding, endingKeys) => endingKeys.length === 2 && endingKeys.includes("reason") && holdsAnOpenEnding(finding) && holdsADecidedReason(finding);

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
  if (endingKeys.length > 1 && !isAnOpenEndingWithADecidedReason(finding, endingKeys)) return [createDefect(DEFECT_CODES.FINDING_CLOSED_AND_LEFT, path, `the finding ${finding.number} holds ${endingKeys.join(" and ")}, and holds 1 of ${FINDING_ENDING_KEYS.join(", ")}`)];
  if (!endingKeys.length) return [createDefect(DEFECT_CODES.FINDING_NEITHER_CLOSED_NOR_LEFT, path, `the finding ${finding.number} holds none of ${FINDING_ENDING_KEYS.join(", ")}, and holds 1 of them`)];
  if (holdsAnOpenEnding(finding) && !isAText(finding.reason)) return [];
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

const describeTheShapeRunItem = finding => `the item ${finding.number}${isAText(finding.check) ? ` (${finding.check})` : ""} of shape run ${finding.run}`;

// The highest shape run of --shape-review, or 0 where none is given.
const readTheLastShapeRun = shapeReviews => Math.max(0, ...shapeReviews.map(shapeReview => shapeReview.run));

const describeTheUnreachedCeiling = (ceiling, lastShapeRun) => (ceiling === null ? "the input states no ceiling of shape runs" : `the shape runs reached ${lastShapeRun} of the ceiling of ${ceiling}`);

// Only a reached ceiling stops the shape loop, so before it, and where the input states none, the designer runs the next shape run or ends the loop by an item that does not close.
const findOpenWithoutACeilingDefect = (finding, path, ceiling, lastShapeRun) => {
  if (finding.run === undefined || !isAText(finding.openAfterCeiling)) return [];
  if (ceiling !== null && lastShapeRun >= ceiling) return [];
  return [createDefect(DEFECT_CODES.OPEN_WITHOUT_A_CEILING, `${path}.openAfterCeiling`, `${describeTheShapeRunItem(finding)} holds openAfterCeiling, and ${describeTheUnreachedCeiling(ceiling, lastShapeRun)}, so no ceiling ends the shape loop; run the next shape run on the change, or end the loop by doesNotClose where 2 changes of the tree did not close the item`)];
};

// No shape check judged the change of a finding open after the ceiling, and no script can decide it, so only the user or the decided list leaves it, and the plan ends with the outcome question until one does.
const findOpenAfterCeilingDefect = (finding, path) => {
  if (!isWaitingAfterTheCeiling(finding)) return [];
  return [createQuestionDefect(DEFECT_CODES.OPEN_AFTER_CEILING, `${path}.openAfterCeiling`, `${describeTheShapeRunItem(finding)} is open after the ceiling, and no reason class with says and decidedBy leaves it, so the plan ends with the outcome question and no writer writes its change; ask the user, or where no user can answer, end the plan`)];
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

// An item on a field names a class as its enclosing name, where an item on a local variable names a method.
const findClassOfTheFieldItem = (model, item) => {
  if (item.scale !== "variable" || model.findMethod(item.enclosing)) return null;
  return model.findClass(item.enclosing);
};

const findOutsideTheChangeDefect = (model, item, path, currentTree) => {
  if (item.scale === "module") {
    const folderChange = describeTheChangeOfTheFolder(model, item.name, currentTree);
    return folderChange ? createDefect(DEFECT_CODES.OUTSIDE_THE_CHANGE_BUT_CHANGED, `${path}.reason`, `the item ${item.number} is left as ${OUTSIDE_THE_CHANGE}, and ${folderChange}`) : null;
  }

  const fieldClass = findClassOfTheFieldItem(model, item);
  if (fieldClass) {
    const fieldChange = describeTheChangeOfTheFields(model, fieldClass, item.name.split(FIELD_GROUP_SEPARATOR), currentTree);
    return fieldChange ? createDefect(DEFECT_CODES.OUTSIDE_THE_CHANGE_BUT_CHANGED, `${path}.reason`, `the item ${item.number} is left as ${OUTSIDE_THE_CHANGE}, and ${fieldChange}`) : null;
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

// The ceiling is the ceiling of shape runs that the input states, else null.
export const findFindingsDefects = (model, reviewText, shapeReviews, currentTree, ceiling = null) => {
  const lastShapeRun = readTheLastShapeRun(shapeReviews);
  const defects = [];
  for (const { finding, path } of listFindingsWithPath(model)) {
    if (finding.number === undefined) defects.push(createDefect(DEFECT_CODES.KEY_MISSING, `${path}.number`, "the key number is required here and is missing"));
    defects.push(...findObjectDefects(model, finding, path));
    const ceilingDefects = findOpenWithoutACeilingDefect(finding, path, ceiling, lastShapeRun);
    defects.push(...(ceilingDefects.length ? ceilingDefects : findOpenAfterCeilingDefect(finding, path)));
  }
  if (reviewText !== null) {
    const itemNumbers = new Set(readReviewItems(reviewText).filter(isPlacedByThePlan).map(item => item.number));
    defects.push(...findItemDefects(itemNumbers, listFindingsWithPath(model).filter(({ finding }) => !isAShapeRunFinding(finding)), "review.md", " at the application, module or class scale"));
  }
  for (const shapeReview of shapeReviews) defects.push(...findShapeRunDefects(model, shapeReview, currentTree));
  return defects;
};
