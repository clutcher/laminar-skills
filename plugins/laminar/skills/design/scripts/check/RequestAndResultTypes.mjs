import { KINDS, getFileOfTheChild, isAText, isATestFileOfTheModel, readFolderOfTheFile, readList } from "../model/DesignModel.mjs";
import { readDeclaredTypes } from "./DeclaredTypes.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";
import { REPRESENTS, isTakenOrReturnedInTheZones } from "./RepresentedKinds.mjs";

// The zones of the boundary of the application, whose interfaces take and return the request and result types.
const BOUNDARY_ZONES = new Set(["api", "spi"]);

// The folders in and out of the application: an api folder below one of them, such as in/api, is no boundary folder of the application.
const OUTER_ZONE_FOLDERS = new Set(["in", "out"]);

// A failure type is named for its failure in every stack the skill reads, so its name ends in Exception or Error.
const FAILURE_TYPE_NAME = /(?:Exception|Error)$/;

const INTERFACE_WORD = "interface";

const isACarrierOfTheBoundary = (model, theClass) => theClass.represents === REPRESENTS.CARRIER
  && !isATestFileOfTheModel(model, theClass.file || "")
  && !model.isRemovedClass(theClass)
  && isTakenOrReturnedInTheZones(model, theClass, BOUNDARY_ZONES);

const findModuleOfTheClass = (zoneOrder, theClass) => {
  const folder = readFolderOfTheFile(theClass.file);
  if (!zoneOrder || !zoneOrder.appliesToTheFolder(folder)) return null;
  return zoneOrder.findModuleOfTheFolder(folder);
};

// The model marks the kind of a type it creates, also of a type it nests in a changed file, so a class of a changed file that it marks carrier is read.
const isReadForThePlace = (model, zoneOrder, theClass) => model.isChangedClass(theClass)
  && isACarrierOfTheBoundary(model, theClass)
  && findModuleOfTheClass(zoneOrder, theClass) !== null;

// A place of the module is 1 type name with its folder, read from the model or from the current tree.
const createThePlace = (typeName, folder, source) => ({ typeName, folder, source });

const listPlacesInTheModel = (model, zoneOrder, theClass, module) => model.classes
  .filter(otherClass => model.findOutermostClass(otherClass) === otherClass && model.findOutermostClass(theClass) !== otherClass)
  .filter(otherClass => isACarrierOfTheBoundary(model, otherClass) && findModuleOfTheClass(zoneOrder, otherClass) === module)
  .map(otherClass => createThePlace(otherClass.name, readFolderOfTheFile(otherClass.file), "the model"));

// A file of the current tree stands in a boundary folder where a folder named api or spi lies between the module and the file, with no in or out folder before it.
const standsInABoundaryFolder = (module, file) => {
  const folderNames = readFolderOfTheFile(file).slice(module.length + 1).split("/");
  const boundaryAt = folderNames.findIndex(folderName => BOUNDARY_ZONES.has(folderName));
  return boundaryAt >= 0 && !folderNames.slice(0, boundaryAt).some(folderName => OUTER_ZONE_FOLDERS.has(folderName));
};

const listFilesTheModelTakesAway = model => new Set(readList(model.folders).flatMap(folder => readList(folder.children).flatMap(child => [
  ...(child.kind === KINDS.REMOVED ? [getFileOfTheChild(folder, child)] : []),
  ...(isAText(child.oldPath) ? [child.oldPath] : []),
])));

// The api and spi folders exist for their interfaces, so every other type declared at the top of a file there, apart from a failure type, is a request or result type of an interface.
const listRequestAndResultTypesOfTheText = codeText => readDeclaredTypes(codeText)
  .filter(declaredType => declaredType.outerType === null && !codeText.startsWith(INTERFACE_WORD, declaredType.at) && !FAILURE_TYPE_NAME.test(declaredType.name))
  .map(declaredType => declaredType.name);

const listPlacesInTheTree = (model, currentTree, theClass, module) => {
  if (!currentTree) return [];

  const filesTakenAway = listFilesTheModelTakesAway(model);
  return currentTree.listFilesUnder(module)
    .filter(file => file !== theClass.file && !filesTakenAway.has(file) && !isATestFileOfTheModel(model, file) && standsInABoundaryFolder(module, file))
    .flatMap(file => {
      const codeText = currentTree.readFileText(file);
      return codeText === null ? [] : listRequestAndResultTypesOfTheText(codeText).map(typeName => createThePlace(typeName, readFolderOfTheFile(file), "the current tree"));
    });
};

const describeThePlaces = places => places.map(place => `${place.typeName} in ${place.folder} (${place.source})`).join(", ");

const createThePlaceDefect = (model, theClass, folder, otherPlaces) => createRecheckDefect(
  DEFECT_CODES.REQUEST_OR_RESULT_TYPE_APART,
  model.getClassPath(theClass),
  `${theClass.name} is a carrier that an api or spi method takes or returns, and it stands in ${folder}, apart from every other request and result type of its module: ${describeThePlaces(otherPlaces)}; the project conventions choose 1 place for the request and result types of the api and spi interfaces, and every module uses it (code-style modules.md section 3): move ${theClass.name} to the place its module uses, or answer under scriptCases with the convention that chooses this place`,
);

// A created carrier of an api or spi method stands with the other request and result types of its module, wherever the module keeps them; it is asked only where none of them shares its folder.
export const findRequestAndResultTypeDefects = (model, zoneOrder, currentTree = null) => {
  const defects = [];
  for (const theClass of model.classes.filter(other => isReadForThePlace(model, zoneOrder, other))) {
    const module = findModuleOfTheClass(zoneOrder, theClass);
    const folder = readFolderOfTheFile(theClass.file);
    const otherPlaces = [...listPlacesInTheModel(model, zoneOrder, theClass, module), ...listPlacesInTheTree(model, currentTree, theClass, module)];
    if (otherPlaces.length && !otherPlaces.some(place => place.folder === folder)) defects.push(createThePlaceDefect(model, theClass, folder, otherPlaces));
  }
  return defects;
};
