import { isAText, isATestFileOfTheModel, isMarkedUnchanged, readFolderOfTheFile, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";
import { isAConstructor } from "./SimplestForm.mjs";

const CONFIG_ZONE = "config";

const API_ZONE = "api";

// The folders in and out of the application: a zone folder below one of them, such as out/carrier/api, belongs to that outer zone.
const OUTER_ZONE_FOLDERS = new Set(["in", "out"]);

const METHOD_MARK = "#";

// A method that returns nothing in Java, Kotlin, TypeScript and Python; a bean method returns its bean, so it never matches.
const NO_VALUE = /^(?:void|Unit|None|undefined|never|Nothing)?$/;

// A folder of the path with the name of the zone, with no in or out folder above it.
const standsInAFolderOfTheZone = (theClass, zone) => {
  const folders = String(theClass.file || "").split("/");
  const zoneIndex = folders.indexOf(zone);
  return zoneIndex >= 0 && !folders.slice(0, zoneIndex).some(folder => OUTER_ZONE_FOLDERS.has(folder));
};

// The api zone of a class by its key; where the class has none, the folder gives it only where no zone order applies to the folder, because a zone order reads the zone from the key alone.
const standsInTheApiZone = (zoneOrder, theClass) => {
  if (isAText(theClass.zone)) return theClass.zone === API_ZONE;
  if (zoneOrder && zoneOrder.appliesToTheFolder(readFolderOfTheFile(theClass.file))) return false;
  return standsInAFolderOfTheZone(theClass, API_ZONE);
};

const returnsNothing = method => NO_VALUE.test(String(method.returns || "").trim());

// A call of a constructor, written with the name of its class alone or as Type#Type, builds an object and starts no work of the application.
const callsAConstructor = (calledClass, call) => {
  const methodName = call.split(METHOD_MARK).pop();
  return !call.includes(METHOD_MARK) || isAConstructor(calledClass, { name: methodName });
};

const listTheApiCalls = (model, zoneOrder, method) => readList(method.calls).filter(isAText).filter(call => {
  const calledClass = model.findClass(call);
  return calledClass !== null && !callsAConstructor(calledClass, call) && standsInTheApiZone(zoneOrder, calledClass);
});

// The default zone order names no config zone, so a class with no zone key stands in config by a folder of that name.
const standsInConfig = theClass => (isAText(theClass.zone) ? theClass.zone === CONFIG_ZONE : String(theClass.file || "").split("/").includes(CONFIG_ZONE));

const isReadForTheApiCalls = (model, theClass) => model.isChangedClass(theClass)
  && standsInConfig(theClass)
  && !isATestFileOfTheModel(model, theClass.file || "");

const createTheConfigApiCallDefect = (model, theClass, method, apiCalls) => createRecheckDefect(
  DEFECT_CODES.CONFIG_CLASS_CALLS_THE_API,
  model.getMethodPath(theClass, method),
  `${model.getMethodDisplayName(theClass, method)} stands in config, returns nothing and calls ${apiCalls.join(", ")}; does the framework call it, at startup or at set times? Then it is an entry of the application, and an entry stands in the zone in (code-style modules.md section 11): move the class to in; where the framework does not call it, answer under scriptCases with who calls it`,
);

// A method of the config zone that returns nothing and calls the api starts work of the application, so it is an entry that the framework calls, unless only the wiring calls it.
export const findConfigApiCallDefects = (model, zoneOrder = null) => {
  const defects = [];
  for (const theClass of model.classes.filter(other => isReadForTheApiCalls(model, other))) {
    for (const method of readList(theClass.methods)) {
      if (isAConstructor(theClass, method) || isMarkedUnchanged(method) || !returnsNothing(method)) continue;

      const apiCalls = listTheApiCalls(model, zoneOrder, method);
      if (apiCalls.length) defects.push(createTheConfigApiCallDefect(model, theClass, method, apiCalls));
    }
  }
  return defects;
};
