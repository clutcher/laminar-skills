import fs from "node:fs";
import os from "node:os";
import { Scale } from "../../../code/index.mjs";
import { readFolderPath } from "../../../files/paths.mjs";
import { findAgentFile } from "../../../checks/CheckText.mjs";
import { getOrReadAndRemember } from "../../../collections/memos.mjs";

export const COST_PLAN_FILE = "cost-plan.json";

export const FULL_COST_PLAN_FILE = "cost-plan-full.json";

export const THRESHOLD = Object.freeze({ judgeCalls: 500, newTokens: 2_000_000 });

export const AVERAGES_MEASURED = "new tokens, output tokens and cache reads per agent call from the review runs of 2026-10-12 to 2026-10-17, the mean of the runs on fictional code and the runs on a real repository; wall seconds per judge call from earlier measured runs; possible findings per judge call from a run of the eval suite, whose every case holds a defect, so the refuter and verifier calls are an upper estimate";

export const DOLLARS_LEAVE_OUT = "the session that runs the review, the calls started again, a model or effort given to the workflow call, and the uncached input, which is counted at the cache write price";

export const DOLLARS_PER_MILLION_TOKENS_BY_MODEL_MAP = Object.freeze({
  opus: Object.freeze({ model: "claude-opus-5-5", input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 }),
  sonnet: Object.freeze({ model: "claude-sonnet-5-5", input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 }),
  haiku: Object.freeze({ model: "claude-haiku-5-5", input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 }),
});

const MEASURED_BY_JUDGE_TYPE_MAP = Object.freeze({
  "judge-simplicity-variable": { newTokens: 3_450, outputTokens: 420, cacheReadTokens: 12_760, wallSeconds: 8 },
  "judge-simplicity-method": { newTokens: 3_460, outputTokens: 470, cacheReadTokens: 21_130, wallSeconds: 6 },
  "judge-simplicity-class": { newTokens: 4_620, outputTokens: 560, cacheReadTokens: 21_190, wallSeconds: 9 },
  "judge-simplicity-module": { newTokens: 4_390, outputTokens: 400, cacheReadTokens: 21_130, wallSeconds: 7 },
  "judge-simplicity-decision": { newTokens: 4_260, outputTokens: 470, cacheReadTokens: 22_110, wallSeconds: 9 },
  "judge-simplicity-comment": { newTokens: 4_150, outputTokens: 380, cacheReadTokens: 10_490, wallSeconds: 6 },
  "judge-correctness-prevention": { newTokens: 4_420, outputTokens: 440, cacheReadTokens: 17_100, wallSeconds: 7 },
  "judge-correctness-validate-at-the-boundary": { newTokens: 4_270, outputTokens: 320, cacheReadTokens: 11_230, wallSeconds: 7 },
  "judge-correctness-simplicity-test-method": { newTokens: 5_000, outputTokens: 450, cacheReadTokens: 16_450, wallSeconds: 8 },
  "judge-correctness-test-plan": { newTokens: 32_790, outputTokens: 3_790, cacheReadTokens: 68_000, wallSeconds: 17 },
  "judge-performance-abstraction": { newTokens: 3_900, outputTokens: 280, cacheReadTokens: 11_570, wallSeconds: 5 },
  "judge-performance-io-paths": { newTokens: 5_860, outputTokens: 730, cacheReadTokens: 17_360, wallSeconds: 5 },
  "judge-design-over-extraction": { newTokens: 9_050, outputTokens: 700, cacheReadTokens: 11_000, wallSeconds: 9 },
  "judge-design-scoped-parameters": { newTokens: 9_190, outputTokens: 890, cacheReadTokens: 11_750, wallSeconds: 9 },
  "judge-design-leaked-details": { newTokens: 5_190, outputTokens: 380, cacheReadTokens: 14_100, wallSeconds: 9 },
  "judge-design-entry-boundary": { newTokens: 6_540, outputTokens: 750, cacheReadTokens: 14_670, wallSeconds: 9 },
  "judge-design-missing-boundary": { newTokens: 6_480, outputTokens: 740, cacheReadTokens: 15_410, wallSeconds: 9 },
});

