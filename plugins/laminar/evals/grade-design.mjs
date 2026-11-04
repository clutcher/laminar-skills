// Grades the design model that the skill design wrote against the level 1 lines of an eval case, at no model cost.
//   node grade-design.mjs <case-dir> <results folder> [--repo <built fixture>]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CHECK_DESIGN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../skills/design/scripts/checkDesign.mjs");

const USAGE = "usage: node grade-design.mjs <case-dir> <results folder> [--repo <built fixture>]";

const EXPECTED_FILE = "expected.md";
const REVIEW_FILE = "review.md";
const DESIGN_MODEL_FILE = "design-model.json";

const LEVEL_1 = "Level 1";
const SECTION_HEAD = "## ";
const LIST_ITEM = /^\s*-\s+(.+?)\s*$/;
const FILE_EXTENSION = /\.[A-Za-z0-9]+$/;
const NUMBERS = /\d+/g;

const KINDS = Object.freeze({ CREATED: "created", MOVED: "moved", REMOVED: "removed" });

const DEFECT_MARK = "defect";
const FIELD_SEPARATOR = "\t";
const MEMBER_SEPARATOR = "#";

const readSectionLinesMap = text => {
  const sectionLinesMap = new Map();
  let lines = null;
  for (const line of text.split("\n")) {
    if (line.startsWith(SECTION_HEAD)) {
      lines = [];
      sectionLinesMap.set(line.slice(SECTION_HEAD.length).trim(), lines);
      continue;
    }
    if (lines) lines.push(line);
  }
  return sectionLinesMap;
};

