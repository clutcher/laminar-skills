import fs from "node:fs";
import path from "node:path";
import { readCheckRules } from "../../../checks/CheckText.mjs";
import { getOrReadAndRemember } from "../../../collections/memos.mjs";
import { resolveAbsolutePath } from "../../../files/paths.mjs";
import { buildCodeUnderReviewFile } from "../abstractions/CodeUnderReviewPlaces.mjs";
import { NO_CALLED_CODE_UNDER_REVIEW } from "./CalledCodeUnderReview.mjs";
import { isReadByTheRefuter, readJudgeTypeOf } from "./RefuterSelection.mjs";
import { buildCoveredPathFileText, buildRefuteFileText } from "./RefuteFileText.mjs";
import { buildVerifyFileText } from "./VerifyFileText.mjs";
import { splitIntoVerifyWaves } from "./VerifyWaves.mjs";

const REFUTE_FOLDER = "refute";
const VERIFY_FOLDER = "verify";
const THE_NUMBER = "{number}";
const THE_ITEM = "{item}";
const REFUTE_FILE_FORM = `${REFUTE_FOLDER}/${THE_NUMBER}.md`;
const VERIFY_FILE_FORM = `${VERIFY_FOLDER}/${THE_ITEM}.md`;

const formatRefuteFile = possibleFindingNumber => REFUTE_FILE_FORM.replace(THE_NUMBER, possibleFindingNumber);

const formatVerifyFile = itemNumber => VERIFY_FILE_FORM.replace(THE_ITEM, itemNumber);

const isNumbered = possibleFinding => Number.isInteger(possibleFinding.number);

const buildCoveredPathTuple = covered => [covered.number, [covered.number]];

const listCodeUnderReviewKeys = (possibleFindings, group, calledCodeUnderReview) => {
  const ownKeys = possibleFindings.map(possibleFinding => ({ id: possibleFinding.codeUnderReviewId, judgeType: readJudgeTypeOf(possibleFinding, group) }));
  const calledKeys = possibleFindings.flatMap(possibleFinding => calledCodeUnderReview.listCalledAtThePlacesOf(possibleFinding, readJudgeTypeOf(possibleFinding, group)));
  return [...new Map([...ownKeys, ...calledKeys].map(key => [`${key.id}|${key.judgeType}`, key])).values()];
};

const groupChecksByJudgeType = (possibleFindings, group) => possibleFindings.reduce((checksByJudgeType, possibleFinding) => {
  const judgeType = readJudgeTypeOf(possibleFinding, group);
  checksByJudgeType[judgeType] = [...new Set([...(checksByJudgeType[judgeType] || []), possibleFinding.check])];
  return checksByJudgeType;
}, {});

export class VerifyHandOff {
  constructor(runFolder, { groups, items, coveredPaths, everyCodeUnderReview, calledCodeUnderReview = NO_CALLED_CODE_UNDER_REVIEW }) {
    this.runFolder = runFolder;
    this.calledCodeUnderReview = calledCodeUnderReview;
    this.items = items;
    this.coveredPaths = (coveredPaths || []).filter(isNumbered);
    this.groupByIdMap = new Map(groups.map(group => [group.id, group]));
    this.codeUnderReviewByIdMap = new Map((everyCodeUnderReview || []).map(codeUnderReview => [codeUnderReview.id, codeUnderReview]));
    this.rulesMemo = new Map();
    this.codeUnderReviewTextMemo = new Map();
    this.itemTuples = this.items.map(item => this.buildItemTuple(item)).filter(Boolean);
    this.list = [...this.itemTuples, ...this.coveredPaths.map(buildCoveredPathTuple)];
    this.waves = splitIntoVerifyWaves(this.list);
  }

  findGroup(item) {
    return this.groupByIdMap.get(item.id) || { possibleFindings: [] };
  }

  listNumberedPossibleFindings(item) {
    return this.findGroup(item).possibleFindings.filter(isNumbered);
  }

  listPossibleFindingsTheRefuterReads(item) {
    const group = this.findGroup(item);
    return group.possibleFindings.filter(possibleFinding => isReadByTheRefuter(possibleFinding, group));
  }

  buildItemTuple(item) {
    const possibleFindingNumbers = this.listPossibleFindingsTheRefuterReads(item).map(possibleFinding => possibleFinding.number);
    return possibleFindingNumbers.length ? [item.number, possibleFindingNumbers] : null;
  }

