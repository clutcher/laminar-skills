import fs from "node:fs";
import path from "node:path";
import { chooseRepositoryToRead, findDeployableRoots, Scale } from "../../code/index.mjs";
import { ChangedLinesText } from "./formats/ChangedLinesText.mjs";
import { resolveAbsolutePath } from "../../files/paths.mjs";
import { AbstractionTreeWalk } from "./selection/AbstractionTreeWalk.mjs";
import { CHECK_NAMES, GATE_KINDS, SCREEN_FIELDS_BY_CHECK_MAP, TRACKS } from "../../checks/CheckCatalog.mjs";
import { listChecks, findJudgedComments, findDecisionPlaces, IO_PATHS_CHECKS, TEST_PLAN_CHECKS, listTracks } from "./selection/TrackSelection.mjs";
import { holdsAScreenedCheck, buildScreenBatches } from "./agents/ScreenBatch.mjs";
import { DESIGN_JUDGE_TYPES, readJudgeType } from "../../checks/JudgeType.mjs";
import { formatCodeUnderReviewText } from "./formats/CodeUnderReviewText.mjs";
import { fitsOnOnePage, formatPlaceListLines, formatPlaceListText, readAtListLinesOf, readAtListTextOf } from "./formats/ListFileText.mjs";
import { selectSectionsReadByTheChecks } from "./selection/SectionsByCheck.mjs";
import { readSliceSections } from "./formats/SliceFormat.mjs";
import { buildTestPlans } from "./relations/TestPlanCodeUnderReview.mjs";
import { IO_UNKNOWN_FILE, formatIoPathsText, formatIoSummaryText } from "./io/IoReachText.mjs";
import { buildIoPaths } from "./io/IoPaths.mjs";
import { buildDesignCodeUnderReview, isADesignCodeUnderReview } from "./relations/DesignRelationCodeUnderReview.mjs";
import { formatDesignRelationText } from "./relations/DesignRelationText.mjs";
import { buildEntryBoundaryCodeUnderReview, isAnEntryBoundaryCodeUnderReview } from "./relations/EntryBoundaryCodeUnderReview.mjs";
import { formatEntryBoundaryText } from "./relations/EntryBoundaryText.mjs";
import { buildBoundaryPathCodeUnderReview, isABoundaryPathCodeUnderReview } from "./relations/BoundaryPathCodeUnderReview.mjs";
import { formatBoundaryPathText } from "./relations/BoundaryPathText.mjs";
import { IoRuleCache, createRuleKey } from "./io/IoRuleCache.mjs";
import { buildIoSummary } from "./io/IoSummary.mjs";
import { COST_PLAN_FILE, formatCostPlanLine, FULL_COST_PLAN_FILE, buildCostPlan, estimateCostTotals, collectModuleRoots, SCALES_OF_THE_SCALES_RUN } from "./agents/CostPlan.mjs";
import { NO_FILTER } from "./selection/ReviewFilter.mjs";
import { isAnIoPathsCodeUnderReview, buildJudgeWaves } from "./agents/JudgeWaves.mjs";
import { createPropertyWhenNotEmpty, writeJsonFile } from "../../files/jsonFile.mjs";
import { formatChangedTestListLines, formatChangedTestListText, formatTestListLines, formatTestListText, formatTestNameListLines, formatTestNameListText, formatTestPlanText, holdsTheChangedTestsInline, holdsTheTestNamesInline } from "./relations/TestPlanText.mjs";
import { buildScriptFindings, isAnApplicationWithNoTestRunner } from "./settled/ScriptFindings.mjs";
import { createCodeUnderReviewId } from "./formats/CodeUnderReviewIds.mjs";

export const TEST_PLAN_SLICE_LINES = 1000;

export const REVIEW_ABSTRACTIONS_FILE = "review-abstractions.json";

const CODE_UNDER_REVIEW_FOLDER = "code-under-review";
const RETURNS_FOLDER = "returns";
const IO_SUMMARY_FILE = "io-summary.md";

const WRITTEN_AGAIN_ON_EVERY_RUN = Object.freeze([CODE_UNDER_REVIEW_FOLDER, "screen-batches", IO_SUMMARY_FILE, IO_UNKNOWN_FILE, COST_PLAN_FILE, FULL_COST_PLAN_FILE]);

const countBytes = text => Buffer.byteLength(text);

