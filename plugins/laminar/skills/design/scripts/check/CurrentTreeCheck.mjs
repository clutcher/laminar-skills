import path from "node:path";
import { KINDS, getFileOfTheChild, getFolderPath, isAText, isMarkedUnchanged, readList } from "../model/DesignModel.mjs";
import { isATestFile, readParsedLanguage } from "../model/SourceLanguages.mjs";
import { readDeclaredTypes, isInsideTheBody } from "./DeclaredTypes.mjs";
import { DEFECT_CODES, createDefect, createRecheckDefect } from "./DesignDefect.mjs";
import { describeTheChangeOfTheMember } from "./MemberChange.mjs";

const LINE_COMMENT_EXTENSIONS = new Set([".py", ".rb", ".sh"]);

// The public members of each language whose files declare them by a mark the line shows: Java, Kotlin, TypeScript, Python and Go.
const PUBLIC_MEMBERS_OF_EXTENSION_MAP = new Map([
  [".java", /\bpublic\s+(?:static\s+|final\s+|abstract\s+|synchronized\s+|default\s+|<[^>]*>\s+)*[\w$.<>[\]?, ]+?\s+([a-zA-Z_$][\w$]*)\s*\(/g],
  [".kt", /^\s*(?:override\s+|open\s+|suspend\s+|public\s+)*fun\s+(?:<[^>]*>\s*)?([A-Za-z_]\w*)\s*\(/gm],
  [".ts", /^\s*(?:public\s+|static\s+|async\s+|readonly\s+)*([a-zA-Z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{;]*)?\{/gm],
  [".py", /^\s*def\s+([A-Za-z]\w*)\s*\(/gm],
  [".go", /^func\s+(?:\([^)]*\)\s*)?([A-Z]\w*)\s*\(/gm],
]);

// The languages where a class the file does not export is private to the file.
const LANGUAGES_THAT_EXPORT = new Set(["JavaScript", "TypeScript"]);

const WORDS_THAT_OPEN_NO_MEMBER = new Set(["if", "for", "while", "switch", "catch", "return", "function", "constructor"]);

const PATHS_LINE = /^paths[ \t]*:[ \t]*(.*)$/m;

const PATH_ITEM = /^\s*-\s*["']?([^"'\n]+?)["']?\s*$/gm;

const QUOTED_TEXT = /["']([^"']+)["']/g;

const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

const CONVENTIONS_FILE_SUFFIX = ".md";

const isAWordIn = (text, word) => new RegExp(`(^|[^\\w$])${word.replace(/[$]/g, "\\$")}([^\\w$]|$)`).test(text);

const stripComments = (text, file) => {
  const withoutBlocks = text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
  return LINE_COMMENT_EXTENSIONS.has(path.extname(file)) ? withoutBlocks.replace(/#.*$/gm, "") : withoutBlocks;
};

const findOldPathDefects = (model, currentTree) => {
  const defects = [];
  model.folders.forEach((folder, folderAt) => {
    readList(folder.children).forEach((child, childAt) => {
      if (!isAText(child.oldPath) || currentTree.holdsThePath(child.oldPath)) return;
      defects.push(createDefect(DEFECT_CODES.OLD_PATH_NOT_IN_TREE, `folders[${folderAt}].children[${childAt}].oldPath`, `the current tree holds no file ${child.oldPath}`));
    });
  });
  return defects;
};

const readOldFileOfTheClass = (model, theClass) => {
  const child = model.findChildOfTheFile(theClass.file);
  return child && isAText(child.oldPath) ? child.oldPath : theClass.file;
};

const findOldNameDefects = (model, currentTree) => {
  const defects = [];
  for (const theClass of model.classes) {
    if (!isAText(theClass.file)) continue;

    const oldFile = readOldFileOfTheClass(model, theClass);
    const oldText = currentTree.readFileText(oldFile);
    const holdsTheWord = word => oldText !== null && isAWordIn(stripComments(oldText, oldFile), word);
    if (isAText(theClass.oldName) && !holdsTheWord(theClass.oldName)) defects.push(createDefect(DEFECT_CODES.OLD_NAME_NOT_IN_TREE, `${model.getClassPath(theClass)}.oldName`, `the current file ${oldFile} declares no ${theClass.oldName}`));
    for (const method of readList(theClass.methods)) {
      if (!isAText(method.oldName) || holdsTheWord(method.oldName)) continue;
      defects.push(createDefect(DEFECT_CODES.OLD_NAME_NOT_IN_TREE, `${model.getMethodPath(theClass, method)}.oldName`, `the current file ${oldFile} holds no ${method.oldName}`));
    }
    readList(theClass.removed).forEach((removedName, at) => {
      if (holdsTheWord(removedName)) return;
      defects.push(createDefect(DEFECT_CODES.REMOVED_NAME_NOT_IN_TREE, `${model.getClassPath(theClass)}.removed[${at}]`, `the current file ${oldFile} holds no ${removedName} to remove`));
    });
  }
  return defects;
};

const readPublicMembers = (text, file) => {
  const memberPattern = PUBLIC_MEMBERS_OF_EXTENSION_MAP.get(path.extname(file));
  if (!memberPattern) return [];
  return [...text.matchAll(memberPattern)].map(match => ({ name: match[1], at: match.index })).filter(({ name }) => !WORDS_THAT_OPEN_NO_MEMBER.has(name) && !name.startsWith("_"));
};

const readLastNamePiece = className => className.split(".").pop();

const listAccountedMemberNames = classes => classes.flatMap(theClass => [
  theClass.name,
  readLastNamePiece(theClass.name),
  ...readList(theClass.fields).map(field => field.name),
  ...readList(theClass.methods).flatMap(method => [method.name, method.oldName]),
  ...readList(theClass.removed),
]);

// An oldName of a nested class may name the inner type alone, so it takes the outer names of the class's own name.
const readOldTypeName = theClass => {
  if (!isAText(theClass.oldName) || theClass.oldName.includes(".") || !theClass.name.includes(".")) return theClass.oldName;
  return `${theClass.name.slice(0, theClass.name.lastIndexOf("."))}.${theClass.oldName}`;
};

const isATestFileOfTheModel = (model, file) => isATestFile(file) || [...readList(model.decisions.tests?.integration), ...readList(model.decisions.tests?.unit)].some(tests => tests.file === file);

// A helper type of a test file, private, nested in another type, or a script class the file does not export, is the test's own detail, which its test accounts for.
const isAHelperOfTheTest = (declaredType, file) => declaredType.isPrivate || declaredType.outerType !== null || (LANGUAGES_THAT_EXPORT.has(readParsedLanguage(file)) && !declaredType.isExported);

const findUnaccountedNameDefects = (model, currentTree) => {
  const defects = [];
  model.folders.forEach((folder, folderAt) => {
    readList(folder.children).forEach((child, childAt) => {
      if (child.kind !== KINDS.MODIFIED) return;

      const file = getFileOfTheChild(folder, child);
      const currentText = currentTree.readFileText(file);
      if (currentText === null) return;

      const childPath = `folders[${folderAt}].children[${childAt}]`;
      const codeText = stripComments(currentText, file);
      const classesOfTheFile = model.classes.filter(theClass => theClass.file === file);
      const accountedClassNames = new Set([...classesOfTheFile.flatMap(theClass => [theClass.name, readOldTypeName(theClass)]), ...readList(child.removedClasses)]);
      const isATest = isATestFileOfTheModel(model, file);
      const testHelpers = [];
      for (const declaredType of readDeclaredTypes(codeText)) {
        if (accountedClassNames.has(declaredType.name)) continue;
        if (isATest && isAHelperOfTheTest(declaredType, file)) {
          testHelpers.push(declaredType);
          continue;
        }
        defects.push(createDefect(DEFECT_CODES.CURRENT_CLASS_UNACCOUNTED, childPath, `the current file ${file} declares ${declaredType.name}, which the model neither keeps under classes, renames by oldName nor lists in removedClasses`));
      }
      if (!classesOfTheFile.length) return;

      const accountedMemberNames = new Set(listAccountedMemberNames(classesOfTheFile));
      const memberNames = new Set(readPublicMembers(codeText, file).filter(member => !testHelpers.some(helper => isInsideTheBody(helper, member.at))).map(member => member.name));
      for (const memberName of memberNames) {
        if (accountedMemberNames.has(memberName) || accountedClassNames.has(memberName)) continue;
        defects.push(createRecheckDefect(DEFECT_CODES.CURRENT_MEMBER_UNACCOUNTED, childPath, `the current file ${file} declares the public member ${memberName}, which the model neither keeps, renames by oldName nor lists in removed`));
      }
    });
  });
  return defects;
};

const readPathGlobs = text => {
  const frontmatter = FRONTMATTER.exec(text.replace(/\r\n/g, "\n"));
  const pathsLine = frontmatter ? PATHS_LINE.exec(frontmatter[1]) : null;
  if (!pathsLine) return null;

  const inlineValue = pathsLine[1].trim();
  if (inlineValue) return [...inlineValue.matchAll(QUOTED_TEXT)].map(match => match[1]).concat(/^[^["']/.test(inlineValue) ? [inlineValue] : []);
  const pathsText = frontmatter[1].slice(pathsLine.index + pathsLine[0].length);
  const items = [];
  for (const line of pathsText.split("\n").slice(1)) {
    if (!/^\s*-/.test(line)) break;
    items.push(...[...line.matchAll(PATH_ITEM)].map(match => match[1]));
  }
  return items;
};

const isPrefixRelated = (first, second) => first.startsWith(second) || second.startsWith(first);

const matchesAFolderOfTheModel = (model, globs) => globs.some(glob => {
  const literalPrefix = glob.split("*")[0];
  return model.folders.some(folder => isAText(folder.path) && isPrefixRelated(`${getFolderPath(folder)}/`, literalPrefix));
});

const findConventionsFileDefects = (model, currentTree) => {
  const conventions = model.decisions.conventions;
  if (!conventions || !isAText(conventions.folder)) return [];

  const conventionsFolder = path.posix.normalize(conventions.folder).replace(/\/+$/, "");
  const listedFiles = new Set(readList(conventions.files).map(file => path.posix.normalize(file)));
  const defects = [];
  for (const repositoryFile of currentTree.listFilesUnder(conventionsFolder).filter(file => file.endsWith(CONVENTIONS_FILE_SUFFIX))) {
    if (listedFiles.has(repositoryFile) || listedFiles.has(path.posix.relative(conventionsFolder, repositoryFile))) continue;

    const globs = readPathGlobs(currentTree.readFileText(repositoryFile) || "");
    if (globs !== null && !matchesAFolderOfTheModel(model, globs)) continue;
    defects.push(createDefect(DEFECT_CODES.CONVENTIONS_FILE_UNLISTED, "decisions.conventions.files", `the conventions file ${repositoryFile} applies to a folder of the model, and the list does not hold it`));
  }
  return defects;
};

const findUnchangedEntryDefects = (model, currentTree) => {
  const defects = [];
  readList(model.decisions.entries).forEach((entry, at) => {
    const method = entry.changed === false ? model.findMethod(entry.entry) : null;
    if (!method) return;

    const change = describeTheChangeOfTheMember(model, model.findClass(entry.entry), [method], currentTree);
    if (change) defects.push(createDefect(DEFECT_CODES.ENTRY_CHANGED_BUT_MARKED_UNCHANGED, `decisions.entries[${at}].changed`, `the entry ${entry.entry} is marked unchanged, and ${change}`));
  });
  return defects;
};

const findUnchangedMethodDefects = (model, currentTree) => {
  const defects = [];
  for (const { theClass, method, displayName } of model.listMethodsWithClass()) {
    if (!isMarkedUnchanged(method) || !isAText(theClass.file)) continue;

    const currentFile = readOldFileOfTheClass(model, theClass);
    if (currentTree.holdsTheSignature(currentFile, method)) continue;
    defects.push(createDefect(DEFECT_CODES.METHOD_CHANGED_BUT_MARKED_UNCHANGED, `${model.getMethodPath(theClass, method)}.unchanged`, `${displayName} is marked unchanged, and the current file ${currentFile} holds no ${method.name} with the parameters of the model`));
  }
  return defects;
};

export const findCurrentTreeDefects = (model, currentTree) => [
  ...findUnchangedEntryDefects(model, currentTree),
  ...findUnchangedMethodDefects(model, currentTree),
  ...findOldPathDefects(model, currentTree),
  ...findOldNameDefects(model, currentTree),
  ...findUnaccountedNameDefects(model, currentTree),
  ...findConventionsFileDefects(model, currentTree),
];
