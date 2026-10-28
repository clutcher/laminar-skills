import path from "node:path";
import { chooseRepositoryToRead, PublicChangeKinds } from "../../code/index.mjs";
import { buildFileAndLineKey } from "./abstractions/AbstractionsAtPlaces.mjs";
import { ChangedLinesText } from "../prepare/formats/ChangedLinesText.mjs";
import { REVIEW_ABSTRACTIONS_FILE } from "../prepare/PrepareStep.mjs";
import { readJsonFile } from "../../files/jsonFile.mjs";

const listTopClassesAboveTheBoundaries = codeUnderReview => codeUnderReview
  .flatMap(codeUnderReview => codeUnderReview.boundaries || [])
  .flatMap(boundary => (boundary.reach || {}).topClasses || []);

const collectEntryMethodsByClassPlace = codeUnderReview => new Map(listTopClassesAboveTheBoundaries(codeUnderReview)
  .filter(topClass => (topClass.methods || []).length === 1)
  .map(topClass => [buildFileAndLineKey(topClass.path, topClass.line), { file: topClass.path, line: topClass.methods[0].line }]));

const readTheChangedLinesOfTheMark = reviewed => reviewed.changedLinesOfTheKindBase || reviewed.changedLines;

export class PreparedRun {
  constructor(runFolder) {
    const prepared = readJsonFile(path.join(runFolder, "prepare.json"));
    const preparedScriptFindings = prepared.scriptFindings || [];
    this.prepared = { ...prepared, codeUnderReview: [...(prepared.codeUnderReview || []), ...preparedScriptFindings.map(scriptFinding => scriptFinding.codeUnderReview)] };
    this.scriptFindings = preparedScriptFindings.map(scriptFinding => scriptFinding.finding);
    this.repository = chooseRepositoryToRead(this.prepared.mode, this.prepared.target) || "";
    const reviewed = readJsonFile(path.join(runFolder, REVIEW_ABSTRACTIONS_FILE));
    this.changedLinesOfTheMark = new ChangedLinesText(readTheChangedLinesOfTheMark(reviewed));
    this.entryBoundaries = reviewed.entryBoundaries || [];
    this.codeForms = reviewed.codeForms || [];
    this.reviewedAbstractions = reviewed.abstractions || [];
    this.abstractionsOfTheChange = reviewed.abstractionsOfTheChange || [];
    this.publicChangeKinds = PublicChangeKinds.createFromJSON(reviewed.publicChangeKinds);
  }

  findEntryMethodOfTheClassAt(file, line) {
    if (!this.entryMethodsByClassPlaceMap) this.entryMethodsByClassPlaceMap = collectEntryMethodsByClassPlace(this.prepared.codeUnderReview || []);
    return this.entryMethodsByClassPlaceMap.get(buildFileAndLineKey(file, line)) || null;
  }

  findCodeUnderReview(codeUnderReviewId) {
    return (this.prepared.codeUnderReview || []).find(codeUnderReview => codeUnderReview.id === codeUnderReviewId) || null;
  }
}