const THE_ID = "{id}";
const THE_JUDGE_TYPE = "{judgeType}";
const FILE_FORM = `${CODE_UNDER_REVIEW_FOLDER}/${THE_ID}-${THE_JUDGE_TYPE}.md`;

const formatFilePath = codeUnderReview => FILE_FORM.replace(THE_ID, codeUnderReview.id).replace(THE_JUDGE_TYPE, codeUnderReview.judgeType);

const formatPlaceListFile = codeUnderReview => formatFilePath(codeUnderReview).replace(/\.md$/, "-places.md");

const formatChangedTestListFile = codeUnderReview => formatFilePath(codeUnderReview).replace(/\.md$/, "-tests-in-change.md");

const formatTestListFile = codeUnderReview => formatFilePath(codeUnderReview).replace(/\.md$/, "-tests.md");

const formatTestNameListFile = codeUnderReview => formatFilePath(codeUnderReview).replace(/\.md$/, "-test-names.md");

const readAtListFileOf = codeUnderReview => formatFilePath(codeUnderReview).replace(/\.md$/, "-read-at.md");

const ABSTRACTION_ID_PATTERN = /^A(\d+)$/;

const readNumber = id => Number(String(id).replace(/^[A-Z]+/, ""));

const collectScreenedAbstractionIds = screenBatches => new Set(screenBatches.flatMap(batch => batch.abstractions.map(abstraction => abstraction.abstractionId)));

const readAbstractionField = (abstractionId, screened) => {
  if (ABSTRACTION_ID_PATTERN.test(abstractionId)) return readNumber(abstractionId);
  return screened.has(abstractionId) ? abstractionId : 0;
};

const findOrAddIndex = (list, keyOf) => given => {
  const key = keyOf(given);
  const at = list.findIndex(listedValue => keyOf(listedValue) === key);
  if (at >= 0) return at;
  list.push(given);
  return list.length - 1;
};

const gatesTheSameWay = check => check.fields.join(" ") === (SCREEN_FIELDS_BY_CHECK_MAP[check.id] || []).join(" ");

const buildScreenGate = codeUnderReview => Object.fromEntries((codeUnderReview.checks || []).filter(check => !gatesTheSameWay(check)).map(check => [check.id, check.fields]));

const buildScreenGateField = codeUnderReview => (holdsAScreenedCheck(codeUnderReview) ? [buildScreenGate(codeUnderReview)] : []);

export function compactCodeUnderReview(everyCodeUnderReview, screenBatches) {
  const screened = collectScreenedAbstractionIds(screenBatches);
  const judgeTypes = [];
  const checkSets = [];
  const judgeTypeAt = findOrAddIndex(judgeTypes, judgeType => judgeType);
  const checkSetAt = findOrAddIndex(checkSets, checks => checks.join(" "));
  const everyCompactCodeUnderReview = everyCodeUnderReview.map(codeUnderReview => [
    readNumber(codeUnderReview.id),
    readAbstractionField(codeUnderReview.abstractionId, screened),
    judgeTypeAt(codeUnderReview.judgeType),
    checkSetAt(codeUnderReview.checks.map(check => check.id)),
    ...buildScreenGateField(codeUnderReview),
  ]);
  return { judgeTypes, checkSets, list: everyCompactCodeUnderReview };
}

export const compactIoPaths = everyIoPathsCodeUnderReview => everyIoPathsCodeUnderReview.map(ioPathsJudgeCall => [readNumber(ioPathsJudgeCall.id), readNumber(ioPathsJudgeCall.end.id), ioPathsJudgeCall.calls.length]);

export const compactScreenBatches = screenBatches => screenBatches.map(batch => batch.abstractions.length);

const TRACKS_READING_NAMES = new Set([TRACKS.SIMPLICITY, TRACKS.TEST_METHOD]);

const readsNames = track => TRACKS_READING_NAMES.has(track);

const readScreenFields = (check, abstraction) => !abstraction.isTest && check.gate.kind === GATE_KINDS.SCREEN ? check.gate.fields : [];