const readSegmentsOfThePath = given => String(given || "").replace(/`/g, "").trim().replace(FILE_EXTENSION, "").split("/").filter(Boolean);

const endsWithTheSegments = (segments, tail) => tail.length > 0
  && tail.length <= segments.length
  && tail.every((segment, order) => segment === segments[segments.length - tail.length + order]);

const readNumbersOfTheText = text => (String(text).match(NUMBERS) || []).map(Number);

const readList = value => (Array.isArray(value) ? value : []);

const joinChildPath = (folder, child) => `${folder.path}/${child.name}`;

const isRemoved = entry => entry.kind === KINDS.REMOVED;

// The files the model lists as removed, so neither they nor the classes of their file stand in the tree after the change.
const readRemovedFilePaths = model => new Set(readList(model.folders).flatMap(folder => readList(folder.children)
  .filter(child => isRemoved(folder) || isRemoved(child))
  .map(child => joinChildPath(folder, child))));

const readRemovedFolderPaths = model => readList(model.folders).filter(isRemoved).map(folder => folder.path);

const isInARemovedFolder = (filePath, removedFolderPaths) => removedFolderPaths.some(folderPath => filePath.startsWith(`${folderPath}/`));

const readClassesOnTheTree = model => {
  const removedFilePaths = readRemovedFilePaths(model);
  const removedFolderPaths = readRemovedFolderPaths(model);
  return readList(model.classes).filter(theClass => !removedFilePaths.has(theClass.file) && !isInARemovedFolder(String(theClass.file), removedFolderPaths));
};

// The paths of the tree after the change: the folders, their children and the files of the classes, each with what names it.
const readTreeEntries = model => {
  const entries = [];
  for (const folder of readList(model.folders).filter(folder => !isRemoved(folder))) {
    entries.push({ segments: readSegmentsOfThePath(folder.path), shown: `folder ${folder.path}` });
    for (const child of readList(folder.children).filter(child => !isRemoved(child))) {
      entries.push({ segments: readSegmentsOfThePath(joinChildPath(folder, child)), shown: `child ${joinChildPath(folder, child)}` });
    }
  }
  for (const theClass of readClassesOnTheTree(model)) entries.push({ segments: readSegmentsOfThePath(theClass.file), shown: `file of class ${theClass.name} ${theClass.file}` });
  return entries;
};

const readClassNames = model => readClassesOnTheTree(model).map(theClass => String(theClass.name || ""));

const createResult = (passed, detail) => ({ passed, detail });

const runTheDesignCheck = graded => {
  const args = [CHECK_DESIGN, "--model", graded.modelPath];
  if (graded.repositoryRoot) args.push("--repo", graded.repositoryRoot);
  if (graded.reviewPath) args.push("--review", graded.reviewPath);
  return spawnSync(process.execPath, args, { encoding: "utf8" });
};

const gradeTheDesignCheck = graded => {
  const checked = runTheDesignCheck(graded);
  if (checked.status !== 0 && checked.status !== 1) return createResult(false, `checkDesign stopped: ${String(checked.stderr || "").trim()}`);

  const defectLines = String(checked.stdout).split("\n").filter(line => line.split(FIELD_SEPARATOR)[0] === DEFECT_MARK);
  if (!defectLines.length) return createResult(true, "checkDesign prints no line marked defect");
  return createResult(false, defectLines.map(line => line.split(FIELD_SEPARATOR).slice(1).join(" ")).join("; "));
};

const findEntriesAtThePath = (graded, wantedPath) => {
  const wanted = readSegmentsOfThePath(wantedPath);
  const found = graded.treeEntries.filter(entry => endsWithTheSegments(entry.segments, wanted)).map(entry => entry.shown);
  const namedClasses = wanted.length === 1 ? graded.classNames.filter(name => name === wanted[0]).map(name => `class ${name}`) : [];
  return [...found, ...namedClasses];
};

const gradeAModelPathPresent = (graded, wantedPath) => {
  const found = findEntriesAtThePath(graded, wantedPath);
  return createResult(found.length > 0, found.length ? `the model holds ${found.join(", ")}` : "the model holds no such path");
};

const gradeAModelPathAbsent = (graded, forbiddenPath) => {
  const found = findEntriesAtThePath(graded, forbiddenPath);
  return createResult(!found.length, found.length ? `the model holds ${found.join(", ")}` : "the model holds no such path");
};

const readChildrenWithTheirPaths = model => readList(model.folders).flatMap(folder => readList(folder.children).map(child => ({ child, childPath: joinChildPath(folder, child) })));

const gradeTheNewFiles = (graded, most) => {
  const newFiles = readChildrenWithTheirPaths(graded.model)
    .filter(({ child }) => child.kind === KINDS.CREATED && child.oldPath === undefined)
    .map(({ childPath }) => childPath);
  return createResult(newFiles.length <= Number(most), `${newFiles.length} created child(ren) with no oldPath${newFiles.length ? `: ${newFiles.join(", ")}` : ""}`);
};

const readClassOfTheName = closedBy => String(closedBy).split(MEMBER_SEPARATOR)[0];

const gradeTheFindingsClosedInOneClass = (graded, numbersText) => {
  const wanted = new Set(readNumbersOfTheText(numbersText));
  const findings = readList(graded.model.decisions && graded.model.decisions.findings).filter(finding => finding.run === undefined && wanted.has(finding.number));
  if (!findings.length) return createResult(false, "decisions.findings holds no object with no run for these numbers");

  const open = findings.filter(finding => typeof finding.closedBy !== "string").map(finding => finding.number);
  if (open.length) return createResult(false, `no closedBy on ${open.join(", ")}`);
  const closingClasses = [...new Set(findings.map(finding => readClassOfTheName(finding.closedBy)))];
  const closedNumbers = findings.map(finding => finding.number).join(", ");
  return createResult(closingClasses.length === 1, `the objects of ${closedNumbers} are closed by ${closingClasses.join(", ")}`);
};

const gradeNoFileMove = graded => {
  const moving = readChildrenWithTheirPaths(graded.model)
    .filter(({ child }) => child.kind === KINDS.MOVED || child.oldPath !== undefined)
    .map(({ childPath }) => childPath);
  return createResult(!moving.length, moving.length ? `moved: ${moving.join(", ")}` : "no child is moved and none holds oldPath");
};

const LEVEL_1_FORMS = Object.freeze([
  { pattern: /^checkDesign: no defect$/, grade: gradeTheDesignCheck },
  { pattern: /^Model path present: `?([^`]+?)`?$/, grade: gradeAModelPathPresent },
  { pattern: /^Model path absent: `?([^`]+?)`?$/, grade: gradeAModelPathAbsent },
  { pattern: /^New files: at most (\d+)$/, grade: gradeTheNewFiles },
  { pattern: /^Closed in 1 class: ([\d, ]+)$/, grade: gradeTheFindingsClosedInOneClass },
  { pattern: /^No file moves$/, grade: gradeNoFileMove },
]);

export const isALevel1Line = line => LEVEL_1_FORMS.some(form => form.pattern.test(line));

const gradeALevel1Line = (graded, line) => {
  for (const form of LEVEL_1_FORMS) {
    const match = form.pattern.exec(line);
    if (match) return form.grade(graded, match[1]);
  }
  return createResult(false, "no level 1 form reads this line");
};

export const readLevel1Lines = expectationText => (readSectionLinesMap(expectationText).get(LEVEL_1) || [])
  .map(line => LIST_ITEM.exec(line))
  .filter(Boolean)
  .map(match => match[1]);

const readTheDesignGraded = (caseDir, resultsFolder, repositoryRoot) => {
  const modelPath = path.join(resultsFolder, DESIGN_MODEL_FILE);
  const model = JSON.parse(fs.readFileSync(modelPath, "utf8"));
  const reviewPath = path.join(caseDir, REVIEW_FILE);
  return {
    model,
    modelPath,
    repositoryRoot,
    reviewPath: fs.existsSync(reviewPath) ? reviewPath : null,
    treeEntries: readTreeEntries(model),
    classNames: readClassNames(model),
  };
};

export const gradeTheDesign = (caseDir, resultsFolder, repositoryRoot = null) => {
  const graded = readTheDesignGraded(caseDir, resultsFolder, repositoryRoot);
  const expectationText = fs.readFileSync(path.join(caseDir, EXPECTED_FILE), "utf8");
  return readLevel1Lines(expectationText).map(line => ({ line, ...gradeALevel1Line(graded, line) }));
};

const readArguments = argv => {
  const repoAt = argv.indexOf("--repo");
  const repositoryRoot = repoAt >= 0 ? argv[repoAt + 1] : null;
  const positional = repoAt >= 0 ? [...argv.slice(0, repoAt), ...argv.slice(repoAt + 2)] : argv;
  if (positional.length !== 2 || (repoAt >= 0 && !repositoryRoot)) return null;
  return { caseDir: path.resolve(positional[0]), resultsFolder: path.resolve(positional[1]), repositoryRoot: repositoryRoot ? path.resolve(repositoryRoot) : null };
};

function gradeTheDesignOfTheCase() {
  const given = readArguments(process.argv.slice(2));
  if (!given) { console.error(USAGE); process.exit(2); }
  if (!fs.existsSync(path.join(given.resultsFolder, DESIGN_MODEL_FILE))) { console.error(`no ${DESIGN_MODEL_FILE} in ${given.resultsFolder}`); process.exit(2); }

  const results = gradeTheDesign(given.caseDir, given.resultsFolder, given.repositoryRoot);
  for (const result of results) console.log(`${result.passed ? "PASS" : "FAIL"}  ${result.line} — ${result.detail}`);
  const failures = results.filter(result => !result.passed).length;
  console.log(`${results.length - failures}/${results.length} level 1 results passed in ${path.basename(given.caseDir)}`);
  process.exit(failures || !results.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) gradeTheDesignOfTheCase();
