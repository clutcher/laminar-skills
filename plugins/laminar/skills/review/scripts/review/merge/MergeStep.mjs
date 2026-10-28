import fs from "node:fs";
import path from "node:path";
import { isPlacedByItsAbstractionPlace, markTheFindingsInTheChange, PossibleFindings } from "./returns/PossibleFindings.mjs";
import { IoRuleCache } from "../prepare/io/IoRuleCache.mjs";
import { SliceLines } from "./lines/SliceLines.mjs";
import { checkFindings } from "./lines/LineCheck.mjs";
import { splitFindingsByFiledCheck } from "./filing/FiledCheck.mjs";
import { CodeUnderReviewPlaces } from "./abstractions/CodeUnderReviewPlaces.mjs";
import { buildFixGroups } from "./draft/FixGroup.mjs";
import { EntryBoundaryMarker } from "./draft/EntryBoundaryMarker.mjs";
import { CodeFormMarker } from "./draft/CodeFormMarker.mjs";
import { buildDraftItems } from "./draft/DraftItem.mjs";
import { readCheckRules } from "../../checks/CheckText.mjs";
import { buildSweep } from "./draft/Sweep.mjs";
import { buildCoveredPathsDraft, numberCoveredPathsAfter, buildDraftLinesOfCoveredPath } from "./draft/CoveredPath.mjs";
import { buildDraftReport } from "./draft/DraftReport.mjs";
import { resolveAbsolutePath } from "../../files/paths.mjs";
import { readApplicationName, findDeployableFolder, findDeployableRoots } from "../../code/index.mjs";
import { writeJsonFile } from "../../files/jsonFile.mjs";
import { buildDraftLinesText } from "./draft/DraftLinesText.mjs";
import { applyTheConfidenceCeilings, listMatchingKeyPlaces } from "./filing/ConfidenceCeilings.mjs";
import { markTheConsiderations } from "./filing/Considerations.mjs";
import { placeTheFindingsByTheirCodeUnderReview } from "./abstractions/AbstractionOfTheCodeUnderReview.mjs";
import { isSettledByTheScript, splitJudgeFindingsTheScriptSettled, applyTheScriptVerdict } from "./filing/ScriptSettled.mjs";
import { IoScreenResultWriter } from "./IoScreenResultWriter.mjs";
import { splitSetFindingsFoldedIntoAUse } from "./filing/FallbackUseFold.mjs";
import { VerifyHandOff } from "./verify/VerifyHandOff.mjs";

const DRAFT_FILE = "draft.md";
const DRAFT_LINES_FILE = "draft-lines.md";

const countLinesNotInTheCode = kept => kept.reduce((total, finding) => total + (finding.linesNotInTheCode || []).length, 0);

const buildItemDraftLines = item => ({ id: item.id, number: item.number, displayName: item.displayName, checks: item.checks, consideredChecks: item.consideredChecks, judgeType: item.judgeType, inChange: item.inChange, changedQuotedLines: item.changedQuotedLines, changedLines: item.changedLines, changedLinesByFileMap: item.changedLinesByFileMap, quotedLines: item.quotedLines, belongingAnswers: item.belongingAnswers, ...(item.callers ? { callers: item.callers } : {}) });

const groupChecksRaisedByJudgeType = items => items.filter(item => item.judgeType).reduce((raised, item) => {
  raised[item.judgeType] = [...(raised[item.judgeType] || []), item.check, ...(item.checks || [])];
  return raised;
}, {});

const buildRulesByJudgeType = ruled => Object.fromEntries(Object.entries(groupChecksRaisedByJudgeType(ruled))
  .map(([judgeType, checks]) => [judgeType, readCheckRules(judgeType, checks)]));

const addTheApplication = (place, possibleFinding, roots) => {
  const application = readApplicationName(place.file, roots);
  if (!application) return place;
  const inItsOwnApplication = findDeployableFolder(place.file, roots) === findDeployableFolder(possibleFinding.file || "", roots);
  return { ...place, application, ...(inItsOwnApplication ? { inItsOwnApplication } : {}) };
};

const addTheApplicationsOfItsPlaces = (possibleFinding, roots) => possibleFinding.alsoAt
  ? { ...possibleFinding, alsoAt: possibleFinding.alsoAt.map(place => addTheApplication(place, possibleFinding, roots)) }
  : possibleFinding;

