#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { ChangeReader, CODE_GRAPH_FILE, ReviewWorktree, sweepUnusedReviewWorktreesBeside, WorktreeStop, findHeadOfRevisions, ExtractOutput, ExtractStep } from "./code/index.mjs";
import { PrepareStep, REVIEW_ABSTRACTIONS_FILE } from "./review/prepare/PrepareStep.mjs";
import { CodeGraphWalks } from "./review/prepare/abstractions/CodeGraphWalks.mjs";
import { FilterStop, ReviewFilter } from "./review/prepare/selection/ReviewFilter.mjs";
import { MergeStep } from "./review/merge/MergeStep.mjs";
import { formatSweepWords } from "./review/merge/draft/Sweep.mjs";
import { RenderStep } from "./review/render/RenderStep.mjs";
import { resolveAbsolutePath } from "./files/paths.mjs";
import { readJsonFile, writeJsonFile } from "./files/jsonFile.mjs";
import { writeWorkflowReturnFile } from "./files/workflowReturnFile.mjs";
import { RunFileStop } from "./files/runFile.mjs";

const SUBCOMMANDS = ["extract", "prepare", "merge", "render"];

const USAGE = "usage: runReview.mjs <extract|prepare|merge|render> --run <folder> [--repo <path> --range <a>..<b> | --repo <path> --files <list> | --diff <patch>] [--kind-base <revision>] [--exclude <list>] [--judges <type,...>] [--paths <prefix,...>] [--scales <scale,...>] [--findings <file>[,<file>...]] [--verdicts <file>[,<file>...]]";

const PREPARE_RETURN_FILE = "prepare-return.json";

const MERGE_RETURN_FILE = "merge-return.json";

const PREPARE_RETURN_WORKFLOW_FILE = "prepare-return.workflow.js";

const MERGE_RETURN_WORKFLOW_FILE = "merge-return.workflow.js";

const PREPARE_RETURN_META = { name: "prepare-return", description: "The prepare return of 1 run" };

const MERGE_RETURN_META = { name: "merge-return", description: "The merge return of 1 run" };

const splitList = given => String(given || "").split(",").map(piece => piece.trim()).filter(Boolean);

function parseArguments(argv) {
  const parsed = { files: [], exclude: [], judges: [], paths: [], scales: [], findings: [], verdicts: [] };
  for (let index = 0; index < argv.length; index++) {
    const name = argv[index];
    if (name === "--run") parsed.run = argv[++index];
    else if (name === "--repo") parsed.repo = argv[++index];
    else if (name === "--range") parsed.revisions = argv[++index];
    else if (name === "--kind-base") parsed.kindBase = argv[++index];
    else if (name === "--diff") parsed.diff = argv[++index];
    else if (name === "--findings") parsed.findings.push(...splitList(argv[++index]));
    else if (name === "--verdicts") parsed.verdicts.push(...splitList(argv[++index]));
    else if (name === "--exclude") parsed.exclude = splitList(argv[++index]);
    else if (name === "--judges") parsed.judges = splitList(argv[++index]);
    else if (name === "--paths") parsed.paths = splitList(argv[++index]);
    else if (name === "--scales") parsed.scales = splitList(argv[++index]);
    else if (name === "--files") { while (index + 1 < argv.length && !argv[index + 1].startsWith("--")) parsed.files.push(argv[++index]); }
    else { console.error(`unknown argument ${name}`); process.exit(2); }
  }
  return parsed;
}

const printResult = result => console.log(`RESULT ${JSON.stringify(result)}`);

function runOrStopOnAWorktreeStop(run) {
  try {
    return run();
  } catch (error) {
    if (!(error instanceof WorktreeStop)) throw error;
    console.error(`extract: ${error.message}`);
    return process.exit(2);
  }
}

const buildTheKindRevisions = (kindBase, revisions) => {
  const head = findHeadOfRevisions(revisions);
  return head ? `${kindBase}..${head}` : kindBase;
};

function readChangeOfRevisions(repository, parsed) {
  const head = findHeadOfRevisions(parsed.revisions);
  const headTree = head ? runOrStopOnAWorktreeStop(() => {
    const worktree = new ReviewWorktree(repository, head);
    sweepUnusedReviewWorktreesBeside(worktree);
    return worktree.prepareAtTheHead();
  }) : null;
  const change = ChangeReader.createFromRevisions(repository, parsed.revisions, parsed.files, parsed.exclude, headTree);
  const kindChange = parsed.kindBase ? ChangeReader.createFromRevisions(repository, buildTheKindRevisions(parsed.kindBase, parsed.revisions), parsed.files, parsed.exclude, headTree) : null;
  return { change, kindChange };
}