const createCodeUnderReview = (abstraction, track, checks, number) => ({
  id: createCodeUnderReviewId(number),
  abstractionId: abstraction.id,
  displayName: abstraction.displayName,
  name: abstraction.name,
  enclosing: abstraction.enclosingTypeName || "",
  usedIn: abstraction.usedIn || "",
  scale: abstraction.scale,
  ...(abstraction.kind ? { kind: abstraction.kind } : {}),
  changeKind: abstraction.changeKind,
  path: abstraction.path,
  lines: abstraction.lines,
  ...(abstraction.fields ? { fields: abstraction.fields } : {}),
  isTest: abstraction.isTest,
  boundaryRank: abstraction.boundaryRank,
  track,
  judgeType: readJudgeType({ track, scale: abstraction.scale }),
  checks: checks.map(check => ({ id: check.id, name: check.name, fields: readScreenFields(check, abstraction) })),
  comments: track === TRACKS.COMMENT ? findJudgedComments(abstraction) : [],
  openConstructs: abstraction.openConstructs || null,
  ...((abstraction.callArgumentFunctions || []).length ? { callArgumentFunctions: abstraction.callArgumentFunctions } : {}),
  ...((abstraction.callArgumentCalls || []).length ? { callArgumentCalls: abstraction.callArgumentCalls } : {}),
  facts: abstraction.facts,
  testFriction: abstraction.testFriction || [],
  namedDeclarations: readsNames(track) ? abstraction.namedDeclarations || null : null,
  outsideDeclaration: readsNames(track) ? abstraction.outsideDeclaration || null : null,
  sameDecisionAt: track === TRACKS.DECISION ? findDecisionPlaces(abstraction) : [],
  homeModule: track === TRACKS.DECISION ? abstraction.homeModule : null,
  searchScope: track === TRACKS.DECISION ? abstraction.searchScope || null : null,
  slice: abstraction.slice,
});

const createTestPlanCodeUnderReview = (plan, number) => ({
  id: createCodeUnderReviewId(number),
  abstractionId: `application:${plan.application.key}`,
  displayName: plan.application.key,
  name: plan.application.key,
  scale: Scale.APPLICATION.name,
  track: TRACKS.TEST_PLAN,
  judgeType: readJudgeType({ track: TRACKS.TEST_PLAN, scale: Scale.APPLICATION.name }),
  checks: TEST_PLAN_CHECKS.map(check => ({ id: check.id, name: check.name, fields: [] })),
  isTest: false,
  path: plan.application.root,
  lines: null,
  slice: null,
  ...plan,
});

const createIoPathsCodeUnderReview = (ioPathsJudgeCall, number) => ({
  id: createCodeUnderReviewId(number),
  abstractionId: `io-paths:${ioPathsJudgeCall.end.path}:${ioPathsJudgeCall.end.from}`,
  displayName: ioPathsJudgeCall.end.method,
  name: ioPathsJudgeCall.end.method,
  scale: Scale.METHOD.name,
  track: TRACKS.IO_PATHS,
  judgeType: readJudgeType({ track: TRACKS.IO_PATHS, scale: Scale.METHOD.name }),
  checks: IO_PATHS_CHECKS.map(check => ({ id: check.id, name: check.name, fields: [] })),
  isTest: false,
  path: ioPathsJudgeCall.end.path,
  lines: { from: ioPathsJudgeCall.end.from, to: ioPathsJudgeCall.end.to },
  slice: null,
  ...ioPathsJudgeCall,
});

const isATestPlan = codeUnderReview => codeUnderReview.track === TRACKS.TEST_PLAN;

const TRACKS_WITH_CODE_OF_THEIR_OWN = new Set([TRACKS.COMMENT, TRACKS.DECISION]);

const MODULE_ROOT_SECTION = "moduleRoot";

const showsNothing = abstraction => !readSliceSections(abstraction).some(section => section.section !== MODULE_ROOT_SECTION)
  && !((abstraction.namedDeclarations || {}).declarations || []).length
  && !((abstraction.outsideDeclaration || {}).lines || []).length;

const readsOnlyTheSlice = ({ track }) => !TRACKS_WITH_CODE_OF_THEIR_OWN.has(track);

const keepTracksWithSomethingToShow = ({ abstraction, tracks }) => ({ abstraction, tracks: showsNothing(abstraction) ? tracks.filter(track => !readsOnlyTheSlice(track)) : tracks });

const keepTracksWithNothingToShow = ({ abstraction, tracks }) => ({ abstraction, tracks: showsNothing(abstraction) ? tracks.filter(readsOnlyTheSlice) : [] });

const holdsATrack = ({ tracks }) => tracks.length > 0;

