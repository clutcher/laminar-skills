import { PLACED_LINE_PATTERN } from "../../../code/index.mjs";

const OWN_LINES = "ownLines";

export const FROM_THE_CHANGE_ONLY = "file list: from the change only";

export const formatImportersInTheFolderNote = (fileListLine, importerNames) => `${fileListLine} · imported by: ${importerNames.join(", ")}`;

export const numberLines = (lines, from) => lines.map((text, offset) => `${from + offset}: ${text}`);

export { formatPlacedSliceLine } from "../../../code/index.mjs";

export const NUMBERED_LINE_PATTERN = /^(\d+):\s?([\s\S]*)$/;

export const findLineNumber = text => (NUMBERED_LINE_PATTERN.exec(text) || [])[1];

export const readSliceSections = abstraction => (abstraction.slice && abstraction.slice.sections) || [];

export const listOwnSliceLines = abstraction => readSliceSections(abstraction)
  .filter(section => section.section === OWN_LINES)
  .flatMap(section => section.lines);

export const parseOwnLinesOfTheSlice = abstraction => listOwnSliceLines(abstraction)
  .map(line => NUMBERED_LINE_PATTERN.exec(line))
  .filter(Boolean)
  .map(([, line, text]) => ({ line: Number(line), text }));

export const listEverySliceLine = abstraction => readSliceSections(abstraction).flatMap(section => section.lines);

export const APPLICATION_ROOT_SECTION = "applicationRoot";

export const FILE_LIST_SECTIONS = new Set(["fileList", "siblings", "moduleRoot", "moduleShape", "moduleTree", "createdSubfolders", APPLICATION_ROOT_SECTION]);

const STOPPED_LINE_PATTERN = /^Stopped: limit \d+$/;

export const formatStoppedLine = keptCount => `Stopped: limit ${keptCount}`;

export const isAStoppedLine = line => STOPPED_LINE_PATTERN.test(String(line));

const CREATED_SUBFOLDER_LINE_PATTERN = /^subfolder: /;

export const readListedText = line => String(line).trim().replace(CREATED_SUBFOLDER_LINE_PATTERN, "");

export const findPlaceOfSliceLine = (abstractionPath, line) => {
  const placed = PLACED_LINE_PATTERN.exec(line);
  if (placed) return { file: placed[1], line: Number(placed[2]), text: placed[3] };
  const numberLines = NUMBERED_LINE_PATTERN.exec(line);
  if (numberLines) return { file: abstractionPath, line: Number(numberLines[1]), text: numberLines[2] };
  return null;
};

const FILE_LIST_NOTE_PATTERN = / · .*$/;

export const readListedPath = line => readListedText(line).replace(FILE_LIST_NOTE_PATTERN, "").replace(/\/+$/, "");

const findPlaceOfSectionLine = (abstractionPath, sectionName) => line => {
  if (isAStoppedLine(line)) return null;
  return FILE_LIST_SECTIONS.has(sectionName) ? { file: readListedPath(line), line: 0 } : findPlaceOfSliceLine(abstractionPath, line);
};

export const listPlacesShownInSections = (abstractionPath, sections) => (sections || [])
  .flatMap(section => (section.lines || []).map(findPlaceOfSectionLine(abstractionPath, section.section)))
  .filter(place => place && place.file);

const MODULE_ROOT_SECTION = "moduleRoot";

export const PATH_FROM_THE_SOURCE_ROOT = "Path from the source root";

const CREATED_SUBFOLDER_LABEL = "subfolder: ";

const readsFromTheSourceRoot = sectionName => FILE_LIST_SECTIONS.has(sectionName) && sectionName !== MODULE_ROOT_SECTION;

const splitTheCreatedSubfolderLabel = line => (String(line).startsWith(CREATED_SUBFOLDER_LABEL) ? [CREATED_SUBFOLDER_LABEL, String(line).slice(CREATED_SUBFOLDER_LABEL.length)] : ["", String(line)]);

const NAMED_REST_PATTERN = /^[^\s·]/;

export const showFileListLineFromTheSourceRoot = (sectionName, line, sourceRoot) => {
  if (!sourceRoot || !readsFromTheSourceRoot(sectionName)) return line;
  const [createdSubfolderLabel, listedPath] = splitTheCreatedSubfolderLabel(line);
  const rest = listedPath.startsWith(`${sourceRoot}/`) ? listedPath.slice(sourceRoot.length + 1) : "";
  return NAMED_REST_PATTERN.test(rest) ? `${createdSubfolderLabel}${rest}` : line;
};

export const restoreListedFileFromTheSourceRoot = (sectionName, listedPath, sourceRoot) => {
  if (!sourceRoot || !readsFromTheSourceRoot(sectionName) || listedPath.startsWith(`${sourceRoot}/`)) return listedPath;
  return `${sourceRoot}/${listedPath}`;
};

export const readPathFromTheSourceRoot = (folder, sourceRoot) => (sourceRoot && folder.startsWith(`${sourceRoot}/`) ? folder.slice(sourceRoot.length + 1) : folder);

export const FIELD_READING_SECTIONS = Object.freeze({ SAME_NAME: "sameName" });