  buildCounts() {
    const refuterCalls = this.list.reduce((total, [, possibleFindingNumbers]) => total + possibleFindingNumbers.length, 0);
    const numbered = this.items.reduce((total, item) => total + this.listNumberedPossibleFindings(item).length, this.coveredPaths.length);
    return { refuterCalls, excludedFromRefutation: numbered - refuterCalls, verifyWaves: this.waves.length };
  }

  buildVerify() {
    return {
      fileForms: { refute: REFUTE_FILE_FORM, verifier: VERIFY_FILE_FORM },
      list: this.list,
      ...(this.waves.length > 1 ? { waves: this.waves } : {}),
    };
  }

  readRules(judgeType, checks) {
    return getOrReadAndRemember(this.rulesMemo, `${judgeType}|${checks.join(",")}`, () => readCheckRules(judgeType, checks));
  }

  readCodeUnderReviewFile({ id, judgeType }) {
    const codeUnderReview = this.codeUnderReviewByIdMap.get(id) || { id, judgeType };
    const relativePath = buildCodeUnderReviewFile(codeUnderReview);
    const absolutePath = `${resolveAbsolutePath(this.runFolder)}/${relativePath}`;
    const text = getOrReadAndRemember(this.codeUnderReviewTextMemo, relativePath, () => (fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : ""));
    return { path: absolutePath, text };
  }

  buildRefuteFile(possibleFinding, item, group) {
    const judgeType = readJudgeTypeOf(possibleFinding, group);
    return buildRefuteFileText({
      possibleFinding,
      item,
      judgeType,
      rules: this.readRules(judgeType, [possibleFinding.check]),
      codeUnderReviewFile: this.readCodeUnderReviewFile({ id: possibleFinding.codeUnderReviewId, judgeType }),
    });
  }

  buildCoveredPathFile(covered) {
    return buildCoveredPathFileText({
      covered,
      judgeType: covered.judgeType,
      rules: this.readRules(covered.judgeType, [covered.check]),
      codeUnderReviewFile: this.readCodeUnderReviewFile({ id: covered.codeUnderReviewId, judgeType: covered.judgeType }),
    });
  }

  buildVerifyFile(item, group) {
    const possibleFindings = this.listNumberedPossibleFindings(item);
    const checksByJudgeType = groupChecksByJudgeType(possibleFindings, group);
    return buildVerifyFileText({
      item,
      possibleFindings,
      rulesByJudgeType: Object.fromEntries(Object.entries(checksByJudgeType).map(([judgeType, checks]) => [judgeType, this.readRules(judgeType, checks)])),
      codeUnderReviewFiles: listCodeUnderReviewKeys(possibleFindings, group, this.calledCodeUnderReview).map(key => this.readCodeUnderReviewFile(key)),
    });
  }

  clearEarlierFiles() {
    for (const folder of [REFUTE_FOLDER, VERIFY_FOLDER]) fs.rmSync(path.join(this.runFolder, folder), { recursive: true, force: true });
  }

  createFolders() {
    for (const folder of [REFUTE_FOLDER, VERIFY_FOLDER]) fs.mkdirSync(path.join(this.runFolder, folder), { recursive: true });
  }

  writeTo() {
    this.clearEarlierFiles();
    if (this.list.length) this.createFolders();
    this.writeTheItemFiles();
    this.writeTheCoveredPathFiles();
    return this.buildVerify();
  }

  writeTheItemFiles() {
    const itemByNumberMap = new Map(this.items.map(item => [item.number, item]));
    for (const [itemNumber, possibleFindingNumbers] of this.itemTuples) {
      const item = itemByNumberMap.get(itemNumber);
      const group = this.findGroup(item);
      fs.writeFileSync(path.join(this.runFolder, formatVerifyFile(itemNumber)), this.buildVerifyFile(item, group));
      for (const possibleFinding of group.possibleFindings.filter(listed => possibleFindingNumbers.includes(listed.number))) {
        fs.writeFileSync(path.join(this.runFolder, formatRefuteFile(possibleFinding.number)), this.buildRefuteFile(possibleFinding, item, group));
      }
    }
  }

  writeTheCoveredPathFiles() {
    for (const covered of this.coveredPaths) {
      const text = this.buildCoveredPathFile(covered);
      fs.writeFileSync(path.join(this.runFolder, formatRefuteFile(covered.number)), text);
      fs.writeFileSync(path.join(this.runFolder, formatVerifyFile(covered.number)), text);
    }
  }
}