const formatCheckNames = tracks => [...new Set(tracks.flatMap(({ checks }) => checks).map(check => `${check.id} ${check.name}`))].join(", ");

const createNothingToShowNote = ({ abstraction, tracks }) => ({
  reason: `${formatCheckNames(tracks)} not scheduled, because the code under review of the abstraction below would show no line and no listed entry`,
  classes: [{ name: abstraction.name, path: abstraction.path }],
});

export class PrepareStep {
  constructor(extracted, { ruleCache = new IoRuleCache(), filter = NO_FILTER, ioCachedRules } = {}) {
    this.extracted = extracted;
    this.ruleCache = ruleCache;
    this.filter = filter;
    this.givenIoCachedRules = ioCachedRules;
    this.walk = new AbstractionTreeWalk(extracted.abstractions);
    this.changedLines = new ChangedLinesText(extracted.changedLines);
    this.codeUnderReview = [];
    this.withNothingToShow = [];
    this.scriptFindings = [];
  }

  run() {
    this.codeUnderReview = [];
    this.scriptFindings = buildScriptFindings(this.walk.listEveryAbstraction().filter(abstraction => this.filter.keepsPath(abstraction.path)), this.extracted.changedLines || {}, {
      selectedAbstractions: this.walk.collectSelectedAbstractions().filter(abstraction => this.filter.keepsPath(abstraction.path)),
      applications: this.walk.findApplicationsWithChangedCode(abstraction => this.filter.keepsPath(abstraction.path)),
      keepsJudgeType: judgeType => this.filter.keepsJudgeType(judgeType),
      keepsScale: scale => this.filter.keepsScale(scale),
    });
    const selected = this.findJudgedAbstractions();
    this.withNothingToShow = selected.map(keepTracksWithNothingToShow).filter(holdsATrack);
    const judged = selected.map(keepTracksWithSomethingToShow).filter(holdsATrack);
    const keeps = abstraction => this.filter.keepsPath(abstraction.path);
    let number = 1;
    for (const { abstraction, tracks } of judged) {
      for (const { track, checks } of tracks) this.codeUnderReview.push(createCodeUnderReview(abstraction, track, checks, number++));
    }
    const boundaries = this.keepsSystemTrack(TRACKS.TEST_PLAN) && this.filter.keepsScale(Scale.APPLICATION.name) ? this.walk.findBoundariesOwingATest().filter(({ abstraction, application }) => keeps(abstraction) && !isAnApplicationWithNoTestRunner(application)) : [];
    for (const plan of buildTestPlans(boundaries, TEST_PLAN_SLICE_LINES)) {
      this.codeUnderReview.push(createTestPlanCodeUnderReview(plan, number++));
    }
    this.ioRuleKey = createRuleKey(this.extracted.dependencies);
    this.ioCachedRules = this.givenIoCachedRules === undefined ? this.ruleCache.read(this.ioRuleKey) : this.givenIoCachedRules;
    const ioChainAbstractions = this.keepsSystemTrack(TRACKS.IO_PATHS) && this.filter.keepsScale(Scale.METHOD.name) ? this.walk.findIoChainAbstractions().filter(({ abstraction }) => keeps(abstraction)) : [];
    this.io = buildIoPaths(ioChainAbstractions, { rules: this.ioCachedRules });
    this.ioSummary = this.io.needsAnIoRuleScreenCall ? buildIoSummary(this.io.ends, this.extracted.dependencies) : null;
    for (const ioPathsJudgeCall of this.io.judgeCalls) this.codeUnderReview.push(createIoPathsCodeUnderReview(ioPathsJudgeCall, number++));
    if (DESIGN_JUDGE_TYPES.some(judgeType => this.filter.keepsJudgeType(judgeType))) {
      const designCodeUnderReview = buildDesignCodeUnderReview(this.extracted, { keeps: given => this.filter.keepsPath(given), keepsJudgeType: judgeType => this.filter.keepsJudgeType(judgeType), keepsScale: scale => this.filter.keepsScale(scale), firstNumber: number });
      this.codeUnderReview.push(...designCodeUnderReview);
      number += designCodeUnderReview.length;
    }
    this.entryBoundaries = buildEntryBoundaryCodeUnderReview(this.extracted, { keeps: given => this.filter.keepsPath(given), keepsScale: scale => this.filter.keepsScale(scale), firstNumber: number, judged: this.keepsSystemTrack(TRACKS.ENTRY_BOUNDARY) });
    this.codeUnderReview.push(...this.entryBoundaries.judgeCalls);
    number += this.entryBoundaries.judgeCalls.length;
    const selectedIds = new Set(this.walk.collectSelectedAbstractions().map(abstraction => abstraction.id));
    this.boundaryPaths = buildBoundaryPathCodeUnderReview(this.extracted, { keeps: given => this.filter.keepsPath(given), keepsScale: scale => this.filter.keepsScale(scale), selectedIds, firstNumber: number, judged: this.keepsSystemTrack(TRACKS.BOUNDARY) });
    this.codeUnderReview.push(...this.boundaryPaths.judgeCalls);
    this.screenBatches = buildScreenBatches(this.codeUnderReview, this.changedLines);
    this.waves = buildJudgeWaves(this.codeUnderReview, this.screenBatches, { ioRuleScreenCall: Boolean(this.ioSummary) });
    return this;
  }

