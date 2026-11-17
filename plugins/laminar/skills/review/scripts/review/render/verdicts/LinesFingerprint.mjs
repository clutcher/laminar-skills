import crypto from "node:crypto";
import path from "node:path";
import { FROM_THE_CHANGE_ONLY, isAStoppedLine, parseOwnLinesOfTheSlice, readListedPath, readSliceSections } from "../../prepare/formats/SliceFormat.mjs";
import { REVIEW_ABSTRACTIONS_FILE } from "../../prepare/PrepareStep.mjs";
import { readJsonFileIfPresent } from "../../../files/jsonFile.mjs";

const PREPARE_FILE = "prepare.json";

const LINES_FINGERPRINT_LENGTH = 12;

// The own simple name stands as this mark, so a rename alone leaves the lines fingerprint as it was.
const OWN_NAME_MARK = "<own name>";

const escapeForAPattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findTheNamePattern = name => new RegExp(`(?<![A-Za-z0-9_$])${escapeForAPattern(name)}(?![A-Za-z0-9_$])`, "g");

const maskTheName = (text, name, mark) => (name ? text.replace(findTheNamePattern(name), mark) : text);

const formatRenameMark = at => `<rename ${at + 1}>`;

const standsInTheTexts = (texts, name) => texts.some(text => findTheNamePattern(name).test(text));

// The old name and the new name of each rename the plan makes stand as 1 mark per rename, so the planned rename of a name the lines use leaves the lines fingerprint as it was, and any other change does not. Lines that hold both names of a rename keep both, because 1 mark for both would hide a swap of the 2 names.
const maskTheRenames = (texts, renameMask) => renameMask.reduce((masked, [oldName, newName], at) => {
  if (standsInTheTexts(masked, oldName) && standsInTheTexts(masked, newName)) return masked;
  return masked.map(text => maskTheName(maskTheName(text, oldName, formatRenameMark(at)), newName, formatRenameMark(at)));
}, texts);

const normalizeTheOwnLine = text => text.replace(/\s+/g, " ").trim();

// Only own lines that run from the first line of the span to its last, 1 per line, are the lines of the abstraction: reference lines, hunk lines and the lines of a field group are not.
const isWhole = (ownLines, span) => Boolean(span)
  && ownLines.length === span.to - span.from + 1
  && ownLines.every((ownLine, offset) => ownLine.line === span.from + offset);

const FOLDER_SCALES = new Set(["application", "module"]);

// The sections of a folder's slice that list the files and folders under it, as the prepare command read them from the tree.
const CHILD_LIST_SECTIONS = new Set(["moduleTree", "fileList"]);

const APPLICATION_PATH = ".";

const hashTheTexts = texts => crypto.createHash("sha256").update(texts.join("\n")).digest("hex").slice(0, LINES_FINGERPRINT_LENGTH);

// The first segment under the folder of a listed path, or "" where the path lies outside it.
const readChildName = (listedPath, folderPath) => {
  const prefix = folderPath === APPLICATION_PATH ? "" : `${folderPath}/`;
  return listedPath.startsWith(prefix) ? listedPath.slice(prefix.length).split("/")[0] : "";
};

// The state of a folder is the names of its children, files and folders, so a child added, removed or renamed reads changed since; "" where the listing stopped at its limit or holds only the files of the change, because then it does not hold every child.
const computeChildNamesFingerprint = folder => {
  const listedLines = readSliceSections(folder).filter(section => CHILD_LIST_SECTIONS.has(section.section)).flatMap(section => section.lines);
  if (!listedLines.length || listedLines.some(line => isAStoppedLine(line) || line === FROM_THE_CHANGE_ONLY)) return "";

  const childNames = new Set(listedLines.map(line => readChildName(readListedPath(line), String(folder.path || ""))).filter(Boolean));
  return childNames.size ? hashTheTexts([...childNames].sort()) : "";
};

const isAFolder = abstraction => FOLDER_SCALES.has(String(abstraction.scale || "").toLowerCase());