export const FALLBACK_JUDGE_TYPE = "judge-correctness-prevention";

export const SCREEN_FIT = Object.freeze({ newTokensAtZeroBytes: 5_369, newTokensPerKilobyte: 578, outputShare: 0.1, cacheReadTokens: 9_500, wallSeconds: 18 });

export const SCREEN_ROLE_BY_KIND_MAP = Object.freeze({ presence: "screen-presence", ioRules: "screen-io" });

export const REFUTER_EFFORT = "medium";

export const REFUTER_FIT = Object.freeze({ newTokens: 8_320, outputTokens: 730, cacheReadTokens: 11_030, wallSeconds: 45, effort: REFUTER_EFFORT });

export const VERIFIER_CALL_FIT = Object.freeze({ newTokens: 9_660, outputTokens: 950, cacheReadTokens: 18_740, wallSeconds: 60 });

export const REFUTED_SHARE = 0.25;

export const EXCLUDED_FROM_REFUTATION = Object.freeze(["judge-correctness-test-plan", "judge-performance-io-paths"]);

export const COVERED_PATHS_PER_TEST_PLAN_CALL = 2.2;

export const POSSIBLE_FINDINGS_PER_JUDGE_CALL_OF_ALL_TYPES = 0.354;

export const POSSIBLE_FINDINGS_PER_JUDGE_CALL_BY_JUDGE_TYPE = Object.freeze({
  "judge-simplicity-variable": 0.652,
  "judge-simplicity-method": 0.452,
  "judge-simplicity-class": 0.426,
  "judge-simplicity-module": 0.191,
  "judge-simplicity-decision": 0.194,
  "judge-correctness-prevention": 0.22,
  "judge-correctness-simplicity-test-method": 0.542,
  "judge-performance-abstraction": 0.111,
  "judge-design-leaked-details": 0.6,
});

export const SCREEN_EMPTIED_SHARE_BY_JUDGE_TYPE_MAP = Object.freeze({
  "judge-correctness-prevention": 0.302,
  "judge-performance-abstraction": 0.841,
});

export const MAX_CONCURRENT_AGENT_CALLS = 16;

export const CPUS_LEFT_FREE = 2;

export const CONCURRENT_AGENT_CALLS_SETTING = "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS";

export function readConcurrentAgentCalls(environment = process.env, cpuCount = os.cpus().length) {
  const setting = Number.parseInt(environment[CONCURRENT_AGENT_CALLS_SETTING], 10);
  if (setting > 0) return setting;
  return Math.max(1, Math.min(MAX_CONCURRENT_AGENT_CALLS, cpuCount - CPUS_LEFT_FREE));
}

export const SCALES_OF_THE_SCALES_RUN = Object.freeze([Scale.APPLICATION.name, Scale.MODULE.name, Scale.CLASS.name]);

const FOLDER_SEGMENTS = 2;

const MODEL_LINE_PATTERN = /^model:\s*(\S+)\s*$/m;

const modelByRoleMemo = new Map();

const readModelOfTheAgentFile = role => {
  const model = (MODEL_LINE_PATTERN.exec(fs.readFileSync(findAgentFile(role), "utf8")) || [])[1];
  if (!DOLLARS_PER_MILLION_TOKENS_BY_MODEL_MAP[model]) throw new Error(`no price is known for model "${model}" of the agent ${role}; add it to DOLLARS_PER_MILLION_TOKENS_BY_MODEL_MAP`);
  return model;
};

export const readModelOfTheRole = role => getOrReadAndRemember(modelByRoleMemo, role, () => readModelOfTheAgentFile(role));

export const estimateDollarsOfACall = (role, call) => {
  const prices = DOLLARS_PER_MILLION_TOKENS_BY_MODEL_MAP[readModelOfTheRole(role)];
  const writtenTokens = call.newTokens - call.outputTokens;
  return (writtenTokens * prices.cacheWrite + call.outputTokens * prices.output + call.cacheReadTokens * prices.cacheRead) / 1_000_000;
};

const readJudgeRole = judgeType => (MEASURED_BY_JUDGE_TYPE_MAP[judgeType] ? judgeType : FALLBACK_JUDGE_TYPE);