function readChangeOfOneSide(parsed, repository) {
  if (parsed.kindBase) { console.error("extract: --kind-base needs --range"); process.exit(2); }
  if (parsed.diff) return ChangeReader.createFromPatch(parsed.diff, repository, parsed.exclude);
  if (parsed.files.length) return ChangeReader.createFromNamedFiles(repository, parsed.files, parsed.exclude);
  console.error(USAGE);
  return process.exit(2);
}

function readChange(parsed) {
  const repository = parsed.repo ? resolveAbsolutePath(parsed.repo) : null;
  if (!repository && !parsed.diff) { console.error(USAGE); process.exit(2); }
  if (parsed.revisions && !parsed.diff) return readChangeOfRevisions(repository, parsed);
  return { change: readChangeOfOneSide(parsed, repository), kindChange: null };
}

function printTheExtractSummary(runFolder, written, indexUse, filesWithNoLanguageDriver) {
  console.log(`run folder: ${resolveAbsolutePath(runFolder)}`);
  const byScale = Object.entries(written.counts.byScale).map(([scale, count]) => `${scale} ${count}`).join(", ");
  console.log(`extract: mode ${written.mode} because ${written.modeReason}, ${written.counts.files} file(s), ${written.counts.hunks} hunk(s), ${written.counts.abstractions} abstraction(s) (${byScale}), ${written.counts.trivialHunks} trivial hunk(s), ${written.counts.droppedAsTrivial} file(s) dropped as trivial, ${written.counts.noLanguageDriver} file(s) with no language driver, ${written.counts.buildFiles} build file(s) left out, written to ${CODE_GRAPH_FILE}`);
  if (filesWithNoLanguageDriver.length) console.log(`extract: no language driver reads ${filesWithNoLanguageDriver.join(", ")}`);
  if (indexUse) console.log(`extract: search index read from the cache for ${indexUse.read.length} language famil${indexUse.read.length === 1 ? "y" : "ies"} and built for ${indexUse.built.length}, cache folder ${indexUse.folder}`);
}

function extract(parsed) {
  const { change, kindChange } = readChange(parsed);
  const step = new ExtractStep(change, { kindBase: parsed.kindBase || null, kindChange });
  const tree = step.run();
  const written = new ExtractOutput(step, tree).writeAndSummarize(parsed.run);
  printTheExtractSummary(parsed.run, written, step.cachedSourceIndex.readIndexUse(), step.listFilesWithNoLanguageDriver());
  printResult({ step: "extract", runFolder: resolveAbsolutePath(parsed.run), mode: written.mode, counts: written.counts });
}

function filterOrStop(parsed) {
  try {
    return new ReviewFilter({ judges: parsed.judges, paths: parsed.paths, scales: parsed.scales });
  } catch (error) {
    if (!(error instanceof FilterStop)) throw error;
    console.error(`prepare: ${error.message}`);
    return process.exit(2);
  }
}

function printThePrepareSummary(runFolder, written) {
  console.log(`run folder: ${resolveAbsolutePath(runFolder)}`);
  const byTrack = Object.entries(written.counts.byTrack).map(([track, count]) => `${track} ${count}`).join(", ");
  console.log(`prepare: ${written.counts.codeUnderReview} abstraction(s) under review (${byTrack}), ${written.counts.checks} check(s), ${written.counts.screenBatches} screen batch(es), ${written.counts.endCalls} end call(s), ${written.counts.ioRuleScreenCalls} I/O rule screen call(s), ${written.counts.ioEndMethods} I/O end method(s), ${written.counts.codeUnderReview} file(s) written to code-under-review/, written to ${REVIEW_ABSTRACTIONS_FILE}, prepare.json, ${PREPARE_RETURN_FILE} and ${PREPARE_RETURN_WORKFLOW_FILE}`);
  console.log(`prepare: ${written.costPlan}, written to cost-plan.json`);
  for (const note of written.notAnswered) {
    console.log(`prepare: ${note.reason}`);
    for (const type of note.classes) console.log(`prepare: - ${type.name}, ${type.path}`);
  }
}