const isInTheSpan = (ownLine, span) => ownLine.line >= span.from && ownLine.line <= span.to;

// A blank own line before or after the span, such as the line a hunk shows above an added method, carries no code, so it is no line of the abstraction.
const listOwnLinesOfTheSpan = abstraction => {
  const span = abstraction.lines;
  return parseOwnLinesOfTheSlice(abstraction).filter(ownLine => !span || isInTheSpan(ownLine, span) || ownLine.text.trim());
};

// The own lines of an abstraction as texts, with its own simple name masked; none where its own lines are not whole.
const readOwnTexts = abstraction => {
  const ownLines = listOwnLinesOfTheSpan(abstraction);
  if (!ownLines.length || !isWhole(ownLines, abstraction.lines)) return [];

  const simpleName = String(abstraction.name || "");
  return ownLines.map(ownLine => normalizeTheOwnLine(ownLine.text)).filter(Boolean).map(text => maskTheName(text, simpleName, OWN_NAME_MARK));
};

// The state of 1 abstraction of a run folder, an entry of the code under review or an abstraction of the tree: of a folder its child names, of any other abstraction its own lines with the renames of the rename mask masked; "" where its own lines are not whole.
export const computeLinesFingerprint = (abstraction, renameMask = []) => {
  if (isAFolder(abstraction)) return computeChildNamesFingerprint(abstraction);

  const texts = readOwnTexts(abstraction);
  return texts.length ? hashTheTexts(maskTheRenames(texts, renameMask)) : "";
};

// The renames, each [old name, new name], whose old name stands in the own lines of the abstraction and whose new name does not, so the mask holds only a rename the lines are still to make.
const listRenamesInTheLines = (abstraction, renames) => {
  const texts = isAFolder(abstraction) ? [] : readOwnTexts(abstraction);
  return renames.filter(([oldName, newName]) => standsInTheTexts(texts, oldName) && !standsInTheTexts(texts, newName));
};

const listTheTree = abstractions => abstractions.flatMap(abstraction => [abstraction, ...listTheTree(abstraction.children || [])]);

const isTheAbstraction = (abstraction, displayNames, scale, file) => displayNames.includes(abstraction.displayName)
  && String(abstraction.scale || "").toLowerCase() === scale
  && (!file || abstraction.path === file);

// The abstractions of 1 run folder that a lines fingerprint is read from: the code under review of prepare.json first, then the tree of review-abstractions.json, which a stored copy of a run folder may lack.
export class LinesFingerprintsOfTheRun {
  constructor(prepared, reviewed) {
    this.abstractions = [...((prepared || {}).codeUnderReview || []), ...listTheTree((reviewed || {}).abstractions || [])];
  }

  static readFrom(runFolder) {
    return new LinesFingerprintsOfTheRun(readJsonFileIfPresent(path.join(runFolder, PREPARE_FILE), null), readJsonFileIfPresent(path.join(runFolder, REVIEW_ABSTRACTIONS_FILE), null));
  }

  findLinesFingerprint(displayNames, scale, file, renameMask = []) {
    for (const abstraction of this.abstractions.filter(given => isTheAbstraction(given, displayNames, scale, file))) {
      const linesFingerprint = computeLinesFingerprint(abstraction, renameMask);
      if (linesFingerprint) return linesFingerprint;
    }
    return "";
  }

  // The lines fingerprint of a decision and its rename mask: the renames of the plan that its own lines use.
  findLinesFingerprintWithItsRenames(displayNames, scale, file, renames) {
    for (const abstraction of this.abstractions.filter(given => isTheAbstraction(given, displayNames, scale, file))) {
      const renameMask = listRenamesInTheLines(abstraction, renames);
      const linesFingerprint = computeLinesFingerprint(abstraction, renameMask);
      if (linesFingerprint) return { linesFingerprint, renameMask };
    }
    return { linesFingerprint: "", renameMask: [] };
  }
}