export const addTheApplicationsOfTheirPlaces = (groups, roots) => groups
  .map(group => ({ ...group, possibleFindings: group.possibleFindings.map(possibleFinding => addTheApplicationsOfItsPlaces(possibleFinding, roots)) }));

const numberThePossibleFindingsOfTheDraft = groups => {
  let number = 0;
  return groups.map(group => (isSettledByTheScript(group)
    ? group
    : { ...group, possibleFindings: group.possibleFindings.map(possibleFinding => ({ ...possibleFinding, number: ++number })) }));
};

const findTheLastPossibleFindingNumber = groups => groups
  .flatMap(group => group.possibleFindings)
  .reduce((last, possibleFinding) => Math.max(last, Number.isInteger(possibleFinding.number) ? possibleFinding.number : 0), 0);

export class MergeStep {
  constructor(runFolder, findingsFile, { ruleCache = new IoRuleCache() } = {}) {
    this.runFolder = runFolder;
    this.ruleCache = ruleCache;
    this.possibleFindingSource = new PossibleFindings(runFolder, { findings: findingsFile });
    this.preparedRun = this.possibleFindingSource.preparedRun;
    this.sliceLines = new SliceLines(runFolder, this.preparedRun.prepared);
    this.codeUnderReviewPlaces = new CodeUnderReviewPlaces(runFolder, this.preparedRun.prepared.codeUnderReview);
  }

  run() {
    const codeUnderReview = this.preparedRun.prepared.codeUnderReview || [];
    const keptAndFoldedJudgeFindings = splitJudgeFindingsTheScriptSettled(this.possibleFindingSource.judgeReturn.listFindings(), codeUnderReview);
    this.foldedIntoTheScript = keptAndFoldedJudgeFindings.folded;
    const keptAndFoldedSetFindings = splitSetFindingsFoldedIntoAUse(keptAndFoldedJudgeFindings.kept, codeUnderReview);
    this.foldedIntoAUse = keptAndFoldedSetFindings.folded;
    const placedFindings = placeTheFindingsByTheirCodeUnderReview(keptAndFoldedSetFindings.kept, codeUnderReview);
    const markedFindings = markTheFindingsInTheChange([...placedFindings, ...this.preparedRun.scriptFindings], this.preparedRun.changedLines, codeUnderReview, this.preparedRun.publicChangeKinds);
    const runFacts = { mode: this.preparedRun.prepared.mode, applicationRoots: this.listApplicationRoots() };
    const findingsWithTheirConsiderations = markTheConsiderations(markedFindings, codeUnderReview, runFacts);
    const findingsWithinTheirCeilings = applyTheConfidenceCeilings(findingsWithTheirConsiderations, codeUnderReview, runFacts);
    const findingsSplitByFiledCheck = splitFindingsByFiledCheck(findingsWithinTheirCeilings, { codeUnderReview, notRun: this.possibleFindingSource.judgeReturn.listNotRunChecks() });
    this.refiled = findingsSplitByFiledCheck.refiled;
    this.filedUnderAnotherCheck = findingsSplitByFiledCheck.underAnotherCheck;
    const checked = checkFindings(this.possibleFindingSource.buildThePossibleFindings(findingsSplitByFiledCheck.kept), this.sliceLines, this.codeUnderReviewPlaces);
    const covered = checkFindings(this.possibleFindingSource.listCoveredPaths(), this.sliceLines, this.codeUnderReviewPlaces);
    this.possibleFindings = checked.kept.map(possibleFinding => this.repairTheAbstractionPlace(possibleFinding));
    this.dropped = [...checked.dropped, ...covered.dropped];
    this.repaired = [...checked.repaired, ...covered.repaired];
    const grouped = buildFixGroups(this.possibleFindings, { applicationOf: this.createApplicationLookup(), matchingKeyPlacesOf: this.createMatchingKeyPlacesLookup(codeUnderReview) });
    const marked = new CodeFormMarker(this.preparedRun.codeForms).markGroups(new EntryBoundaryMarker(this.preparedRun.entryBoundaries).markGroups(addTheApplicationsOfTheirPlaces(grouped, this.listApplicationRoots())));
    this.groups = numberThePossibleFindingsOfTheDraft(applyTheScriptVerdict(marked));
    this.coveredPaths = numberCoveredPathsAfter(findTheLastPossibleFindingNumber(this.groups), covered.kept.map(possibleFinding => this.repairTheAbstractionPlace(possibleFinding)));
    this.items = buildDraftItems(this.findGroupsToVerify(), this.sliceLines, this.preparedRun.changedLines);
    this.verifyHandOff = new VerifyHandOff(this.runFolder, { groups: this.groups, items: this.items, coveredPaths: this.coveredPaths, everyCodeUnderReview: codeUnderReview });
    this.sweep = buildSweep(this.preparedRun.prepared.codeUnderReview || [], this.possibleFindingSource.judgeReturn.listNotRunChecks(), this.possibleFindings);
    this.ioScreen = this.possibleFindingSource.judgeReturn.readIoScreen();
    this.ioScreenOutcome = new IoScreenResultWriter(this.runFolder, this.preparedRun, this.ioScreen, this.ruleCache);
    return this;
  }