const readMeasured = judgeType => MEASURED_BY_JUDGE_TYPE_MAP[readJudgeRole(judgeType)];

const readNewTokens = judgeType => readMeasured(judgeType).newTokens;

const readWallSeconds = judgeType => readMeasured(judgeType).wallSeconds;

const readDollars = judgeType => estimateDollarsOfACall(readJudgeRole(judgeType), readMeasured(judgeType));

const readRefuterCallsPerJudgeCall = judgeType => {
  if (judgeType === "judge-correctness-test-plan") return COVERED_PATHS_PER_TEST_PLAN_CALL;
  if (EXCLUDED_FROM_REFUTATION.includes(judgeType)) return 0;
  return POSSIBLE_FINDINGS_PER_JUDGE_CALL_BY_JUDGE_TYPE[judgeType] ?? POSSIBLE_FINDINGS_PER_JUDGE_CALL_OF_ALL_TYPES;
};

const estimateByFit = (fit, bytes) => fit.newTokensAtZeroBytes + fit.newTokensPerKilobyte * bytes / 1_024;

const estimateScreenCall = bytes => {
  const newTokens = estimateByFit(SCREEN_FIT, bytes);
  return { newTokens, outputTokens: SCREEN_FIT.outputShare * newTokens, cacheReadTokens: SCREEN_FIT.cacheReadTokens };
};

const isClosableByTheScreen = codeUnderReview => !codeUnderReview.isTest
  && (codeUnderReview.checks || []).length > 0
  && codeUnderReview.checks.every(check => (check.fields || []).length > 0);

const shareKeptAfterTheScreen = codeUnderReview => isClosableByTheScreen(codeUnderReview)
  ? 1 - (SCREEN_EMPTIED_SHARE_BY_JUDGE_TYPE_MAP[codeUnderReview.judgeType] ?? 0)
  : 1;

const holdsAFolder = codeUnderReview => codeUnderReview.scale === Scale.MODULE.name || codeUnderReview.scale === Scale.APPLICATION.name;

const splitIntoSegments = folder => folder.split("/").filter(Boolean);

const findSharedSegments = folders => folders.map(splitIntoSegments).reduce((shared, segments) => {
  let length = 0;
  while (length < shared.length && length < segments.length && shared[length] === segments[length]) length++;
  return shared.slice(0, length);
});

const readFolderOfTheCodeUnderReview = codeUnderReview => holdsAFolder(codeUnderReview) ? String(codeUnderReview.path || "") : readFolderPath(codeUnderReview.path || "");

const readFolderBelowTheSharedPrefix = (folder, sharedLength) => splitIntoSegments(folder).slice(0, sharedLength + FOLDER_SEGMENTS).join("/") || ".";

export function collectModuleRoots(abstractions) {
  const moduleRootByIdMap = new Map();
  const visit = (abstraction, root) => {
    const own = abstraction.scale === Scale.MODULE.name && abstraction.module && abstraction.module.root ? abstraction.module.root : root;
    if (own) moduleRootByIdMap.set(abstraction.id, own);
    for (const child of abstraction.children || []) visit(child, own);
  };
  for (const abstraction of abstractions || []) visit(abstraction, "");
  return moduleRootByIdMap;
}

const isAnApplicationCodeUnderReview = codeUnderReview => codeUnderReview.scale === Scale.APPLICATION.name;

export function collectFolderKeys(everyCodeUnderReview, moduleRoots = new Map()) {
  const folders = everyCodeUnderReview.filter(codeUnderReview => !isAnApplicationCodeUnderReview(codeUnderReview)).map(readFolderOfTheCodeUnderReview);
  const sharedLength = folders.length ? findSharedSegments(folders).length : 0;
  const readFolderKey = codeUnderReview => isAnApplicationCodeUnderReview(codeUnderReview)
    ? String(codeUnderReview.path || "") || "."
    : moduleRoots.get(codeUnderReview.abstractionId) || readFolderBelowTheSharedPrefix(readFolderOfTheCodeUnderReview(codeUnderReview), sharedLength);
  return new Map(everyCodeUnderReview.map(codeUnderReview => [codeUnderReview, readFolderKey(codeUnderReview)]));
}

