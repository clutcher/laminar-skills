import { getFileOfTheChild, getFolderPath, readList } from "../model/DesignModel.mjs";

const CLASS_PATH = /^classes\[(\d+)\](?:\.methods\[(\d+)\])?/;

const FOLDER_PATH = /^folders\[(\d+)\](?:\.children\[(\d+)\])?/;

const DECISION_PATH = /^decisions\.([\w.]+)\[(\d+)\]/;

const describeFinding = finding => (Number.isFinite(finding.run) ? `shape run ${finding.run} item ${finding.number}` : `item ${finding.number}`);

const NAME_OF_DECISION_MAP = new Map([
  ["owners", owner => owner.owner],
  ["entries", entry => entry.entry],
  ["exits", exit => exit.exit],
  ["tests.integration", integration => integration.entry],
  ["tests.unit", unitTest => unitTest.class],
  ["questions", question => question.id],
  ["stops", stop => stop.at],
  ["findings", describeFinding],
  ["scriptCases", scriptCase => scriptCase.name],
  ["existingDefects", existingDefect => `${existingDefect.class}#${existingDefect.member}`],
]);

const findNameOfTheClassPath = (model, match) => {
  const theClass = model.classes[Number(match[1])];
  if (!theClass) return "";
  const method = match[2] === undefined ? null : readList(theClass.methods)[Number(match[2])];
  return method ? model.getMethodDisplayName(theClass, method) : model.getClassDisplayName(theClass);
};

const findNameOfTheFolderPath = (model, match) => {
  const folder = model.folders[Number(match[1])];
  if (!folder) return "";
  const child = match[2] === undefined ? null : readList(folder.children)[Number(match[2])];
  return child ? getFileOfTheChild(folder, child) : getFolderPath(folder);
};

const findNameOfTheDecisionPath = (model, match) => {
  const readName = NAME_OF_DECISION_MAP.get(match[1]);
  const listKeys = match[1].split(".");
  const items = listKeys.reduce((parent, key) => (parent ? parent[key] : undefined), model.decisions);
  const item = readList(items)[Number(match[2])];
  return readName && item ? String(readName(item) ?? "") : "";
};

// The display name a defect is about, read from the path in the model that the defect names, so a script case can match it in a later round, where the index has moved.
export const findNameOfThePath = (model, defectPath) => {
  const classMatch = CLASS_PATH.exec(defectPath);
  if (classMatch) return findNameOfTheClassPath(model, classMatch);
  const folderMatch = FOLDER_PATH.exec(defectPath);
  if (folderMatch) return findNameOfTheFolderPath(model, folderMatch);
  const decisionMatch = DECISION_PATH.exec(defectPath);
  if (decisionMatch) return findNameOfTheDecisionPath(model, decisionMatch);
  return defectPath;
};