  findGroupsToVerify() {
    return this.groups.filter(group => !isSettledByTheScript(group));
  }

  createMatchingKeyPlacesLookup(codeUnderReview) {
    const matchingKeyPlacesByIdMap = new Map(codeUnderReview.map(each => [each.id, listMatchingKeyPlaces(each)]));
    return codeUnderReviewId => matchingKeyPlacesByIdMap.get(codeUnderReviewId) || [];
  }

  listApplicationRoots() {
    return findDeployableRoots(this.preparedRun.repository);
  }

  createApplicationLookup() {
    const roots = this.listApplicationRoots();
    return file => findDeployableFolder(file, roots) || "";
  }

  repairTheAbstractionPlace(possibleFinding) {
    return isPlacedByItsAbstractionPlace(possibleFinding) ? this.possibleFindingSource.addTheAbstractionPlace(possibleFinding) : possibleFinding;
  }

  buildCounts() {
    return {
      possibleFindings: this.possibleFindings.length,
      dropped: this.dropped.length,
      refiled: this.refiled.length,
      filedUnderAnotherCheck: this.filedUnderAnotherCheck.length,
      linesNotInTheCode: countLinesNotInTheCode(this.possibleFindings),
      repaired: this.repaired.length,
      items: this.items.length,
      coveredPaths: this.coveredPaths.length,
      failed: this.sweep.failed,
      ...this.verifyHandOff.buildCounts(),
    };
  }

  buildDraftLines() {
    return {
      mode: this.preparedRun.prepared.mode || "",
      target: this.preparedRun.prepared.target || "",
      rules: buildRulesByJudgeType([...this.items, ...this.coveredPaths]),
      items: this.items.map(buildItemDraftLines),
      coveredPaths: this.coveredPaths.map(covered => buildDraftLinesOfCoveredPath(covered, this.sliceLines)),
    };
  }

  writeTo() {
    this.ioScreenOutcome.keepTheRulesInTheCache();
    const draftLines = this.buildDraftLines();
    const written = {
      counts: this.buildCounts(),
      sweep: this.sweep,
      dropped: this.dropped,
      refiled: this.refiled,
      ...(this.foldedIntoTheScript.length ? { foldedIntoTheScript: this.foldedIntoTheScript } : {}),
      ...(this.foldedIntoAUse.length ? { foldedIntoAUse: this.foldedIntoAUse } : {}),
      filedUnderAnotherCheck: this.filedUnderAnotherCheck,
      repaired: this.repaired,
      groups: this.groups,
      items: this.items,
      coveredPaths: this.coveredPaths,
      ioScreen: this.ioScreen,
      draftLines,
    };
    writeJsonFile(path.join(this.runFolder, "merge.json"), written);
    this.ioScreenOutcome.writeTheUnknownEndMethods();
    const draftFile = `${resolveAbsolutePath(this.runFolder)}/${DRAFT_FILE}`;
    const draftLinesFile = `${resolveAbsolutePath(this.runFolder)}/${DRAFT_LINES_FILE}`;
    const draftText = `${buildDraftReport(this.findGroupsToVerify())}${buildCoveredPathsDraft(this.coveredPaths)}`;
    fs.writeFileSync(path.join(this.runFolder, DRAFT_FILE), draftText);
    fs.writeFileSync(path.join(this.runFolder, DRAFT_LINES_FILE), buildDraftLinesText(draftLines, { draftText, draftLinesFile }));
    const verify = this.verifyHandOff.writeTo();
    return { ...written, draft: draftFile, draftLines: draftLinesFile, verify };
  }
}
