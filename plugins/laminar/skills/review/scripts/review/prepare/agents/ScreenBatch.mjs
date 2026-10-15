import { NO_CHANGED_LINES_TEXT } from "../formats/ChangedLinesText.mjs";
import { listPlacesShownInSections, readSliceSections } from "../formats/SliceFormat.mjs";
import { CALLING_METHODS_SECTION, FIELD_TYPE_HEADS, MODULE_BOUNDARY_FACT_SECTIONS } from "../abstractions/slices/CodeSlice.mjs";
import { isACoreOperation, isAnInOutOperation } from "../relations/DesignRelationCodeUnderReview.mjs";

export const ABSTRACTIONS_PER_SCREEN_BATCH = 12;

export const holdsAScreenedCheck = codeUnderReview => !codeUnderReview.isTest
  && (codeUnderReview.checks || []).some(check => (check.fields || []).length > 0);

const SLICE_SECTIONS_THE_SCREEN_SKIPS = new Set(["calledBodies", FIELD_TYPE_HEADS, ...Object.values(MODULE_BOUNDARY_FACT_SECTIONS)]);

const isACallingMethodInsideOneApplication = section => section.section === CALLING_METHODS_SECTION && !section.joinsAnotherApplication;

const findScreenedSections = codeUnderReview => readSliceSections(codeUnderReview)
  .filter(section => !SLICE_SECTIONS_THE_SCREEN_SKIPS.has(section.section) && !isACallingMethodInsideOneApplication(section))
  .map(({ section, lines }) => ({ section, lines }));

const createScreenAbstraction = (codeUnderReview, changedLines) => {
  const sections = findScreenedSections(codeUnderReview);
  return {
    abstractionId: codeUnderReview.abstractionId,
    displayName: codeUnderReview.displayName,
    scale: codeUnderReview.scale,
    path: codeUnderReview.path,
    changedLines: changedLines.formatListedLines(codeUnderReview.path, listPlacesShownInSections(codeUnderReview.path, sections)),
    slice: sections,
    ...(isACoreOperation(codeUnderReview) ? { coreOperation: true } : {}),
    ...(isAnInOutOperation(codeUnderReview) ? { inOutOperation: true } : {}),
  };
};

export function buildScreenBatches(everyCodeUnderReview, changedLines = NO_CHANGED_LINES_TEXT) {
  const screenAbstractionByIdMap = new Map();
  for (const codeUnderReview of everyCodeUnderReview) {
    if (!holdsAScreenedCheck(codeUnderReview)) continue;
    if (!screenAbstractionByIdMap.has(codeUnderReview.abstractionId)) screenAbstractionByIdMap.set(codeUnderReview.abstractionId, createScreenAbstraction(codeUnderReview, changedLines));
  }
  const screenAbstractions = [...screenAbstractionByIdMap.values()];
  const batches = [];
  for (let start = 0; start < screenAbstractions.length; start += ABSTRACTIONS_PER_SCREEN_BATCH) {
    batches.push({ id: `B${batches.length + 1}`, abstractions: screenAbstractions.slice(start, start + ABSTRACTIONS_PER_SCREEN_BATCH) });
  }
  return batches;
}