  findJudgedAbstractions() {
    return this.walk.collectSelectedAbstractions()
      .filter(abstraction => this.filter.keepsPath(abstraction.path) && this.filter.keepsScale(abstraction.scale))
      .map(abstraction => ({ abstraction, tracks: this.findKeptTracks(abstraction) }))
      .filter(({ tracks }) => tracks.length);
  }

  findKeptTracks(abstraction) {
    return listTracks(abstraction)
      .map(track => ({ track, checks: listChecks(abstraction, track) }))
      .filter(({ track, checks }) => checks.length && this.filter.keepsJudgeType(readJudgeType({ track, scale: abstraction.scale })));
  }

  isLeftOutByThePaths(abstraction) {
    return abstraction.scale === Scale.MODULE.name
      && this.filter.keepsScale(abstraction.scale)
      && !this.filter.keepsPath(abstraction.path)
      && this.filter.namesAPathInside(abstraction.path)
      && this.findKeptTracks(abstraction).length > 0;
  }

  buildTheModulesLeftOutByThePaths() {
    const leftOutCount = this.walk.collectSelectedAbstractions().filter(abstraction => this.isLeftOutByThePaths(abstraction)).length;
    return leftOutCount ? { leftOutByThePaths: { [Scale.MODULE.name]: leftOutCount } } : {};
  }

  keepsSystemTrack(track) {
    return this.filter.keepsJudgeType(readJudgeType({ track, scale: Scale.APPLICATION.name }));
  }

  measureScreens() {
    const repositoryRoot = this.readRepositoryRoot();
    return {
      presence: this.screenBatches.map(batch => countBytes(JSON.stringify(batch, null, 1))),
      ioRules: this.ioSummary ? [countBytes(formatIoSummaryText(this.ioSummary, { repositoryRoot }))] : [],
    };
  }

  estimateScalesRun() {
    if (this.filter.keepsOnlyScalesAmong(SCALES_OF_THE_SCALES_RUN)) return null;
    const narrowed = new PrepareStep(this.extracted, { ruleCache: this.ruleCache, filter: this.filter.copyWithScales(SCALES_OF_THE_SCALES_RUN), ioCachedRules: this.ioCachedRules }).run();
    return { scales: SCALES_OF_THE_SCALES_RUN, ...estimateCostTotals(narrowed.codeUnderReview, narrowed.measureScreens()) };
  }

  createCostPlan() {
    return buildCostPlan({
      codeUnderReview: this.codeUnderReview,
      screens: this.measureScreens(),
      moduleRoots: collectModuleRoots(this.extracted.abstractions),
      filter: this.filter.convertToFields(),
      scalesRun: this.estimateScalesRun(),
      waves: this.waves.length,
    });
  }

  countByTrack() {
    const counts = Object.fromEntries(Object.keys(TRACKS).map(track => [track, 0]));
    for (const codeUnderReview of this.codeUnderReview) counts[codeUnderReview.track]++;
    return counts;
  }

  countByJudgeType() {
    const counts = {};
    for (const codeUnderReview of this.codeUnderReview) counts[codeUnderReview.judgeType] = (counts[codeUnderReview.judgeType] || 0) + 1;
    return counts;
  }

  listNotAnswered() {
    return this.withNothingToShow.map(createNothingToShowNote);
  }

