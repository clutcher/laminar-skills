import { buildFileAndLineKey } from "../abstractions/AbstractionsAtPlaces.mjs";
import { collectEveryAbstraction } from "../lines/SliceLines.mjs";
import { listPlacesShownInSections, readSliceSections } from "../../prepare/formats/SliceFormat.mjs";

const CALLERS_IN_FILE_SECTION = "callersInFile";

const listCallPlacesOf = abstraction => listPlacesShownInSections(abstraction.path, readSliceSections(abstraction).filter(section => section.section === CALLERS_IN_FILE_SECTION));

const listLinesOfAPlace = place => (place.lines ? place.lines : [place.line]);

const listPlacesOf = possibleFinding => [...(possibleFinding.evidence || []), ...(possibleFinding.places || []), ...(possibleFinding.alsoAt || [])];

const buildCalledIdsByPlaceMap = abstractions => {
  const calledIdsByPlaceMap = new Map();
  for (const abstraction of collectEveryAbstraction(abstractions)) {
    for (const place of listCallPlacesOf(abstraction)) {
      const key = buildFileAndLineKey(place.file, place.line);
      calledIdsByPlaceMap.set(key, [...(calledIdsByPlaceMap.get(key) || []), abstraction.id]);
    }
  }
  return calledIdsByPlaceMap;
};

const buildAbstractionAndJudgeTypeKey = (abstractionId, judgeType) => `${abstractionId}|${judgeType}`;

export class CalledCodeUnderReview {
  constructor(reviewedAbstractions, everyCodeUnderReview) {
    this.calledIdsByPlaceMap = buildCalledIdsByPlaceMap(reviewedAbstractions);
    this.codeUnderReviewByAbstractionMap = new Map((everyCodeUnderReview || [])
      .map(codeUnderReview => [buildAbstractionAndJudgeTypeKey(codeUnderReview.abstractionId, codeUnderReview.judgeType), codeUnderReview]));
  }

  listCalledAtThePlacesOf(possibleFinding, judgeType) {
    const calledIds = listPlacesOf(possibleFinding)
      .flatMap(place => listLinesOfAPlace(place).flatMap(line => this.calledIdsByPlaceMap.get(buildFileAndLineKey(place.file, line)) || []));
    return [...new Set(calledIds)]
      .map(abstractionId => this.codeUnderReviewByAbstractionMap.get(buildAbstractionAndJudgeTypeKey(abstractionId, judgeType)))
      .filter(Boolean)
      .map(codeUnderReview => ({ id: codeUnderReview.id, judgeType }));
  }
}

export const NO_CALLED_CODE_UNDER_REVIEW = new CalledCodeUnderReview([], []);
