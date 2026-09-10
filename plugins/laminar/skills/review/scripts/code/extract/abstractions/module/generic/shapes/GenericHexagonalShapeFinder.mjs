import { Strategy } from "../../../../finders/Strategy.mjs";
import { Scale } from "../../../../../graph/abstractions/Scale.mjs";
import { listInOutFolders, listAppSideFolders, isWithin, isWithinAny, listApiSpiFolders } from "./ModuleShapes.mjs";
import { SHAPE_FAMILIES } from "./ShapeFamilies.mjs";
import { IN_OUT_PARENT_WORDS, APP_WORDS, HIDDEN_WORDS, API_SPI_PARENT_WORDS } from "./ShapeFolderWords.mjs";

const SHAPE_WORDS = new Set([
  ...APP_WORDS, ...API_SPI_PARENT_WORDS, ...IN_OUT_PARENT_WORDS,
  ...SHAPE_FAMILIES.flatMap(family => [...family.apiSpi.api, ...family.apiSpi.spi, ...family.inOut.in, ...family.inOut.out]),
]);

const LEAST_FOLDER_KINDS_OF_A_SHAPE = 2;

const buildChildPath = (folder, name) => (folder ? `${folder}/${name}` : name);

const findChildPathsNamed = (tree, folder, words) => words.map(word => tree.findChildNamed(folder, word)).filter(name => name !== null).map(name => buildChildPath(folder, name));

const findFirstChildNamed = (tree, folder, words) => words.map(word => tree.findChildNamed(folder, word)).find(name => name !== null) ?? null;

const listWords = (wordsBySideMap, side) => [...((wordsBySideMap || {})[side] || [])];

const countTrue = answers => answers.filter(Boolean).length;

export class GenericHexagonalShapeFinder extends Strategy {
  constructor() {
    super(Scale.MODULE);
  }

  isAPossibleShapeRoot(tree, folder) {
    return tree.listChildNames(folder).some(name => SHAPE_WORDS.has(name.toLowerCase()));
  }

  findShapesIn(tree, importsOf) {
    return tree.listEveryFolder()
      .filter(folder => this.isAPossibleShapeRoot(tree, folder))
      .map(root => this.findShapeAt(tree, root, importsOf))
      .filter(Boolean);
  }

  findShapeAt(tree, root, importsOf) {
    const app = findFirstChildNamed(tree, root, APP_WORDS);
    const appOrRootFolder = app === null ? root : buildChildPath(root, app);
    const apiSpiParentFolders = [...new Set([...findChildPathsNamed(tree, appOrRootFolder, API_SPI_PARENT_WORDS), ...findChildPathsNamed(tree, root, API_SPI_PARENT_WORDS)])];
    const inOutParentFolders = findChildPathsNamed(tree, root, IN_OUT_PARENT_WORDS);
    const hiddenFolders = findChildPathsNamed(tree, appOrRootFolder, HIDDEN_WORDS);
    const familyReadings = SHAPE_FAMILIES.map(family => this.readTheShapeOfTheFamily(tree, family, { root, appOrRootFolder, apiSpiParentFolders, inOutParentFolders }));
    const familyReadingWithMostFolderKinds = familyReadings.reduce((readingWithMostFolderKinds, reading) => (reading.folderKindCount > readingWithMostFolderKinds.folderKindCount ? reading : readingWithMostFolderKinds), familyReadings[0]);
    if (familyReadingWithMostFolderKinds.folderKindCount < LEAST_FOLDER_KINDS_OF_A_SHAPE) return null;
    const shape = { root, family: familyReadingWithMostFolderKinds.family.name, app: app === null ? null : appOrRootFolder, hidden: hiddenFolders, ...familyReadingWithMostFolderKinds.shapeFolders };
    const direction = this.measureDirection(tree, shape, importsOf);
    return direction.agrees ? { ...shape, direction } : null;
  }

  readTheShapeOfTheFamily(tree, family, { root, appOrRootFolder, apiSpiParentFolders, inOutParentFolders }) {
    const listApiSpiFoldersOnSide = side => [
      ...(family.apiSpiBesideTheApp ? findChildPathsNamed(tree, appOrRootFolder, listWords(family.apiSpi, side)) : []),
      ...apiSpiParentFolders.flatMap(parentFolder => findChildPathsNamed(tree, parentFolder, listWords(family.apiSpi, side))),
    ];
    const listInOutFoldersOnSide = side => [
      ...findChildPathsNamed(tree, root, listWords(family.inOut, side)).filter(folder => folder !== appOrRootFolder),
      ...inOutParentFolders.flatMap(parentFolder => findChildPathsNamed(tree, parentFolder, [...listWords(family.inOut, side), ...listWords(family.inOutWordsUnderTheParent, side)])),
    ];
    const apiFolders = listApiSpiFoldersOnSide("api");
    const spiFolders = listApiSpiFoldersOnSide("spi");
    const inFolders = listInOutFoldersOnSide("in");
    const outFolders = listInOutFoldersOnSide("out");
    const sidelessApiSpiFolders = apiSpiParentFolders.filter(parentFolder => ![...apiFolders, ...spiFolders].some(apiSpiFolder => isWithin(apiSpiFolder, parentFolder)));
    const sidelessInOutFolders = inOutParentFolders.filter(parentFolder => ![...inFolders, ...outFolders].some(inOutFolder => isWithin(inOutFolder, parentFolder)));
    const shapeFolders = { api: apiFolders, spi: spiFolders, in: inFolders, out: outFolders, apiSpi: sidelessApiSpiFolders, inOut: sidelessInOutFolders };
    const folderKindCount = countTrue(Object.values(shapeFolders).map(folders => folders.length > 0));
    return { family, shapeFolders, folderKindCount };
  }

  measureDirection(tree, shape, importsOf) {
    const inOutFolders = listInOutFolders(shape);
    const apiSpiFolders = listApiSpiFolders(shape);
    const appSideFolders = listAppSideFolders(shape);
    const countImportsBetween = (fromFolders, toFolders, excludedFolders = []) => tree.listFilesWithin(shape.root)
      .filter(filePath => isWithinAny(filePath, fromFolders) && !isWithinAny(filePath, excludedFolders))
      .reduce((count, filePath) => count + importsOf(filePath).filter(target => isWithinAny(target, toFolders)).length, 0);
    if (!inOutFolders.length) {
      const importsIntoApiSpiCount = countImportsBetween([shape.root], apiSpiFolders, apiSpiFolders);
      return { inward: importsIntoApiSpiCount, outward: 0, agrees: true };
    }
    const inwardImportCount = countImportsBetween(inOutFolders, appSideFolders);
    const outwardImportCount = countImportsBetween(appSideFolders, inOutFolders);
    return { inward: inwardImportCount, outward: outwardImportCount, agrees: inwardImportCount + outwardImportCount === 0 || inwardImportCount > outwardImportCount };
  }
}
