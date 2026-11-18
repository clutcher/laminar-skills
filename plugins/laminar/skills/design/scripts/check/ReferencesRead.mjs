import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KINDS, getFileOfTheChild, isAText, isMarkedUnchanged, readList } from "../model/DesignModel.mjs";
import { readParsedLanguage } from "../model/SourceLanguages.mjs";
import { DEFECT_CODES, createDefect } from "./DesignDefect.mjs";

// Section 7 of SKILL.md is the 1 home of the list of the files the designer reads, so the check reads the list from its text.
const SKILL_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../SKILL.md");

const READS_SECTION_HEADING = "## 7. The reference files";

// A file of the list stands in a code span by its path from the folder of the skill design; a file read only by section is followed by its sections, up to the semicolon or the full stop that ends them.
const LISTED_FILE = /`\.\.\/code-style\/(references\/[\w-]+\.md)`(?:, sections ([\d, and]+?)(?=;|\.\s|\.$))?/g;

const KEY_PATH = "decisions.referencesRead";

// A path in the list may start from the folder of the skill design, as section 7 writes it.
const PATH_FROM_THE_DESIGN_SKILL = /^(?:\.\/|\.\.\/code-style\/)/;

const PATH_OF_THE_ENTRY = /^[^\s,;:(]+/;

const SECTION_NUMBER = /\d+/g;

// The conventions file of each language: JavaScript follows the file of TypeScript, as the file itself says, and Python, whose bodies the scripts do not parse, is read by its extension.
const CONVENTIONS_FILE_OF_LANGUAGE_MAP = new Map([
  ["Java", "conventions/java.md"],
  ["JavaScript", "conventions/typescript.md"],
  ["TypeScript", "conventions/typescript.md"],
  ["Python", "conventions/python.md"],
]);

const PYTHON_EXTENSION = ".py";

const PYTHON = "Python";

const KINDS_THAT_WRITE_A_FILE = new Set([KINDS.CREATED, KINDS.MOVED]);

const KINDS_OF_A_WRITTEN_LANGUAGE = new Set([KINDS.CREATED, KINDS.MODIFIED]);

let listOfSectionSeven = null;

const readTheListOfSectionSeven = () => {
  const skillText = fs.readFileSync(SKILL_FILE, "utf8");
  const sectionStart = skillText.indexOf(READS_SECTION_HEADING);
  const sectionText = sectionStart === -1 ? "" : skillText.slice(sectionStart).split("\n\n")[1] || "";
  const sectionsOfFileMap = new Map();
  for (const match of sectionText.matchAll(LISTED_FILE)) sectionsOfFileMap.set(match[1], match[2] ? match[2].match(SECTION_NUMBER) : []);
  if (sectionsOfFileMap.size === 0) throw new Error(`${SKILL_FILE}: no file of the skill code-style read in the first paragraph under ${READS_SECTION_HEADING}`);
  return sectionsOfFileMap;
};

// The files of section 7, each with the sections the designer reads, and an empty list for a file it reads whole.
export const getTheListOfSectionSeven = () => {
  listOfSectionSeven ??= readTheListOfSectionSeven();
  return listOfSectionSeven;
};

const writesTheClass = (model, theClass) => {
  const kind = model.getKindOfClass(theClass);
  if (KINDS_THAT_WRITE_A_FILE.has(kind)) return true;
  if (kind !== KINDS.MODIFIED) return false;

  return isAText(theClass.oldName)
    || readList(theClass.fields).some(field => isAText(field.oldName))
    || readList(theClass.methods).some(method => !isMarkedUnchanged(method) || isAText(method.oldName));
};

// A plan writes where it creates or moves a file or a class, renames a class, a field or a method, or holds a method not marked unchanged in a modified class; a carried model whose plan changes none of them writes nothing.
export const writesABodyANameOrASignature = model => model.folders.some(folder => readList(folder.children).some(child => KINDS_THAT_WRITE_A_FILE.has(child.kind)))
  || model.classes.some(theClass => writesTheClass(model, theClass));

const readLanguageOfTheFile = file => readParsedLanguage(file) || (path.extname(file) === PYTHON_EXTENSION ? PYTHON : null);

const listWrittenFiles = model => [
  ...model.folders.flatMap(folder => readList(folder.children).filter(child => KINDS_OF_A_WRITTEN_LANGUAGE.has(child.kind)).map(child => getFileOfTheChild(folder, child))),
  ...model.classes.filter(theClass => isAText(theClass.file) && KINDS_OF_A_WRITTEN_LANGUAGE.has(model.getKindOfClass(theClass))).map(theClass => theClass.file),
];

// The conventions file of each language of the created and modified files, each with the language it rules.
const listConventionsFiles = model => {
  const languageOfConventionsFileMap = new Map();
  for (const file of listWrittenFiles(model)) {
    const language = readLanguageOfTheFile(file);
    const conventionsFile = CONVENTIONS_FILE_OF_LANGUAGE_MAP.get(language);
    if (conventionsFile && !languageOfConventionsFileMap.has(conventionsFile)) languageOfConventionsFileMap.set(conventionsFile, language);
  }
  return languageOfConventionsFileMap;
};

// Each listed path with the sections its entries name, where an entry with no section number names a file read whole.
const readTheListedFiles = referencesRead => {
  const sectionsOfListedFileMap = new Map();
  for (const entry of readList(referencesRead).filter(isAText)) {
    const entryText = entry.trim().replace(PATH_FROM_THE_DESIGN_SKILL, "");
    const listedPath = entryText.match(PATH_OF_THE_ENTRY)?.[0];
    if (!listedPath) continue;

    const sectionNumbers = entryText.slice(listedPath.length).match(SECTION_NUMBER) || [];
    const listed = sectionsOfListedFileMap.get(listedPath) || { whole: false, sections: new Set() };
    if (sectionNumbers.length === 0) listed.whole = true;
    for (const sectionNumber of sectionNumbers) listed.sections.add(sectionNumber);
    sectionsOfListedFileMap.set(listedPath, listed);
  }
  return sectionsOfListedFileMap;
};

const listSectionsNotRead = (listed, sections) => (listed.whole ? [] : sections.filter(section => !listed.sections.has(section)));

const createNotReadDefect = (file, why) => createDefect(DEFECT_CODES.CODE_STYLE_FILE_NOT_READ, KEY_PATH, `the plan writes a body, a name or a signature, and referencesRead does not list ${file}, ${why}; read it and list it, by its path relative to the folder of the skill code-style`);

const findTheReferenceFileDefects = sectionsOfListedFileMap => {
  const defects = [];
  for (const [file, sections] of getTheListOfSectionSeven()) {
    const listed = sectionsOfListedFileMap.get(file);
    if (!listed) {
      defects.push(createNotReadDefect(file, sections.length ? `whose sections ${sections.join(", ")} SKILL.md, section 7, has the designer read` : "which SKILL.md, section 7, has the designer read whole"));
      continue;
    }
    const sectionsNotRead = listSectionsNotRead(listed, sections);
    if (sectionsNotRead.length) defects.push(createNotReadDefect(`the sections ${sectionsNotRead.join(", ")} of ${file}`, "which SKILL.md, section 7, has the designer read"));
  }
  return defects;
};

const findTheConventionsFileDefects = (model, sectionsOfListedFileMap) => [...listConventionsFiles(model)]
  .filter(([conventionsFile]) => !sectionsOfListedFileMap.has(conventionsFile))
  .map(([conventionsFile, language]) => createNotReadDefect(conventionsFile, `the conventions file of ${language}, a language of the files the plan creates or modifies`));

// The list proves only what the designer states it read; only a reader of the transcript of the designer confirms a read.
export const findReferencesReadDefects = model => {
  if (!writesABodyANameOrASignature(model)) return [];

  const { referencesRead } = model.decisions;
  if (!Array.isArray(referencesRead)) return [createDefect(DEFECT_CODES.KEY_MISSING, KEY_PATH, "the key referencesRead is required where the plan writes a body, a name or a signature, and is missing: list each file of the skill code-style that you read in this plan, by its path relative to the folder of that skill (SKILL.md, section 7)")];

  const sectionsOfListedFileMap = readTheListedFiles(referencesRead);
  return [...findTheReferenceFileDefects(sectionsOfListedFileMap), ...findTheConventionsFileDefects(model, sectionsOfListedFileMap)];
};