const prepareReturnOf = (runFolder, written) => ({
  step: "prepare",
  runFolder: resolveAbsolutePath(runFolder),
  mode: written.mode,
  counts: written.counts,
  costPlan: written.costPlan,
  notAnswered: written.notAnswered,
  screenBatches: written.screenBatches,
  fileForm: written.fileForm,
  codeUnderReview: written.codeUnderReview,
  gate: written.gate,
  checkNames: written.checkNames,
  ioRuleScreenCall: written.ioRuleScreenCall,
  ioCachedRules: written.ioCachedRules,
  ioGroups: written.ioGroups,
  ioPaths: written.ioPaths,
  waves: written.waves,
});

function prepare(parsed) {
  const filter = filterOrStop(parsed);
  const walked = new CodeGraphWalks(readJsonFile(path.join(parsed.run, CODE_GRAPH_FILE))).walkEveryAbstraction();
  const reviewAbstractions = walked.buildReviewAbstractions();
  writeJsonFile(path.join(parsed.run, REVIEW_ABSTRACTIONS_FILE), reviewAbstractions);
  const step = new PrepareStep(reviewAbstractions, { filter }).run();
  const costPlanLine = step.writeTo(parsed.run);
  const written = step.buildPreparedReturn(costPlanLine);
  printThePrepareSummary(parsed.run, written);
  const returned = prepareReturnOf(parsed.run, written);
  writeJsonFile(path.join(parsed.run, PREPARE_RETURN_FILE), returned);
  writeWorkflowReturnFile(path.join(parsed.run, PREPARE_RETURN_WORKFLOW_FILE), PREPARE_RETURN_META, returned);
  printResult(returned);
}

function merge(parsed) {
  if (!parsed.findings.length) { console.error(USAGE); process.exit(2); }
  const written = new MergeStep(parsed.run, parsed.findings).run().writeTo();
  console.log(`merge: ${written.counts.possibleFindings} possible finding(s), ${written.counts.dropped} dropped by the line check, ${written.counts.refiled} re-filed under the check their decision names, ${written.counts.filedUnderAnotherCheck} dropped as filed under a check their call did not answer, ${written.counts.linesNotInTheCode} named line(s) not in the code, ${written.counts.items} item(s) in the draft, ${formatSweepWords(written.sweep)}, written to merge.json and draft.md`);
  console.log(`merge: ${written.counts.refuterCalls} refuter call(s), ${written.counts.excludedFromRefutation} possible finding(s) left out of the refuter, ${written.counts.verifyWaves} verify wave(s), written to refute/, verify/, ${MERGE_RETURN_FILE} and ${MERGE_RETURN_WORKFLOW_FILE}`);
  const returned = { step: "merge", runFolder: resolveAbsolutePath(parsed.run), counts: written.counts, draft: written.draft, draftLines: written.draftLines, verify: written.verify };
  writeJsonFile(path.join(parsed.run, MERGE_RETURN_FILE), returned);
  writeWorkflowReturnFile(path.join(parsed.run, MERGE_RETURN_WORKFLOW_FILE), MERGE_RETURN_META, returned);
  printResult(returned);
}

function render(parsed) {
  if (!parsed.verdicts.length) { console.error(USAGE); process.exit(2); }
  const written = new RenderStep(parsed.run, parsed.verdicts).run().writeTo();
  console.log(written.banner);
  console.log(`render: review.md, review-evidence.md and review.sarif written to ${resolveAbsolutePath(parsed.run)}`);
  printResult({ step: "render", runFolder: resolveAbsolutePath(parsed.run), banner: written.banner, counts: written.counts, review: written.review, reviewEvidence: written.reviewEvidence, reviewSarif: written.reviewSarif });
}

const STEPS = { extract, prepare, merge, render };

function runOrStop(subcommand, parsed) {
  try {
    STEPS[subcommand](parsed);
  } catch (error) {
    if (!(error instanceof RunFileStop)) throw error;
    console.error(`${subcommand}: ${error.message}`);
    process.exit(2);
  }
}

function runReview() {
  const [subcommand, ...rest] = process.argv.slice(2);
  if (!SUBCOMMANDS.includes(subcommand)) { console.error(USAGE); process.exit(2); }
  const parsed = parseArguments(rest);
  if (!parsed.run) { console.error(USAGE); process.exit(2); }
  fs.mkdirSync(parsed.run, { recursive: true });
  runOrStop(subcommand, parsed);
}

runReview();