const estimateCostOfJudgeCall = codeUnderReview => {
  const kept = shareKeptAfterTheScreen(codeUnderReview);
  return {
    judgeCalls: 1,
    judgeCallsAfterScreen: kept,
    newTokens: readNewTokens(codeUnderReview.judgeType),
    newTokensAfterScreen: kept * readNewTokens(codeUnderReview.judgeType),
    dollars: readDollars(codeUnderReview.judgeType),
    dollarsAfterScreen: kept * readDollars(codeUnderReview.judgeType),
    wallSeconds: readWallSeconds(codeUnderReview.judgeType),
    wallSecondsAfterScreen: kept * readWallSeconds(codeUnderReview.judgeType),
  };
};

const estimateRefuterCallsOfJudgeCall = codeUnderReview => {
  const refuterCalls = readRefuterCallsPerJudgeCall(codeUnderReview.judgeType);
  return { upTo: refuterCalls, afterScreen: shareKeptAfterTheScreen(codeUnderReview) * refuterCalls };
};

const NO_COST = Object.freeze({ judgeCalls: 0, judgeCallsAfterScreen: 0, newTokens: 0, newTokensAfterScreen: 0, dollars: 0, dollarsAfterScreen: 0, wallSeconds: 0, wallSecondsAfterScreen: 0 });

const addCosts = (left, right) => Object.fromEntries(Object.keys(NO_COST).map(field => [field, left[field] + right[field]]));

const roundToCents = dollars => Math.round(dollars * 100) / 100;

const roundCost = cost => ({
  judgeCalls: cost.judgeCalls,
  judgeCallsAfterScreen: Math.round(cost.judgeCallsAfterScreen),
  newTokens: Math.round(cost.newTokens),
  newTokensAfterScreen: Math.round(cost.newTokensAfterScreen),
  dollars: roundToCents(cost.dollars),
  dollarsAfterScreen: roundToCents(cost.dollarsAfterScreen),
});

const groupCosts = (everyCodeUnderReview, keyOf, keyName) => {
  const costByKeyMap = new Map();
  for (const codeUnderReview of everyCodeUnderReview) {
    const key = keyOf(codeUnderReview);
    costByKeyMap.set(key, addCosts(costByKeyMap.get(key) || NO_COST, estimateCostOfJudgeCall(codeUnderReview)));
  }
  return [...costByKeyMap].map(([key, cost]) => ({ [keyName]: key, ...roundCost(cost) }))
    .sort((left, right) => right.judgeCalls - left.judgeCalls || String(left[keyName]).localeCompare(String(right[keyName])));
};

const estimateScreenCallsOfAKind = (kind, batches) => batches.map(bytes => {
  const call = estimateScreenCall(bytes);
  return { newTokens: call.newTokens, dollars: estimateDollarsOfACall(SCREEN_ROLE_BY_KIND_MAP[kind], call) };
});

const estimateScreenCost = screens => {
  const everyCall = Object.entries(screens).flatMap(([kind, batches]) => estimateScreenCallsOfAKind(kind, batches));
  return {
    screenCalls: everyCall.length,
    newTokens: everyCall.reduce((total, call) => total + call.newTokens, 0),
    dollars: everyCall.reduce((total, call) => total + call.dollars, 0),
    wallSeconds: everyCall.length * SCREEN_FIT.wallSeconds,
  };
};

const estimateRefuteStage = refuterCalls => {
  const verifierCalls = Math.round(refuterCalls * REFUTED_SHARE);
  return {
    refuterCalls,
    verifierCalls,
    newTokens: refuterCalls * REFUTER_FIT.newTokens + verifierCalls * VERIFIER_CALL_FIT.newTokens,
    dollars: refuterCalls * estimateDollarsOfACall("refuter", REFUTER_FIT) + verifierCalls * estimateDollarsOfACall("verifier", VERIFIER_CALL_FIT),
    agentSeconds: refuterCalls * REFUTER_FIT.wallSeconds + verifierCalls * VERIFIER_CALL_FIT.wallSeconds,
  };
};

