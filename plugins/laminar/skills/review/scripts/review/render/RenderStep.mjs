import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VerifyReturns } from "./verdicts/VerifyReturns.mjs";
import { addTheFindingsToTheSweep, formatSweepWords } from "../merge/draft/Sweep.mjs";
import { SettledFindings } from "./verdicts/SettledFindings.mjs";
import { TestCoveredPaths } from "./verdicts/TestCoveredPaths.mjs";
import { buildReaderReport } from "./reports/ReaderReport.mjs";
import { buildEvidenceReport } from "./reports/EvidenceReport.mjs";
import { buildSarifReport } from "./reports/SarifReport.mjs";
import { formatChangeSummary } from "./sections/ChangeSummary.mjs";
import { findAcrossApplicationsCounts, formatAcrossApplicationsLine, formatScopeLine, buildScope } from "./sections/ScopeLine.mjs";
import { EXISTING_CODE } from "./sections/ItemText.mjs";
import { resolveAbsolutePath } from "../../files/paths.mjs";
import { CHANGE_MODES } from "../../code/index.mjs";
import { COST_PLAN_FILE, FULL_COST_PLAN_FILE } from "../prepare/agents/CostPlan.mjs";
import { REVIEW_ABSTRACTIONS_FILE } from "../prepare/PrepareStep.mjs";
import { IO_UNKNOWN_FILE } from "../prepare/io/IoReachText.mjs";
import { readJsonFile, readJsonFileIfPresent } from "../../files/jsonFile.mjs";

const PLUGIN_MANIFEST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", ".claude-plugin", "plugin.json");

const readVersionOfThePlugin = () => {
  try { return JSON.parse(fs.readFileSync(PLUGIN_MANIFEST, "utf8")).version; }
  catch { return "unknown"; }
};

const numberThePossibleFindings = groups => {
  let number = 0;
  return (groups || []).map(group => ({
    ...group,
    possibleFindings: group.possibleFindings.map(finding => {
      number += 1;
      return finding.number ? finding : { ...finding, number };
    }),
  }));
};

const isAPatchReview = reviewed => String(reviewed.mode || "").toUpperCase() === CHANGE_MODES.PATCH;

const formatTargetLine = reviewed => `${isAPatchReview(reviewed) ? "patch" : "repository"} mode, ${reviewed.modeReason || "no reason recorded"}`;

const formatRepairedWord = repaired => repaired.length ? `, ${repaired.length} repaired from the numbering of the code under review` : "";

const formatReusedJudgeCallsWord = counts => (counts || {}).cachedJudgeCalls ? `, ${counts.cachedJudgeCalls} of ${counts.judgeCalls} judge call(s) reused from saved judge returns` : "";

const formatLinesNotInTheCodeWord = counts => (counts || {}).linesNotInTheCode ? `, ${counts.linesNotInTheCode} named line(s) not in the code` : "";

export class RenderStep {
  constructor(runFolder, verdictsFiles) {
    this.runFolder = runFolder;
    this.reviewed = readJsonFile(path.join(runFolder, REVIEW_ABSTRACTIONS_FILE));
    this.prepared = readJsonFile(path.join(runFolder, "prepare.json"));
    this.acrossApplications = findAcrossApplicationsCounts(this.prepared);
    this.merged = readJsonFile(path.join(runFolder, "merge.json"));
    this.returns = VerifyReturns.readFrom(verdictsFiles);
  }

  run() {
    this.covered = new TestCoveredPaths(this.merged.coveredPaths, this.returns, { mode: this.prepared.mode });
    this.settled = new SettledFindings([...numberThePossibleFindings(this.merged.groups), ...this.covered.pathsToTest], this.returns, this.covered.listNumbers(), this.prepared.codeUnderReview || [], (this.prepared.filter || {}).scales || []);
    this.scope = buildScope(this.prepared, readJsonFileIfPresent(path.join(this.runFolder, COST_PLAN_FILE), null), readJsonFileIfPresent(path.join(this.runFolder, FULL_COST_PLAN_FILE), null), this.settled.countLeftOutByScale());
    this.sweep = addTheFindingsToTheSweep(this.merged.sweep, this.covered.pathsToTest.flatMap(group => group.possibleFindings));
    this.changeSummary = formatChangeSummary(this.reviewed);
    this.banner = this.formatBanner();
    return this;
  }

  formatBanner() {
    const counts = this.reviewed.counts || {};
    const prepared = this.prepared.counts || {};
    const sweep = this.sweep;
    const confidence = this.settled.countByConfidence();
    return `**Run** · ${formatTargetLine(this.reviewed)} · ${counts.files || 0} file(s), ${counts.abstractions || 0} abstraction(s) · ${prepared.codeUnderReview || 0} abstraction(s) under review${formatReusedJudgeCallsWord(this.merged.counts)}, ${formatSweepWords(sweep)} · findings: ${this.settled.kept.length} kept (${confidence.high} high, ${confidence.moderate} moderate, ${confidence.low} low), ${this.settled.considered.length} to consider (${this.settled.countConsideredInExistingCode()} in ${EXISTING_CODE}), ${this.settled.rejected.length} rejected, ${this.settled.notVerified.length} not verified, ${(this.merged.dropped || []).length} dropped by the line check${formatLinesNotInTheCodeWord(this.merged.counts)}${formatRepairedWord(this.merged.repaired || [])} · run folder: ${resolveAbsolutePath(this.runFolder)}`;
  }

  readIo() {
    return {
      ends: this.prepared.ioEnds || [],
      ioScreen: this.merged.ioScreen || null,
      cachedRules: this.prepared.ioCachedRules || null,
      unknownFile: `${resolveAbsolutePath(this.runFolder)}/${IO_UNKNOWN_FILE}`,
      onlyThePatch: isAPatchReview(this.reviewed),
    };
  }

  writeTo() {
    const version = readVersionOfThePlugin();
    const shared = {
      banner: this.banner,
      scopeLine: formatScopeLine(this.scope),
      acrossApplicationsLine: formatAcrossApplicationsLine(this.acrossApplications),
      changeSummary: this.changeSummary,
      settled: this.settled,
      covered: this.covered.keptCoveredPaths,
      rejectedCoveredPaths: this.covered.rejectedCoveredPaths,
      dropped: this.merged.dropped || [],
      excluded: this.reviewed.excluded || [],
    };
    const files = {
      "review.md": buildReaderReport({ ...shared, leftOutFiles: this.reviewed.leftOutFiles || [] }),
      "review-evidence.md": buildEvidenceReport({ ...shared, sweep: this.sweep, notAnswered: this.prepared.notAnswered || [], leftOutFiles: this.reviewed.leftOutFiles || [], io: this.readIo() }),
      "review.sarif": buildSarifReport(this.settled.kept, version, this.scope, this.acrossApplications, this.settled.considered),
    };
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(this.runFolder, name), text);
    return {
      banner: this.banner,
      version,
      review: `${resolveAbsolutePath(this.runFolder)}/review.md`,
      reviewEvidence: `${resolveAbsolutePath(this.runFolder)}/review-evidence.md`,
      reviewSarif: `${resolveAbsolutePath(this.runFolder)}/review.sarif`,
      counts: {
        kept: this.settled.kept.length,
        items: this.settled.items.length,
        considered: this.settled.considered.length,
        considerations: this.settled.considerations.length,
        rejected: this.settled.rejected.length,
        notVerified: this.settled.notVerified.length,
        unmatchedVerdicts: this.settled.unmatchedVerdicts.length,
      },
    };
  }
}
