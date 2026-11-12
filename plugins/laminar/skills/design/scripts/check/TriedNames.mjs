import { isAText, readList } from "../model/DesignModel.mjs";
import { listClassPairs, listRenamesBetweenRounds } from "../round/RoundRenames.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";
import { readItemsWithLabels } from "./ReviewItems.mjs";

const PREDICTION_FAILURE = "Prediction Failure";

const CLASS_SCALE = "class";

const SCALES = Object.freeze({ CLASS: "CLASS", METHOD: "METHOD" });

const METHOD_MARK = "#";

const NAMES_OF_A_RENAMED_CLASS = 2;

const createRenamePair = (oldName, newName) => ({ oldName, newName });

const listAbstractionsOfTheTree = abstractions => readList(abstractions).flatMap(abstraction => [abstraction, ...listAbstractionsOfTheTree(abstraction.children)]);

// The classes of 1 shape run, as the rename pairing reads them, from review-abstractions.json of its run folder; a method with no body is no abstraction there, so the pairing by method names sees only the methods with a body.
export const listClassesOfTheAbstractions = reviewAbstractions => listAbstractionsOfTheTree(reviewAbstractions && reviewAbstractions.abstractions)
  .filter(abstraction => abstraction.scale === SCALES.CLASS)
  .map(abstraction => ({ name: abstraction.name, file: abstraction.path, methods: readList(abstraction.children).filter(child => child.scale === SCALES.METHOD).map(child => ({ name: child.name })) }));

const orderTheShapeRuns = shapeRuns => [...shapeRuns].sort((first, second) => first.run - second.run);

const listRenamePairsOfTheShapeRuns = orderedRuns => orderedRuns.slice(1).flatMap((shapeRun, at) => listClassPairs(readList(orderedRuns[at].classes), readList(shapeRun.classes))
  .map(([classBefore, classNow]) => createRenamePair(classBefore.name, classNow.name)));

const isAClassName = displayName => !displayName.includes(METHOD_MARK);

const listRenamePairsOfTheRounds = (roundModels, model) => {
  const models = [...roundModels, model];
  return models.slice(1).flatMap((modelNow, at) => [...listRenamesBetweenRounds(models[at], modelNow)]
    .filter(([oldName, newName]) => isAClassName(oldName) && isAClassName(newName))
    .map(([oldName, newName]) => createRenamePair(oldName, newName)));
};

const listRenamePairsOfTheOldNames = model => model.classes.filter(theClass => isAText(theClass.oldName)).map(theClass => createRenamePair(theClass.oldName, theClass.name));

const buildOldNamesOfTheNameMap = renamePairs => {
  const oldNamesOfTheNameMap = new Map();
  for (const { oldName, newName } of renamePairs) oldNamesOfTheNameMap.set(newName, [...(oldNamesOfTheNameMap.get(newName) || []), oldName]);
  return oldNamesOfTheNameMap;
};

// The names tried for 1 class, from its last name back through each rename that led to it, the last name first.
const listTriedNames = (lastName, oldNamesOfTheNameMap) => {
  const names = [lastName];
  for (let at = 0; at < names.length; at++) {
    for (const oldName of oldNamesOfTheNameMap.get(names[at]) || []) if (!names.includes(oldName)) names.push(oldName);
  }
  return names;
};

// The last shape run that judged each class name, by its classes or by an item at the class scale.
const buildLastRunOfTheNameMap = orderedRuns => {
  const lastRunOfTheNameMap = new Map();
  for (const shapeRun of orderedRuns) {
    for (const theClass of readList(shapeRun.classes)) lastRunOfTheNameMap.set(theClass.name, shapeRun.run);
    for (const item of readItemsWithLabels(shapeRun.text).filter(other => other.scale === CLASS_SCALE)) lastRunOfTheNameMap.set(item.name, shapeRun.run);
  }
  return lastRunOfTheNameMap;
};

const listClassItemsWithAPredictionFailure = shapeRun => readItemsWithLabels(shapeRun.text).filter(item => item.scale === CLASS_SCALE && item.labels.has(PREDICTION_FAILURE));

// A class of the model whose name is the second name tried or a later one, across the shape runs, the rounds and its oldName, where the last shape run that judged it still keeps a prediction failure on it: a recheck case, because a second rename can be right.
export const findTriedNameDefects = (model, shapeRuns, roundModels = []) => {
  const orderedRuns = orderTheShapeRuns(shapeRuns);
  const renamePairs = [...listRenamePairsOfTheOldNames(model), ...listRenamePairsOfTheRounds(roundModels, model), ...listRenamePairsOfTheShapeRuns(orderedRuns)];
  const oldNamesOfTheNameMap = buildOldNamesOfTheNameMap(renamePairs);
  const lastRunOfTheNameMap = buildLastRunOfTheNameMap(orderedRuns);
  const defects = [];
  const reportedNames = new Set();
  for (const shapeRun of orderedRuns) {
    for (const item of listClassItemsWithAPredictionFailure(shapeRun)) {
      const theClass = model.findClass(item.name);
      const triedNames = listTriedNames(item.name, oldNamesOfTheNameMap);
      if (lastRunOfTheNameMap.get(item.name) !== shapeRun.run || !theClass || triedNames.length < NAMES_OF_A_RENAMED_CLASS || reportedNames.has(item.name)) continue;

      reportedNames.add(item.name);
      const earlierNames = triedNames.slice(1).reverse().join(", ");
      defects.push(createRecheckDefect(DEFECT_CODES.RENAMED_CLASS_RAISED_AGAIN, model.getClassPath(theClass), `${item.name} is name ${triedNames.length} tried for this class, after ${earlierNames}, and the last shape run that judged it still keeps a prediction failure on it; check what the class holds before you give it another name`));
    }
  }
  return defects;
};