export function estimateRefuterCalls(everyCodeUnderReview) {
  const estimates = everyCodeUnderReview.map(estimateRefuterCallsOfJudgeCall);
  return {
    upTo: Math.round(estimates.reduce((total, estimate) => total + estimate.upTo, 0)),
    afterScreen: Math.round(estimates.reduce((total, estimate) => total + estimate.afterScreen, 0)),
  };
}

const estimateStageWall = (calls, secondsPerCall, concurrentAgentCalls) => (calls ? Math.max(secondsPerCall, calls * secondsPerCall / concurrentAgentCalls) : 0);

const estimateWall = (agentSeconds, screening, refuteStage, concurrentAgentCalls) => Math.round(agentSeconds / concurrentAgentCalls
  + (screening.screenCalls ? SCREEN_FIT.wallSeconds : 0)
  + estimateStageWall(refuteStage.refuterCalls, REFUTER_FIT.wallSeconds, concurrentAgentCalls)
  + estimateStageWall(refuteStage.verifierCalls, VERIFIER_CALL_FIT.wallSeconds, concurrentAgentCalls));

export function estimateCostTotals(everyCodeUnderReview, screens, concurrentAgentCalls = readConcurrentAgentCalls()) {
  const judges = everyCodeUnderReview.map(estimateCostOfJudgeCall).reduce(addCosts, NO_COST);
  const screening = estimateScreenCost(screens);
  const refuterCalls = estimateRefuterCalls(everyCodeUnderReview);
  const refuteStageUpTo = estimateRefuteStage(refuterCalls.upTo);
  const refuteStageAfterScreen = estimateRefuteStage(refuterCalls.afterScreen);
  return {
    upTo: {
      judgeCalls: judges.judgeCalls,
      screenCalls: screening.screenCalls,
      refuterCalls: refuteStageUpTo.refuterCalls,
      verifierCalls: refuteStageUpTo.verifierCalls,
      newTokens: Math.round(judges.newTokens + screening.newTokens + refuteStageUpTo.newTokens),
      dollars: roundToCents(judges.dollars + screening.dollars + refuteStageUpTo.dollars),
      wallSeconds: estimateWall(judges.wallSeconds + screening.wallSeconds, screening, refuteStageUpTo, concurrentAgentCalls),
    },
    afterScreen: {
      judgeCalls: Math.round(judges.judgeCallsAfterScreen),
      screenCalls: screening.screenCalls,
      refuterCalls: refuteStageAfterScreen.refuterCalls,
      verifierCalls: refuteStageAfterScreen.verifierCalls,
      newTokens: Math.round(judges.newTokensAfterScreen + screening.newTokens + refuteStageAfterScreen.newTokens),
      dollars: roundToCents(judges.dollarsAfterScreen + screening.dollars + refuteStageAfterScreen.dollars),
      wallSeconds: estimateWall(judges.wallSecondsAfterScreen + screening.wallSeconds, screening, refuteStageAfterScreen, concurrentAgentCalls),
    },
  };
}

const countExcludedJudgeCalls = everyCodeUnderReview => everyCodeUnderReview.filter(codeUnderReview => EXCLUDED_FROM_REFUTATION.includes(codeUnderReview.judgeType)).length;

const summarizeRefuteStage = (everyCodeUnderReview, totals) => ({
  refuterCallsUpTo: totals.upTo.refuterCalls,
  refuterCallsAfterScreen: totals.afterScreen.refuterCalls,
  verifierCalls: totals.upTo.verifierCalls,
  excludedJudgeCalls: countExcludedJudgeCalls(everyCodeUnderReview),
  refuterEffort: REFUTER_EFFORT,
});

const readDollarsPerNewTokenOfAMethodJudgeCall = () => readDollars("judge-simplicity-method") / readNewTokens("judge-simplicity-method");

const estimateThresholdDollars = upTo => roundToCents(THRESHOLD.newTokens * (upTo.newTokens ? upTo.dollars / upTo.newTokens : readDollarsPerNewTokenOfAMethodJudgeCall()));

export const passesThreshold = upTo => upTo.judgeCalls > THRESHOLD.judgeCalls || upTo.newTokens > THRESHOLD.newTokens;

