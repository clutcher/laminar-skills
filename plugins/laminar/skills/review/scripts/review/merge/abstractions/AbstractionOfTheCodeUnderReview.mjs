import { CHECKS_BY_ID_MAP, TRACKS } from "../../../checks/CheckCatalog.mjs";
import { isACoreOperation, isARebuiltValue } from "../../prepare/relations/DesignRelationCodeUnderReview.mjs";
import { buildFileAndLineKey } from "./AbstractionsAtPlaces.mjs";

const CHAIN_GOES_DOWN = "down";

const CHECKS_LANDING_ON_THE_RELATION = Object.freeze([CHECKS_BY_ID_MAP.D2.id, CHECKS_BY_ID_MAP.D3.id]);

const NO_PLACE = null;

const placeAt = (file, line) => (file && line ? { file, line } : NO_PLACE);

const secondPlaceOf = abstraction => (abstraction && abstraction.path ? { file: abstraction.path, line: abstraction.from, displayName: abstraction.name } : NO_PLACE);

const findTheRelationAbstractionPlace = (finding, codeUnderReview) => (CHECKS_LANDING_ON_THE_RELATION.includes(finding.check) ? placeAt(codeUnderReview.path, (codeUnderReview.lines || {}).from) : NO_PLACE);

const findTheRelationSecondPlace = (finding, codeUnderReview) => {
  if (finding.check !== CHECKS_BY_ID_MAP.D3.id) return NO_PLACE;
  if (isACoreOperation(codeUnderReview)) return secondPlaceOf(codeUnderReview.implementation);
  if (isARebuiltValue(codeUnderReview)) return secondPlaceOf(codeUnderReview.value);
  return NO_PLACE;
};

const listTheLoops = codeUnderReview => (codeUnderReview.reachingCalls || []).flatMap(reachingCall => reachingCall.loops || []);

const findTheLoopAbstractionPlace = codeUnderReview => {
  const loops = listTheLoops(codeUnderReview);
  if (loops.length !== 1) return NO_PLACE;
  const place = loops[0].direction === CHAIN_GOES_DOWN ? loops[0].loop : loops[0].changedCall;
  return place ? placeAt(place.path, place.line) : NO_PLACE;
};

const CHECKS_LANDING_ON_THE_ENTRY_BOUNDARY = Object.freeze([CHECKS_BY_ID_MAP.S1.id, CHECKS_BY_ID_MAP.CP1.id]);

const findTheEntryBoundaryAbstractionPlace = (finding, codeUnderReview) => (CHECKS_LANDING_ON_THE_ENTRY_BOUNDARY.includes(finding.check) && (codeUnderReview.boundaries || []).length === 1
  ? placeAt(codeUnderReview.boundaries[0].path, codeUnderReview.boundaries[0].line)
  : NO_PLACE);

const ABSTRACTION_PLACE_FINDERS_BY_TRACK_MAP = Object.freeze({
  [TRACKS.DESIGN]: findTheRelationAbstractionPlace,
  [TRACKS.IO_PATHS]: (finding, codeUnderReview) => findTheLoopAbstractionPlace(codeUnderReview),
  [TRACKS.ENTRY_BOUNDARY]: findTheEntryBoundaryAbstractionPlace,
});

const findTheAbstractionPlace = (finding, codeUnderReview) => {
  const findAbstractionPlace = ABSTRACTION_PLACE_FINDERS_BY_TRACK_MAP[codeUnderReview.track];
  return findAbstractionPlace ? findAbstractionPlace(finding, codeUnderReview) : NO_PLACE;
};

const findTheSecondPlace = (finding, codeUnderReview) => (codeUnderReview.track === TRACKS.DESIGN ? findTheRelationSecondPlace(finding, codeUnderReview) : NO_PLACE);

const holdsThePlace = (places, place) => places.some(listedPlace => buildFileAndLineKey(listedPlace.file, listedPlace.line) === buildFileAndLineKey(place.file, place.line));

const addTheSecondPlace = (alsoAt, place) => (place && !holdsThePlace(alsoAt, place) ? [...alsoAt, place] : alsoAt);

const placeTheFinding = (finding, codeUnderReview) => {
  const abstractionPlace = findTheAbstractionPlace(finding, codeUnderReview);
  const second = findTheSecondPlace(finding, codeUnderReview);
  if (!abstractionPlace && !second) return finding;
  return {
    ...finding,
    ...(abstractionPlace ? { abstractionPlace } : {}),
    ...(second ? { alsoAt: addTheSecondPlace(finding.alsoAt || [], second) } : {}),
  };
};

export function placeTheFindingsByTheirCodeUnderReview(findings, everyCodeUnderReview = []) {
  const codeUnderReviewByIdMap = new Map(everyCodeUnderReview.map(codeUnderReview => [codeUnderReview.id, codeUnderReview]));
  return findings.map(finding => {
    const codeUnderReview = codeUnderReviewByIdMap.get(finding.codeUnderReviewId);
    return codeUnderReview ? placeTheFinding(finding, codeUnderReview) : finding;
  });
}
