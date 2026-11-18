import path from "node:path";
import { KINDS, isAText, isATestFileOfTheModel, isAnInterface, readFolderOfTheFile, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createDefect, createRecheckDefect } from "./DesignDefect.mjs";
import { REPRESENTS, isAConstant, isTheFolderNamedFor, namesTheClass } from "./RepresentedKinds.mjs";
import { listFilesTheModelTakesAway } from "./RequestAndResultTypes.mjs";

// The kinds that do work or stand at an edge hold no business data, so such a class is never a piece of the data of a type, nor a type whose data it holds.
const KINDS_WITHOUT_DATA = new Set([REPRESENTS.WORK, REPRESENTS.SUPPORT, REPRESENTS.CONTRACT, REPRESENTS.TRANSLATOR]);

const CONFIG_ZONE = "config";

// A failure type is named for its failure in every stack the skill reads, so its name ends in Exception or Error.
const FAILURE_TYPE_NAME = /(?:Exception|Error)$/;

const BOUNDARY_FOLDER_NAMES = new Set(["api", "spi"]);

// A type and 1 of its fields, as Type#field, name the other type that holds the piece in the current tree.
const TYPE_AND_FIELD = /\b([A-Z][A-Za-z0-9_]*)#[a-z_][A-Za-z0-9_]*\b/g;

const isADataType = (model, theClass) => !isAnInterface(theClass)
  && !KINDS_WITHOUT_DATA.has(theClass.represents)
  && !isATestFileOfTheModel(model, theClass.file || "");

// A created or moved type outside every other type, whose place the change chooses; a type with partOf takes its place from the check of the kinds.
const isPlacedByTheChange = (model, theClass) => [KINDS.CREATED, KINDS.MOVED].includes(model.getKindOfClass(theClass))
  && model.findOutermostClass(theClass) === theClass
  && isAText(theClass.file)
  && theClass.zone !== CONFIG_ZONE
  && !isAText(theClass.partOf)
  && !FAILURE_TYPE_NAME.test(String(theClass.name || ""))
  && isADataType(model, theClass);

const holdsInAField = (model, otherClass, theClass) => readList(otherClass.fields)
  .some(field => !isAConstant(field) && namesTheClass(model, field.type, otherClass, theClass));

// The outermost classes that hold the type in a field that is no constant, a class nested in the type left out, so a nested whole counts as the type around it.
const listOutermostWholesOfThePiece = (model, theClass) => [...new Set(model.classes
  .filter(otherClass => model.findOutermostClass(otherClass) !== theClass && !isATestFileOfTheModel(model, otherClass.file || ""))
  .filter(otherClass => holdsInAField(model, otherClass, theClass))
  .map(otherClass => model.findOutermostClass(otherClass)))];

const findTheOnlyWhole = (model, theClass) => {
  const wholes = listOutermostWholesOfThePiece(model, theClass);
  return wholes.length === 1 && isADataType(model, wholes[0]) ? wholes[0] : null;
};

// The other pieces of the same type, also those the change leaves as they are, stand with it as its parts, so they count as no other part of the folder.
const listFilesOfTheTypeAndItsPieces = (model, wholeClass) => new Set([wholeClass.file, ...model.classes
  .filter(otherClass => model.findOutermostClass(otherClass) === otherClass && isADataType(model, otherClass) && findTheOnlyWhole(model, otherClass) === wholeClass)
  .map(otherClass => otherClass.file)]);

const readChildName = (folder, file) => file.slice(folder.length + 1).split("/")[0];

const listChildNamesInTheModel = (model, folder) => [
  ...readList(model.folders)
    .filter(modelFolder => (modelFolder.path || "").replace(/\/+$/, "") === folder)
    .flatMap(modelFolder => readList(modelFolder.children).filter(child => child.kind !== KINDS.REMOVED).map(child => child.name)),
  ...model.classes.filter(otherClass => readFolderOfTheFile(otherClass.file) === folder).map(otherClass => path.posix.basename(otherClass.file)),
];

const listChildNamesInTheTree = (model, currentTree, folder) => {
  if (!currentTree) return [];

  const filesTakenAway = listFilesTheModelTakesAway(model);
  return currentTree.listFilesUnder(folder).filter(file => !filesTakenAway.has(file)).map(file => readChildName(folder, file));
};

