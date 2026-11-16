import { isAText, readList } from "../model/DesignModel.mjs";
import { listClassPairs, listRenamesBetweenRounds } from "../round/RoundRenames.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";
import { readNamedReviewItems } from "./ReviewItems.mjs";

const METHOD_MARK = "#";

const MODULE_SCALE = "module";

const createRenamePair = (oldName, newName, where, oldFile = "") => ({ oldName, newName, where, oldFile });

const readMemberName = displayName => displayName.slice(displayName.lastIndexOf(METHOD_MARK) + 1);

// A method whose class only changed its name keeps its own name, so it is no rename of the method.
const isARenameOfItsOwnName = (oldName, newName) => !oldName.includes(METHOD_MARK) || readMemberName(oldName) !== readMemberName(newName);

const readFileOfTheName = (model, displayName) => {
  const theClass = model && model.findClass(displayName.split(METHOD_MARK).slice(0, -1).join(METHOD_MARK) || displayName);
  return theClass ? String(theClass.file || "") : "";
};

const listPairsOfTheModels = (modelBefore, modelNow, where) => [...listRenamesBetweenRounds(modelBefore, modelNow)]
  .filter(([oldName, newName]) => isARenameOfItsOwnName(oldName, newName))
  .map(([oldName, newName]) => createRenamePair(oldName, newName, where, readFileOfTheName(modelBefore, oldName)));

// A shape run with no saved shape model gives only its classes, from review-abstractions.json, so its pairs are class pairs.
const listPairsOfTheShapeRuns = (shapeRuns, model) => {
  const orderedRuns = [...shapeRuns].sort((first, second) => first.run - second.run);
  const pairs = [];
  orderedRuns.forEach((shapeRun, at) => {
    const nextRun = orderedRuns[at + 1];
    const where = nextRun ? `shape run ${nextRun.run}` : "the model";
    if (shapeRun.shapeModel && (!nextRun || nextRun.shapeModel)) {
      pairs.push(...listPairsOfTheModels(shapeRun.shapeModel, nextRun ? nextRun.shapeModel : model, where));
      return;
    }
    const classesNow = nextRun ? readList(nextRun.classes) : model.classes;
    pairs.push(...listClassPairs(readList(shapeRun.classes), classesNow).map(([before, now]) => createRenamePair(before.name, now.name, where, String(before.file || ""))));
  });
  return pairs;
};

const listPairsOfTheRounds = (roundModels, model) => {
  const models = [...roundModels, model];
  return models.slice(1).flatMap((modelNow, at) => listPairsOfTheModels(models[at], modelNow, `the plan after round ${at + 1}`));
};

const listPairsOfTheOldNames = model => model.classes.flatMap(theClass => [
  ...(isAText(theClass.oldName) ? [createRenamePair(theClass.oldName, theClass.name, "the model", String(theClass.file || ""))] : []),
  ...[...readList(theClass.methods), ...readList(theClass.fields)].filter(member => isAText(member.oldName))
    .map(member => createRenamePair(`${theClass.name}${METHOD_MARK}${member.oldName}`, `${theClass.name}${METHOD_MARK}${member.name}`, "the model", String(theClass.file || ""))),
]);

const listNamesOfTheItem = item => (item.enclosing ? [item.name, `${item.enclosing}${METHOD_MARK}${item.name}`] : [item.name]);

// The names that an item of the run folder, of a shape run or of the decided list carries, and the folders of the module items.
const readNamesWithFindings = (reviewText, shapeRuns, decidedList) => {
  const reviewItems = reviewText === null ? [] : readNamedReviewItems(reviewText);
  const items = [...reviewItems, ...shapeRuns.flatMap(shapeRun => readNamedReviewItems(shapeRun.text))];
  const itemOfNumberMap = new Map(reviewItems.map(item => [item.number, item]));
  const decidedNames = readList(decidedList).flatMap(decided => (isAText(decided.displayName) ? [decided.displayName] : listNamesOfTheItem(itemOfNumberMap.get(decided.number) || { name: "" })));
  return {
    names: new Set([...items.flatMap(listNamesOfTheItem), ...decidedNames].filter(isAText)),
    folders: items.filter(item => item.scale === MODULE_SCALE).map(item => item.name.replace(/\/+$/, "")),
  };
};

const carriesAFinding = (pair, namesWithFindings) => namesWithFindings.names.has(pair.oldName)
  || namesWithFindings.folders.some(folder => pair.oldFile.startsWith(`${folder}/`));

const findPathOfTheName = (model, displayName) => {
  const theClass = model.findClass(displayName.includes(METHOD_MARK) ? displayName.split(METHOD_MARK)[0] : displayName);
  if (!theClass) return displayName;
  const method = displayName.includes(METHOD_MARK) ? readList(theClass.methods).find(other => other.name === readMemberName(displayName)) : null;
  return method ? model.getMethodPath(theClass, method) : model.getClassPath(theClass);
};

// Each rename of a class, a method or a field whose old name no item of the run folder, of a shape run or of the decided list names: a recheck case, because the request itself can ask for the rename. An oldName counts only where a run folder is given, because a described change may ask for any rename.
export const findRenamesWithoutFindingDefects = (model, given) => {
  const { shapeRuns = [], roundModels = [], reviewText = null, decidedList = [] } = given;
  const namesWithFindings = readNamesWithFindings(reviewText, shapeRuns, decidedList);
  const pairs = [...(reviewText === null ? [] : listPairsOfTheOldNames(model)), ...listPairsOfTheRounds(roundModels, model), ...listPairsOfTheShapeRuns(shapeRuns, model)];
  const reportedKeys = new Set();
  const defects = [];
  for (const pair of pairs.filter(other => !carriesAFinding(other, namesWithFindings))) {
    const key = `${pair.oldName}\t${pair.newName}`;
    if (reportedKeys.has(key)) continue;

    reportedKeys.add(key);
    defects.push(createRecheckDefect(DEFECT_CODES.RENAMED_WITHOUT_FINDING, findPathOfTheName(model, pair.newName), `${pair.oldName} became ${pair.newName} in ${pair.where}, and no item of the run folder, of a shape run or of the decided list names ${pair.oldName}; say in 1 line why ${pair.newName} is the better name`));
  }
  return defects;
};
