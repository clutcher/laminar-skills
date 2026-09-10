import path from "node:path";
import { FILE_LIST_SECTIONS, readListedText, findPlaceOfSliceLine, restoreListedFileFromTheSourceRoot } from "../../prepare/formats/SliceFormat.mjs";
import { readRunFileText } from "../../../files/runFile.mjs";
import { SCRIPT_JUDGE_TYPE } from "../../prepare/settled/ScriptFindings.mjs";
import { readSourceRoot } from "../../prepare/formats/CodeUnderReviewText.mjs";

const CODE_UNDER_REVIEW_FOLDER = "code-under-review";

const THE_SLICE_FENCE = "```";

const SECTION_HEAD_PATTERN = /^--- (\S+)/;

const PATH_LINE_PATTERN = /^path: (\S.*)$/;

export const buildCodeUnderReviewFile = codeUnderReview => `${CODE_UNDER_REVIEW_FOLDER}/${codeUnderReview.id}-${codeUnderReview.judgeType}.md`;

const readCodeUnderReviewLines = file => readRunFileText(file).split(/\r?\n/);

const findNamedPath = line => {
  const named = PATH_LINE_PATTERN.exec(line);
  return named ? named[1].trim() : "";
};

const buildPlacesByCodeUnderReviewLine = (codeUnderReviewLines, abstractionPath, sourceRoot) => {
  const placesByCodeUnderReviewLineMap = new Map();
  let inTheSlice = false;
  let fileOfTheSlice = abstractionPath;
  let sectionName = "";
  codeUnderReviewLines.forEach((line, at) => {
    if (line.startsWith(THE_SLICE_FENCE)) { inTheSlice = !inTheSlice; return; }
    if (!inTheSlice) { fileOfTheSlice = findNamedPath(line) || fileOfTheSlice; return; }
    const head = SECTION_HEAD_PATTERN.exec(line);
    if (head) { sectionName = head[1]; return; }
    if (FILE_LIST_SECTIONS.has(sectionName)) { if (line.trim()) placesByCodeUnderReviewLineMap.set(at + 1, { file: restoreListedFileFromTheSourceRoot(sectionName, readListedText(line), sourceRoot), line: 0 }); return; }
    const place = findPlaceOfSliceLine(fileOfTheSlice, line);
    if (place) placesByCodeUnderReviewLineMap.set(at + 1, { file: place.file, line: place.line });
  });
  return placesByCodeUnderReviewLineMap;
};

export class CodeUnderReviewPlaces {
  constructor(runFolder, everyCodeUnderReview) {
    this.runFolder = runFolder;
    this.codeUnderReviewByIdMap = new Map((everyCodeUnderReview || []).map(codeUnderReview => [codeUnderReview.id, codeUnderReview]));
    this.placesByIdMap = new Map();
  }

  collectPlaces(codeUnderReviewId) {
    if (!this.placesByIdMap.has(codeUnderReviewId)) this.placesByIdMap.set(codeUnderReviewId, this.readPlaces(codeUnderReviewId));
    return this.placesByIdMap.get(codeUnderReviewId);
  }

  readPlaces(codeUnderReviewId) {
    const codeUnderReview = this.codeUnderReviewByIdMap.get(codeUnderReviewId);
    if (!codeUnderReview || codeUnderReview.judgeType === SCRIPT_JUDGE_TYPE) return new Map();
    return buildPlacesByCodeUnderReviewLine(readCodeUnderReviewLines(path.join(this.runFolder, buildCodeUnderReviewFile(codeUnderReview))), codeUnderReview.path, readSourceRoot(codeUnderReview));
  }

  findPlace(codeUnderReviewId, codeUnderReviewLine) {
    return this.collectPlaces(codeUnderReviewId).get(Number(codeUnderReviewLine)) || null;
  }
}

export const NO_CODE_UNDER_REVIEW_PLACES = new CodeUnderReviewPlaces("", []);
