import { isAText, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

// The lists of decisions.tests whose objects name a test file, each with the key that names the behavior its tests verify.
const TEST_LISTS = Object.freeze([
  { list: "integration", key: "entry" },
  { list: "unit", key: "class" },
]);

const BEHAVIORS_OF_A_SPLIT_AT_LEAST = 2;

// The objects of the test lists that name a file and a behavior, in the order of the model, each with its path.
const listTestObjects = model => TEST_LISTS.flatMap(({ list, key }) => readList(model.decisions.tests?.[list]).flatMap((testObject, at) => (isAText(testObject.file) && isAText(testObject[key])
  ? [{ list, file: testObject.file.trim(), behavior: testObject[key], path: `decisions.tests.${list}[${at}].file` }]
  : [])));

const groupTheObjectsByFile = testObjects => {
  const objectsOfFileMap = new Map();
  for (const testObject of testObjects) objectsOfFileMap.set(testObject.file, [...(objectsOfFileMap.get(testObject.file) || []), testObject]);
  return objectsOfFileMap;
};

const SPLIT_OF_ENTRIES = "split it into 1 file per entry, named with the class and then the entry";

const SPLIT_OF_CLASSES = "split it into 1 file per class or entry, each named with its class first";

const describeTheFile = (file, testObjects, behaviors) => {
  const split = testObjects.every(testObject => testObject.list === "integration") ? SPLIT_OF_ENTRIES : SPLIT_OF_CLASSES;
  return `${file} holds the tests of ${behaviors.join(", ")}; ${split}, or answer which setup serves every test`;
};

// 1 test file for 2 or more entries or classes is a candidate for a split by behavior; the model shows the behaviors and not the setup, so it is a recheck case.
export const findTestFileBehaviorDefects = model => {
  const defects = [];
  for (const [file, testObjects] of groupTheObjectsByFile(listTestObjects(model))) {
    const behaviors = [...new Set(testObjects.map(testObject => testObject.behavior))];
    if (behaviors.length >= BEHAVIORS_OF_A_SPLIT_AT_LEAST) defects.push(createRecheckDefect(DEFECT_CODES.TEST_FILE_OF_SEVERAL_BEHAVIORS, testObjects[0].path, describeTheFile(file, testObjects, behaviors)));
  }
  return defects;
};