  buildCounts() {
    return {
      codeUnderReview: this.codeUnderReview.length,
      checks: this.codeUnderReview.reduce((total, codeUnderReview) => total + codeUnderReview.checks.length, 0),
      byTrack: this.countByTrack(),
      byJudgeType: this.countByJudgeType(),
      screenBatches: this.screenBatches.length,
      endCalls: this.io.ends.reduce((total, end) => total + end.calls.length, 0),
      ioRuleScreenCalls: this.io.needsAnIoRuleScreenCall ? 1 : 0,
      ioEndMethods: this.io.judgeCalls.length,
      waves: this.waves.length,
    };
  }

  writeScreenBatches(runFolder) {
    const folder = path.join(runFolder, "screen-batches");
    fs.mkdirSync(folder, { recursive: true });
    this.screenBatches.forEach((batch, index) =>
      fs.writeFileSync(path.join(folder, `${index + 1}.json`), JSON.stringify(batch, null, 1)));
  }

  buildIoRuleScreenCall() {
    return this.ioSummary ? { file: IO_SUMMARY_FILE, groups: this.ioSummary.groupCount, endCalls: this.ioSummary.endCalls } : null;
  }

  writeIoSummary(runFolder) {
    if (this.ioSummary) fs.writeFileSync(path.join(runFolder, IO_SUMMARY_FILE), formatIoSummaryText(this.ioSummary, { repositoryRoot: this.readRepositoryRoot() }));
  }

  listIoPathsJudgeCalls() {
    return this.codeUnderReview.filter(isAnIoPathsCodeUnderReview).map(codeUnderReview => ({ id: codeUnderReview.id, endMethod: codeUnderReview.end.id, endCalls: codeUnderReview.calls.map(call => call.id) }));
  }

  readRepositoryRoot() {
    return chooseRepositoryToRead(this.extracted.mode, this.extracted.target) || "";
  }

  listApplicationRoots() {
    return findDeployableRoots(this.readRepositoryRoot());
  }

  writeTestPlan(runFolder, plan) {
    const changedTestListFile = resolveAbsolutePath(path.join(runFolder, formatChangedTestListFile(plan)));
    const testListFile = resolveAbsolutePath(path.join(runFolder, formatTestListFile(plan)));
    const testNameListFile = resolveAbsolutePath(path.join(runFolder, formatTestNameListFile(plan)));
    if (formatChangedTestListLines(plan).length && !holdsTheChangedTestsInline(plan)) fs.writeFileSync(changedTestListFile, formatChangedTestListText(plan));
    if (formatTestListLines(plan).length) fs.writeFileSync(testListFile, formatTestListText(plan));
    if (formatTestNameListLines(plan).length && !holdsTheTestNamesInline(plan)) fs.writeFileSync(testNameListFile, formatTestNameListText(plan));
    fs.writeFileSync(path.join(runFolder, formatFilePath(plan)), formatTestPlanText(plan, { repositoryRoot: this.readRepositoryRoot(), changedTestListFile, testListFile, testNameListFile, changedLines: this.changedLines }));
  }

  writeAbstraction(runFolder, codeUnderReview) {
    const placeListFile = resolveAbsolutePath(path.join(runFolder, formatPlaceListFile(codeUnderReview)));
    const readAtListFile = resolveAbsolutePath(path.join(runFolder, readAtListFileOf(codeUnderReview)));
    const applicationRoots = this.listApplicationRoots();
    const placeListLines = formatPlaceListLines(codeUnderReview, { applicationRoots });
    if (placeListLines.length && !fitsOnOnePage(placeListLines)) fs.writeFileSync(placeListFile, formatPlaceListText(codeUnderReview, { applicationRoots }));
    if (readAtListLinesOf(codeUnderReview).length) fs.writeFileSync(readAtListFile, readAtListTextOf(codeUnderReview));
    fs.writeFileSync(path.join(runFolder, formatFilePath(codeUnderReview)), formatCodeUnderReviewText(selectSectionsReadByTheChecks(codeUnderReview), { repositoryRoot: this.readRepositoryRoot(), placeListFile, readAtListFile, applicationRoots, changedLines: this.changedLines }));
  }

