export const SHAPE_MODEL_VERSION = 1;

export const SHAPE_KINDS = Object.freeze({ CREATED: "created", MOVED: "moved", MODIFIED: "modified", REMOVED: "removed", UNCHANGED: "unchanged" });

export const SHAPE_SHOWS = Object.freeze({ FOLDERS: "FOLDERS", CLASSES: "CLASSES", BODIES: "BODIES" });

export const PUBLIC_METHOD_VISIBILITY = "public";

export class ShapeModelStop extends Error {}

const KIND_NAMES = Object.values(SHAPE_KINDS);

const isAText = given => typeof given === "string" && given.trim().length > 0;

const isAList = given => Array.isArray(given);

const stopAt = (where, message) => { throw new ShapeModelStop(`shape model: ${where} ${message}`); };

const PATH_STEP_PATTERN = /^(\.\.?)?$/;

const readRepositoryPath = (given, where) => {
  if (!isAText(given)) stopAt(where, "must be a path text");
  const trimmed = given.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (trimmed.startsWith("/") || trimmed.split("/").some(step => PATH_STEP_PATTERN.test(step))) stopAt(where, `must be a path relative to the repository root with no . or .. step, not ${given}`);
  return trimmed;
};

const readKind = (given, where) => {
  if (!KIND_NAMES.includes(given)) stopAt(where, `must be 1 of ${KIND_NAMES.join(", ")}, not ${JSON.stringify(given)}`);
  return given;
};

const readOptionalText = (given, where) => {
  if (given === undefined || given === null) return "";
  if (typeof given !== "string") stopAt(where, "must be a text");
  return given.trim();
};

const readTextList = (given, where) => {
  if (given === undefined || given === null) return [];
  if (!isAList(given) || !given.every(isAText)) stopAt(where, "must be a list of texts");
  return given.map(text => text.trim());
};

const readOptionalList = (given, where) => {
  if (given === undefined || given === null) return [];
  if (!isAList(given)) stopAt(where, "must be a list");
  return given;
};

const readName = (given, where) => {
  if (!isAText(given)) stopAt(where, "must be a name text");
  return given.trim();
};

function readChild(given, where) {
  const name = readName(given.name, `${where}.name`);
  if (name.includes("/")) stopAt(`${where}.name`, `must name 1 child with no /, not ${name}`);
  const kind = readKind(given.kind, `${where}.kind`);
  if (kind !== SHAPE_KINDS.MOVED) return { name, kind };
  return { name, kind, oldPath: readRepositoryPath(given.oldPath, `${where}.oldPath`) };
}

function readFolder(given, where) {
  return {
    path: readRepositoryPath(given.path, `${where}.path`),
    kind: readKind(given.kind, `${where}.kind`),
    children: readOptionalList(given.children, `${where}.children`).map((child, at) => readChild(child, `${where}.children[${at}]`)),
  };
}

const readTypedName = (given, where) => ({ name: readName(given.name, `${where}.name`), type: readOptionalText(given.type, `${where}.type`) });

function readMethod(given, where) {
  const body = readOptionalText(given.body, `${where}.body`);
  return {
    visibility: readOptionalText(given.visibility, `${where}.visibility`) || PUBLIC_METHOD_VISIBILITY,
    name: readName(given.name, `${where}.name`),
    parameters: readOptionalList(given.parameters, `${where}.parameters`).map((parameter, at) => readTypedName(parameter, `${where}.parameters[${at}]`)),
    returns: readOptionalText(given.returns, `${where}.returns`),
    uses: readTextList(given.uses, `${where}.uses`),
    ...(body ? { body } : {}),
  };
}

function readClass(given, where) {
  return {
    file: readRepositoryPath(given.file, `${where}.file`),
    kindWord: readOptionalText(given.kindWord, `${where}.kindWord`) || "class",
    name: readName(given.name, `${where}.name`),
    extends: readTextList(given.extends, `${where}.extends`),
    implements: readTextList(given.implements, `${where}.implements`),
    fields: readOptionalList(given.fields, `${where}.fields`).map((field, at) => readTypedName(field, `${where}.fields[${at}]`)),
    methods: readOptionalList(given.methods, `${where}.methods`).map((method, at) => readMethod(method, `${where}.methods[${at}]`)),
  };
}

const findTheFirstRepeated = given => given.find((value, at) => given.indexOf(value) !== at);

function stopOnARepeatedPlace(folders, classes) {
  const repeatedFolder = findTheFirstRepeated(folders.map(folder => folder.path));
  if (repeatedFolder) stopAt("folders", `names the folder ${repeatedFolder} twice`);
  const repeatedClass = findTheFirstRepeated(classes.map(shapeClass => `${shapeClass.file}#${shapeClass.name}`));
  if (repeatedClass) stopAt("classes", `names the class ${repeatedClass} twice`);
}

export function readShapeModel(given) {
  if (!given || typeof given !== "object" || isAList(given)) stopAt("the top", "must be a JSON object");
  if (given.version !== SHAPE_MODEL_VERSION) stopAt("version", `must be ${SHAPE_MODEL_VERSION}, not ${JSON.stringify(given.version)}`);
  const folders = readOptionalList(given.folders, "folders").map((folder, at) => readFolder(folder, `folders[${at}]`));
  const classes = readOptionalList(given.classes, "classes").map((shapeClass, at) => readClass(shapeClass, `classes[${at}]`));
  if (!folders.length && !classes.length) stopAt("the top", "must hold 1 or more folders or classes");
  stopOnARepeatedPlace(folders, classes);
  return { version: SHAPE_MODEL_VERSION, folders, classes };
}

const holdsABody = shapeModel => shapeModel.classes.some(shapeClass => shapeClass.methods.some(method => Boolean(method.body)));

export function listWhatTheShapeShows(shapeModel) {
  const shows = [];
  if (shapeModel.folders.length) shows.push(SHAPE_SHOWS.FOLDERS);
  if (shapeModel.classes.length) shows.push(SHAPE_SHOWS.CLASSES);
  if (holdsABody(shapeModel)) shows.push(SHAPE_SHOWS.BODIES);
  return shows;
}
