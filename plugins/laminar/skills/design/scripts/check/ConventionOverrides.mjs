import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OVERRIDE_KINDS, isAText, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createDefect, createRecheckDefect } from "./DesignDefect.mjs";

const CODE_STYLE_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../code-style");

// The folders of the skill code-style that hold a file a code-style id may name, as the skill check-conventions cites them.
const CODE_STYLE_FILE_FOLDERS = Object.freeze(["references", "conventions"]);

const PROJECT_ID = /^project\s+(\S+\.md)\s+§(\d+)$/;

const CODE_STYLE_ID = /^code-style\s+(\S+\.md)\s+§(\d+)$/;

const NARROWER_MARK = "narrower than the book";

// A citation of the book in a section of code-style: a line that starts with Book and the titles, or a sentence that starts with The book.
const BOOK_CITATION = /(^|\n)\s*-?\s*Book \(|\bThe book: /;

// A citation of the book inside 1 line of a section: the forms of a section, or the words the book says, calls, names or puts before a quote.
const LINE_BOOK_CITATION = /(^|\n)\s*-?\s*Book \(|\bThe book: |\bthe book (?:says|calls|names|puts)\b/i;

const SECTION_HEAD = /^## /;

const KINDS_WITH_A_PROJECT_FILE = new Set([OVERRIDE_KINDS.OVERRIDE, OVERRIDE_KINDS.CONTRADICTION]);

const KINDS_ON_A_MARKED_RULE = new Set([OVERRIDE_KINDS.OVERRIDE, OVERRIDE_KINDS.PROPOSED]);

const normalizeClause = text => text.replace(/[`*]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const readFileSections = text => {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const firstHeadAt = lines.findIndex(line => SECTION_HEAD.test(line));
  const leadLines = firstHeadAt < 0 ? lines : lines.slice(0, firstHeadAt);
  const sectionOfNumberMap = new Map();
  let sectionLines = null;
  for (const line of firstHeadAt < 0 ? [] : lines.slice(firstHeadAt)) {
    if (SECTION_HEAD.test(line)) {
      sectionLines = [line];
      const number = /^## (\d+)\./.exec(line);
      if (number) sectionOfNumberMap.set(Number(number[1]), sectionLines);
      continue;
    }
    sectionLines.push(line);
  }
  return { lead: leadLines.join("\n"), sectionOfNumberMap: new Map([...sectionOfNumberMap].map(([number, linesOfTheSection]) => [number, linesOfTheSection.join("\n")])) };
};

const readCodeStyleFileText = file => {
  for (const folder of [...CODE_STYLE_FILE_FOLDERS, ""]) {
    const codeStyleFilePath = path.join(CODE_STYLE_FOLDER, folder, file);
    if (codeStyleFilePath.startsWith(CODE_STYLE_FOLDER) && fs.existsSync(codeStyleFilePath)) return fs.readFileSync(codeStyleFilePath, "utf8");
  }
  return null;
};

// Every paragraph and bullet of a code-style file stands on 1 line, so the line that holds the quoted clause is its paragraph or its bullet; undefined where the clause crosses 2 lines.
const findLineOfTheClause = (section, says) => section.split("\n").find(line => normalizeClause(line).includes(normalizeClause(says)));

// Why the code-style section an object names is no rule marked narrower than the book; an empty text where it is one. The line that holds the quoted clause decides where it carries the mark itself, a recheck where that line also cites the book; otherwise the section decides, a recheck where it mixes the mark with a citation of the book.
const findWhyNotAMarkedRule = override => {
  const codeStyleId = CODE_STYLE_ID.exec(String(override.codeStyle || "").trim());
  if (!codeStyleId) return { why: `${override.codeStyle} is not in the form code-style <file> §<n>`, recheck: false };

  const [, file, number] = codeStyleId;
  const text = readCodeStyleFileText(file);
  if (text === null) return { why: `the skill code-style holds no file ${file}`, recheck: false };
  const { lead, sectionOfNumberMap } = readFileSections(text);
  const section = sectionOfNumberMap.get(Number(number));
  if (section === undefined) return { why: `${file} of the skill code-style holds no section ${number}`, recheck: false };
  if (!normalizeClause(section).includes(normalizeClause(String(override.says || "")))) return { why: `section ${number} of ${file} does not hold the quoted clause "${override.says}"`, recheck: false };
  if (lead.includes(NARROWER_MARK)) return { why: "", recheck: false };
  const lineOfTheClause = findLineOfTheClause(section, String(override.says || ""));
  if (lineOfTheClause !== undefined && lineOfTheClause.includes(NARROWER_MARK)) {
    if (!LINE_BOOK_CITATION.test(lineOfTheClause)) return { why: "", recheck: false };
    return { why: `the line of section ${number} of ${file} that holds the quoted clause holds the mark ${NARROWER_MARK} and also a citation of the book, so whether the mark reaches the quoted clause is a reading`, recheck: true };
  }
  if (!section.includes(NARROWER_MARK)) return { why: `section ${number} of ${file} holds no mark ${NARROWER_MARK}, so its rule is a design direction of the book`, recheck: false };
  if (BOOK_CITATION.test(section)) return { why: `section ${number} of ${file} holds the mark ${NARROWER_MARK} and also a citation of the book, so whether the mark reaches the quoted clause is a reading`, recheck: true };
  return { why: "", recheck: false };
};

const findOverrideOnABookRuleDefects = model => {
  const defects = [];
  readList(model.decisions.conventions?.overrides).forEach((override, at) => {
    if (!KINDS_ON_A_MARKED_RULE.has(override.kind) || !isAText(override.codeStyle) || !isAText(override.says)) return;

    const { why, recheck } = findWhyNotAMarkedRule(override);
    if (!why) return;
    const createTheDefect = recheck ? createRecheckDefect : createDefect;
    defects.push(createTheDefect(DEFECT_CODES.OVERRIDE_ON_A_BOOK_RULE, `decisions.conventions.overrides[${at}].codeStyle`, `the ${override.kind} names ${override.codeStyle}, and ${why}; a project overrides only a rule of the skill marked ${NARROWER_MARK}`));
  });
  return defects;
};

const isAListedFile = (conventions, conventionsFolder, file) => readList(conventions.files)
  .map(listed => path.posix.normalize(listed))
  .some(listed => listed === file || listed === path.posix.join(conventionsFolder, file));

// Why the project file an object names is no conventions file of the model; an empty text where it is one.
const findWhyNotAListedProjectFile = (conventions, override, currentTree) => {
  const projectId = PROJECT_ID.exec(String(override.project || "").trim());
  if (!projectId) return `${override.project} is not in the form project <file> §<n>`;

  const [, file, number] = projectId;
  const conventionsFolder = path.posix.normalize(String(conventions.folder || "")).replace(/\/+$/, "");
  if (!isAListedFile(conventions, conventionsFolder, path.posix.normalize(file))) return `decisions.conventions.files does not list ${file}`;
  const text = currentTree.readFileText(path.posix.join(conventionsFolder, file));
  if (text === null) return `the current tree holds no ${path.posix.join(conventionsFolder, file)}`;
  if (!readFileSections(text).sectionOfNumberMap.has(Number(number))) return `${file} holds no section ${number}`;
  return "";
};

const findOverrideFileUnlistedDefects = (model, currentTree) => {
  const conventions = model.decisions.conventions;
  if (!conventions) return [];

  const defects = [];
  readList(conventions.overrides).forEach((override, at) => {
    if (!KINDS_WITH_A_PROJECT_FILE.has(override.kind) || !isAText(override.project)) return;

    const why = findWhyNotAListedProjectFile(conventions, override, currentTree);
    if (why) defects.push(createDefect(DEFECT_CODES.OVERRIDE_FILE_UNLISTED, `decisions.conventions.overrides[${at}].project`, `the ${override.kind} names ${override.project}, and ${why}; a project overrides only through its own conventions files`));
  });
  return defects;
};

// The code-style side reads the files of the plugin and needs no current tree; the project side reads the conventions files of the current tree.
export const findConventionOverrideDefects = (model, currentTree) => [
  ...findOverrideOnABookRuleDefects(model),
  ...(currentTree ? findOverrideFileUnlistedDefects(model, currentTree) : []),
];