  writeCodeUnderReview(runFolder) {
    fs.mkdirSync(path.join(runFolder, CODE_UNDER_REVIEW_FOLDER), { recursive: true });
    for (const codeUnderReview of this.codeUnderReview) {
      if (isATestPlan(codeUnderReview)) this.writeTestPlan(runFolder, codeUnderReview);
      else if (isAnIoPathsCodeUnderReview(codeUnderReview)) fs.writeFileSync(path.join(runFolder, formatFilePath(codeUnderReview)), formatIoPathsText(codeUnderReview, { repositoryRoot: this.readRepositoryRoot(), changedLines: this.changedLines }));
      else if (isADesignCodeUnderReview(codeUnderReview)) fs.writeFileSync(path.join(runFolder, formatFilePath(codeUnderReview)), formatDesignRelationText(codeUnderReview, { repositoryRoot: this.readRepositoryRoot(), changedLines: this.changedLines }));
      else if (isAnEntryBoundaryCodeUnderReview(codeUnderReview)) fs.writeFileSync(path.join(runFolder, formatFilePath(codeUnderReview)), formatEntryBoundaryText(codeUnderReview, { repositoryRoot: this.readRepositoryRoot(), changedLines: this.changedLines }));
      else if (isABoundaryPathCodeUnderReview(codeUnderReview)) fs.writeFileSync(path.join(runFolder, formatFilePath(codeUnderReview)), formatBoundaryPathText(codeUnderReview, { repositoryRoot: this.readRepositoryRoot(), changedLines: this.changedLines }));
      else this.writeAbstraction(runFolder, codeUnderReview);
    }
  }

  clearEarlierOutput(runFolder) {
    for (const written of WRITTEN_AGAIN_ON_EVERY_RUN) fs.rmSync(path.join(runFolder, written), { recursive: true, force: true });
  }

  createFullCostPlan() {
    return new PrepareStep(this.extracted, { ruleCache: this.ruleCache, ioCachedRules: this.ioCachedRules }).run().createCostPlan();
  }

  writeCostPlan(runFolder) {
    const plan = this.createCostPlan();
    fs.writeFileSync(path.join(runFolder, COST_PLAN_FILE), JSON.stringify(plan, null, 1));
    if (plan.filter) fs.writeFileSync(path.join(runFolder, FULL_COST_PLAN_FILE), JSON.stringify(this.createFullCostPlan(), null, 1));
    return formatCostPlanLine(plan);
  }

  buildPreparedFields() {
    return {
      mode: this.extracted.mode,
      target: this.extracted.target || "",
      filter: this.filter.convertToFields(),
      counts: this.buildCounts(),
      notAnswered: this.listNotAnswered(),
      codeUnderReview: this.codeUnderReview,
      screenBatches: this.screenBatches.map((batch, index) => ({ id: batch.id, file: `screen-batches/${index + 1}.json`, abstractions: batch.abstractions.length })),
      gate: SCREEN_FIELDS_BY_CHECK_MAP,
      checkNames: CHECK_NAMES,
      ioRuleScreenCall: this.buildIoRuleScreenCall(),
      ioCachedRules: this.ioCachedRules,
      ioGroups: this.io.groups,
      ioPaths: this.listIoPathsJudgeCalls(),
      ioRuleKey: this.ioRuleKey,
      ioEnds: this.io.ends,
      entryBoundaries: this.entryBoundaries.counts,
      boundaryPaths: this.boundaryPaths.counts,
      waves: this.waves,
      ...this.buildTheModulesLeftOutByThePaths(),
    };
  }

  writeTo(runFolder) {
    this.clearEarlierOutput(runFolder);
    fs.mkdirSync(path.join(runFolder, RETURNS_FOLDER), { recursive: true });
    this.writeScreenBatches(runFolder);
    this.writeIoSummary(runFolder);
    this.writeCodeUnderReview(runFolder);
    const costPlanLine = this.writeCostPlan(runFolder);
    writeJsonFile(path.join(runFolder, "prepare.json"), { ...this.buildPreparedFields(), ...createPropertyWhenNotEmpty("scriptFindings", this.scriptFindings) });
    return costPlanLine;
  }

  buildPreparedReturn(costPlanLine) {
    return {
      ...this.buildPreparedFields(),
      costPlan: costPlanLine,
      fileForm: FILE_FORM,
      codeUnderReview: compactCodeUnderReview(this.codeUnderReview, this.screenBatches),
      screenBatches: compactScreenBatches(this.screenBatches),
      ioPaths: compactIoPaths(this.codeUnderReview.filter(isAnIoPathsCodeUnderReview)),
    };
  }
}