// The other parts of the folder are its files and subfolders by the model and, with --repo, by the current tree, apart from the type, its pieces and the test files.
const listOtherPartsOfTheFolder = (model, currentTree, folder, wholeClass) => {
  const ownNames = new Set([...listFilesOfTheTypeAndItsPieces(model, wholeClass)].map(file => path.posix.basename(file)));
  const childNames = [...listChildNamesInTheModel(model, folder), ...listChildNamesInTheTree(model, currentTree, folder)];
  return [...new Set(childNames.filter(isAText))]
    .filter(childName => !ownNames.has(childName) && !isATestFileOfTheModel(model, `${folder}/${childName}`))
    .sort();
};

const describeTheBoundaryFolder = (theClass, wholeClass, folder) => (BOUNDARY_FOLDER_NAMES.has(folder.split("/").pop())
  ? `; in an api or spi folder every interface stays at the root and never gets a subfolder of its own, and where the folder holds the request, result and failure types of 2 or more interfaces, those types go into 1 subfolder named for what they are, such as model, and ${theClass.name} goes there nested in ${wholeClass.name} or in a subfolder named for ${wholeClass.name}`
  : "");

const describeTheLoosePiece = (theClass, wholeClass, folder, otherParts) => `${theClass.name} holds a piece of the data of ${wholeClass.name}, the only type of the model that holds it in a field, and it stands loose beside ${wholeClass.name} in ${folder}, which also holds ${otherParts.join(", ")}; a type that holds a piece of the data of 1 other type goes with that type (code-style modules.md section 3): nest ${theClass.name} in ${wholeClass.name}, or put ${wholeClass.name} and ${theClass.name} into a subfolder named for ${wholeClass.name}${describeTheBoundaryFolder(theClass, wholeClass, folder)}`;

// A moved type can have another whole in a file of the current tree that the model leaves out, so only a reason that names such a whole as Type#field closes its case.
const namesAnotherWhole = (theClass, wholeClass, reason) => [...String(reason || "").matchAll(TYPE_AND_FIELD)]
  .some(([, typeName]) => typeName !== theClass.name && typeName !== wholeClass.name);

const createTheLoosePieceDefect = (model, theClass, wholeClass, folder, otherParts) => {
  const sentence = describeTheLoosePiece(theClass, wholeClass, folder, otherParts);
  if (model.getKindOfClass(theClass) === KINDS.CREATED) return createDefect(DEFECT_CODES.PIECE_LOOSE_BESIDE_ITS_TYPE, model.getClassPath(theClass), sentence);

  return {
    ...createRecheckDefect(DEFECT_CODES.PIECE_LOOSE_BESIDE_ITS_TYPE, model.getClassPath(theClass), `${sentence}; the type is moved, so a file of the current tree that the model leaves out can hold it too: then answer under scriptCases with that other type and its field, as Type#field`),
    answerTest: (_model, _theClass, reason) => namesAnotherWhole(theClass, wholeClass, reason),
  };
};

// A folder named for the type itself exists for it, so the type heads that folder and is no piece loose in it.
const findTheLoosePieceDefect = (model, currentTree, theClass) => {
  const wholeClass = findTheOnlyWhole(model, theClass);
  if (!wholeClass || wholeClass.file === theClass.file || !isAText(wholeClass.file)) return null;

  const folder = readFolderOfTheFile(theClass.file);
  if (readFolderOfTheFile(wholeClass.file) !== folder || isTheFolderNamedFor(folder, wholeClass) || isTheFolderNamedFor(folder, theClass)) return null;
  const otherParts = listOtherPartsOfTheFolder(model, currentTree, folder, wholeClass);
  return otherParts.length ? createTheLoosePieceDefect(model, theClass, wholeClass, folder, otherParts) : null;
};

// A created or moved data type that only 1 other data type holds in a field is a piece of that type, and a piece loose beside it in a folder of other parts is a detail among the parts of that folder.
export const findLoosePieceDefects = (model, currentTree = null) => model.classes
  .filter(theClass => isPlacedByTheChange(model, theClass))
  .map(theClass => findTheLoosePieceDefect(model, currentTree, theClass))
  .filter(defect => defect !== null);
