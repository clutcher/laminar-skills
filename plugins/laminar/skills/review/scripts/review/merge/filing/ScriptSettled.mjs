import { Scale } from "../../../code/index.mjs";
import { SCRIPT_JUDGE_TYPE } from "../../prepare/settled/ScriptFindings.mjs";
import { listPlacesShownInSections, readSliceSections } from "../../prepare/formats/SliceFormat.mjs";
import { stripLeadingDotSlash } from "../abstractions/AbstractionsAtPlaces.mjs";

const THE_SCRIPT_VERDICT = Object.freeze({ decision: "keep", confidence: "high", settledBy: "script" });

export const isSettledByTheScript = group => Boolean(group.verdict && group.verdict.settledBy === THE_SCRIPT_VERDICT.settledBy);

const isRaisedByTheScript = possibleFinding => possibleFinding.scriptRaised === true;

export const applyTheScriptVerdict = groups => groups.map(group => (group.possibleFindings.every(isRaisedByTheScript) ? { ...group, verdict: THE_SCRIPT_VERDICT } : group));

const readFolderOfAFile = filePath => stripLeadingDotSlash(filePath).split("/").slice(0, -1).join("/");

const listFilesShownInTheSlice = codeUnderReview => listPlacesShownInSections(codeUnderReview.path, readSliceSections(codeUnderReview)).map(place => stripLeadingDotSlash(place.file));

const readFirstNamedFile = finding => stripLeadingDotSlash(((finding.evidence || [])[0] || {}).file);

const buildPlaceKey = (abstractionId, judgeType, check, file, line) => `${abstractionId}|${judgeType}|${check}|${stripLeadingDotSlash(file)}:${Number(line)}`;

const listPlaceKeysTheScriptSettled = codeUnderReview => listPlacesShownInSections(codeUnderReview.path, readSliceSections(codeUnderReview))
  .flatMap(place => codeUnderReview.checks.map(check => buildPlaceKey(codeUnderReview.abstractionId, codeUnderReview.standsInFor, check.id, place.file, place.line)));

const listEvidencePlaces = finding => (finding.evidence || []).flatMap(named => (named.lines || []).map(line => ({ file: named.file, line })));

const isOnAModuleTheScriptSettled = (finding, judged, settledFiles) => {
  if (judged.scale !== Scale.MODULE.name) return false;
  const firstNamedFile = readFirstNamedFile(finding);
  return settledFiles.has(firstNamedFile) && readFolderOfAFile(firstNamedFile) === stripLeadingDotSlash(judged.path);
};

const namesAPlaceTheScriptSettled = (finding, judged, settledPlaceKeys) => listEvidencePlaces(finding)
  .some(place => settledPlaceKeys.has(buildPlaceKey(judged.abstractionId, judged.judgeType, finding.check, place.file, place.line)));

export function splitJudgeFindingsTheScriptSettled(findings, everyCodeUnderReview = []) {
  const settledByTheScript = everyCodeUnderReview.filter(codeUnderReview => codeUnderReview.judgeType === SCRIPT_JUDGE_TYPE);
  const settledFiles = new Set(settledByTheScript.filter(codeUnderReview => codeUnderReview.scale === Scale.MODULE.name).flatMap(listFilesShownInTheSlice));
  const settledPlaceKeys = new Set(settledByTheScript.filter(codeUnderReview => codeUnderReview.scale !== Scale.MODULE.name).flatMap(listPlaceKeysTheScriptSettled));
  const codeUnderReviewByIdMap = new Map(everyCodeUnderReview.map(codeUnderReview => [codeUnderReview.id, codeUnderReview]));
  const isSettled = finding => {
    const judged = codeUnderReviewByIdMap.get(finding.codeUnderReviewId);
    if (!judged || judged.judgeType === SCRIPT_JUDGE_TYPE || finding.scriptRaised) return false;
    return isOnAModuleTheScriptSettled(finding, judged, settledFiles) || namesAPlaceTheScriptSettled(finding, judged, settledPlaceKeys);
  };
  return { kept: findings.filter(finding => !isSettled(finding)), folded: findings.filter(isSettled) };
}