const summarizeIoPathsCodeUnderReview = codeUnderReview => ({
  id: codeUnderReview.id,
  endMethod: (codeUnderReview.end || {}).id || "",
  displayName: codeUnderReview.displayName,
  path: codeUnderReview.path,
  reachingCalls: (codeUnderReview.reachingCalls || []).length,
  loops: (codeUnderReview.reachingCalls || []).reduce((total, reachingCall) => total + (reachingCall.loops || []).length, 0),
  endCalls: (codeUnderReview.calls || []).length,
});

export function buildCostPlan({ codeUnderReview, screens, moduleRoots = new Map(), filter = null, scalesRun = null, waves: waveCount = 1, concurrentAgentCalls = readConcurrentAgentCalls() }) {
  const totals = estimateCostTotals(codeUnderReview, screens, concurrentAgentCalls);
  const folderKeys = collectFolderKeys(codeUnderReview, moduleRoots);
  return {
    filter,
    threshold: THRESHOLD,
    passesThreshold: passesThreshold(totals.upTo),
    thresholdDollars: estimateThresholdDollars(totals.upTo),
    averagesMeasured: AVERAGES_MEASURED,
    dollarsLeaveOut: DOLLARS_LEAVE_OUT,
    concurrentAgentCalls,
    ...totals,
    waves: waveCount,
    refute: summarizeRefuteStage(codeUnderReview, totals),
    screens: Object.fromEntries(Object.entries(screens).map(([kind, batches]) => [kind, batches.length])),
    byJudgeType: groupCosts(codeUnderReview, judgeCall => judgeCall.judgeType, "judgeType"),
    byScale: groupCosts(codeUnderReview, judgeCall => judgeCall.scale, "scale"),
    byFolder: groupCosts(codeUnderReview, judgeCall => folderKeys.get(judgeCall), "folder"),
    ioPaths: codeUnderReview.filter(judgeCall => judgeCall.judgeType === "judge-performance-io-paths").map(summarizeIoPathsCodeUnderReview),
    scalesRun,
  };
}

const formatThousands = count => count >= 1_000_000 ? `${(count / 1_000_000).toFixed(1)}M` : count >= 1_000 ? `${Math.round(count / 1_000)}K` : String(count);

const formatMinutes = seconds => `${Math.max(1, Math.round(seconds / 60))} min`;

const formatScaleNames = scales => {
  const names = scales.map(scale => scale.toLowerCase());
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
};

const formatDollars = dollars => (dollars >= 10 ? `$${Math.round(dollars)}` : `$${dollars.toFixed(2)}`);

const formatRunPhrase = run => `new tokens ${formatThousands(run.upTo.newTokens)} up to · ${formatThousands(run.afterScreen.newTokens)} after the screen · dollars about ${formatDollars(run.upTo.dollars)} up to · ${formatDollars(run.afterScreen.dollars)} after the screen · wall ${formatMinutes(run.upTo.wallSeconds)} up to`;

const formatScalesRunPhrase = scalesRun => scalesRun
  ? ` · ${formatScaleNames(scalesRun.scales)} only: judge calls ${scalesRun.upTo.judgeCalls} up to · ${scalesRun.afterScreen.judgeCalls} after the screen · ${formatRunPhrase(scalesRun)}`
  : "";

export const formatCostPlanLine = plan =>
  `cost plan: judge calls ${plan.upTo.judgeCalls} up to · ${plan.afterScreen.judgeCalls} after the screen · refuter calls ${plan.upTo.refuterCalls} up to · verifier calls ${plan.upTo.verifierCalls} up to · ${formatRunPhrase(plan)} · judge workflow waves ${plan.waves}${formatScalesRunPhrase(plan.scalesRun)} · threshold ${formatThousands(THRESHOLD.newTokens)} new tokens about ${formatDollars(plan.thresholdDollars)} · above the threshold of ${THRESHOLD.judgeCalls} calls or ${formatThousands(THRESHOLD.newTokens)} new tokens: ${plan.passesThreshold ? "yes" : "no"}${plan.filter ? " · filtered" : ""}`;
