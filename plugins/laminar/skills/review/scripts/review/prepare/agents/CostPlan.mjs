import os from "node:os";
import { Scale } from "../../../code/index.mjs";
import { readFolderPath } from "../../../files/paths.mjs";

export const COST_PLAN_FILE = "cost-plan.json";

export const FULL_COST_PLAN_FILE = "cost-plan-full.json";

export const THRESHOLD = Object.freeze({ judgeCalls: 500, newTokens: 2_000_000 });

export const AVERAGES_MEASURED = "new tokens and wall seconds per judge call from measured review runs; possible findings per judge call from a run of the eval suite";

const MEASURED_BY_ROLE_MAP = Object.freeze({
  "simplicity-variable": { newTokens: 4_403, wallSeconds: 8 },
  "simplicity-method": { newTokens: 4_550, wallSeconds: 6 },
  "simplicity-class": { newTokens: 4_596, wallSeconds: 9 },
  "simplicity-module": { newTokens: 4_961, wallSeconds: 7 },
  "simplicity-decision": { newTokens: 5_724, wallSeconds: 9 },
  "correctness-prevention": { newTokens: 4_492, wallSeconds: 7 },
  "performance": { newTokens: 4_942, wallSeconds: 5 },
  "correctness-simplicity-test-method": { newTokens: 5_387, wallSeconds: 8 },
  "correctness-test-plan": { newTokens: 12_725, wallSeconds: 17 },
});

export const ROLE_BY_JUDGE_TYPE_MAP = Object.freeze({
  "judge-simplicity-variable": "simplicity-variable",
  "judge-simplicity-method": "simplicity-method",
  "judge-simplicity-class": "simplicity-class",
  "judge-simplicity-module": "simplicity-module",
  "judge-simplicity-decision": "simplicity-decision",
  "judge-simplicity-comment": "simplicity-method",
  "judge-correctness-prevention": "correctness-prevention",
  "judge-correctness-validate-at-the-boundary": "correctness-prevention",
  "judge-correctness-simplicity-test-method": "correctness-simplicity-test-method",
  "judge-correctness-test-plan": "correctness-test-plan",
  "judge-performance-abstraction": "performance",
  "judge-performance-io-paths": "performance",
  "judge-design-over-extraction": "simplicity-decision",
  "judge-design-scoped-parameters": "simplicity-decision",
  "judge-design-leaked-details": "simplicity-decision",
  "judge-design-entry-boundary": "simplicity-decision",
});

export const ESTIMATED_FROM_A_NEAR_ROLE = Object.freeze(Object.fromEntries(Object.entries(ROLE_BY_JUDGE_TYPE_MAP)
  .filter(([judgeType, role]) => judgeType !== `judge-${role}`)));

export const SCREEN_FIT = Object.freeze({ newTokensAtZeroBytes: 5_369, newTokensPerKilobyte: 578, wallSeconds: 18 });

export const HARNESS_CONTEXT_NEW_TOKENS = 1_900;

export const REFUTER_EFFORT = "medium";

export const REFUTER_FIT = Object.freeze({ newTokens: 4_600 + HARNESS_CONTEXT_NEW_TOKENS, wallSeconds: 45, effort: REFUTER_EFFORT });

export const VERIFIER_CALL_FIT = Object.freeze({ newTokens: 8_100 + HARNESS_CONTEXT_NEW_TOKENS, wallSeconds: 60 });

export const REFUTED_SHARE = 0.25;

export const EXCLUDED_FROM_REFUTATION = Object.freeze(["judge-correctness-test-plan", "judge-performance-io-paths"]);

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

export const FALLBACK_ROLE = "correctness-prevention";

export const MAX_CONCURRENT_AGENT_CALLS = 16;

export const CPUS_LEFT_FREE = 2;

export const CONCURRENT_AGENT_CALLS_SETTING = "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS";

export function readConcurrentAgentCalls(environment = process.env, cpuCount = os.cpus().length) {
  const setting = Number.parseInt(environment[CONCURRENT_AGENT_CALLS_SETTING], 10);
  if (setting > 0) return setting;
  return Math.max(1, Math.min(MAX_CONCURRENT_AGENT_CALLS, cpuCount - CPUS_LEFT_FREE));
}

export const TOP_PREVIEWS = Object.freeze([50, 100, 250, 500]);

const FOLDER_SEGMENTS = 2;

const readMeasured = judgeType => MEASURED_BY_ROLE_MAP[ROLE_BY_JUDGE_TYPE_MAP[judgeType] || FALLBACK_ROLE];

const readNewTokens = judgeType => readMeasured(judgeType).newTokens;

const readWallSeconds = judgeType => readMeasured(judgeType).wallSeconds;

const readPossibleFindingsPerJudgeCall = judgeType => (EXCLUDED_FROM_REFUTATION.includes(judgeType)
  ? 0
  : POSSIBLE_FINDINGS_PER_JUDGE_CALL_BY_JUDGE_TYPE[judgeType] ?? POSSIBLE_FINDINGS_PER_JUDGE_CALL_OF_ALL_TYPES);

const estimateByFit = (fit, bytes) => fit.newTokensAtZeroBytes + fit.newTokensPerKilobyte * bytes / 1_024;

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
    wallSeconds: readWallSeconds(codeUnderReview.judgeType),
    wallSecondsAfterScreen: kept * readWallSeconds(codeUnderReview.judgeType),
  };
};

const estimateRefuterCallsOfJudgeCall = codeUnderReview => {
  const possibleFindings = readPossibleFindingsPerJudgeCall(codeUnderReview.judgeType);
  return { upTo: possibleFindings, afterScreen: shareKeptAfterTheScreen(codeUnderReview) * possibleFindings };
};

const NO_COST = Object.freeze({ judgeCalls: 0, judgeCallsAfterScreen: 0, newTokens: 0, newTokensAfterScreen: 0, wallSeconds: 0, wallSecondsAfterScreen: 0 });

const addCosts = (left, right) => Object.fromEntries(Object.keys(NO_COST).map(field => [field, left[field] + right[field]]));

const roundCost = cost => ({
  judgeCalls: cost.judgeCalls,
  judgeCallsAfterScreen: Math.round(cost.judgeCallsAfterScreen),
  newTokens: Math.round(cost.newTokens),
  newTokensAfterScreen: Math.round(cost.newTokensAfterScreen),
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

const estimateScreenCost = screens => {
  const everyBatch = Object.values(screens).flat();
  return {
    screenCalls: everyBatch.length,
    newTokens: everyBatch.reduce((total, bytes) => total + estimateByFit(SCREEN_FIT, bytes), 0),
    wallSeconds: everyBatch.length * SCREEN_FIT.wallSeconds,
  };
};

const estimateRefuteStage = refuterCalls => {
  const verifierCalls = Math.round(refuterCalls * REFUTED_SHARE);
  return {
    refuterCalls,
    verifierCalls,
    newTokens: refuterCalls * REFUTER_FIT.newTokens + verifierCalls * VERIFIER_CALL_FIT.newTokens,
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
      wallSeconds: estimateWall(judges.wallSeconds + screening.wallSeconds, screening, refuteStageUpTo, concurrentAgentCalls),
    },
    afterScreen: {
      judgeCalls: Math.round(judges.judgeCallsAfterScreen),
      screenCalls: screening.screenCalls,
      refuterCalls: refuteStageAfterScreen.refuterCalls,
      verifierCalls: refuteStageAfterScreen.verifierCalls,
      newTokens: Math.round(judges.newTokensAfterScreen + screening.newTokens + refuteStageAfterScreen.newTokens),
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

export function buildCostPlan({ codeUnderReview, screens, moduleRoots = new Map(), filter = null, topPreviews = [], waves: waveCount = 1, concurrentAgentCalls = readConcurrentAgentCalls() }) {
  const totals = estimateCostTotals(codeUnderReview, screens, concurrentAgentCalls);
  const folderKeys = collectFolderKeys(codeUnderReview, moduleRoots);
  return {
    filter,
    threshold: THRESHOLD,
    passesThreshold: passesThreshold(totals.upTo),
    averagesMeasured: AVERAGES_MEASURED,
    estimatedFromANearRole: ESTIMATED_FROM_A_NEAR_ROLE,
    concurrentAgentCalls,
    ...totals,
    waves: waveCount,
    refute: summarizeRefuteStage(codeUnderReview, totals),
    screens: Object.fromEntries(Object.entries(screens).map(([kind, batches]) => [kind, batches.length])),
    byJudgeType: groupCosts(codeUnderReview, judgeCall => judgeCall.judgeType, "judgeType"),
    byScale: groupCosts(codeUnderReview, judgeCall => judgeCall.scale, "scale"),
    byFolder: groupCosts(codeUnderReview, judgeCall => folderKeys.get(judgeCall), "folder"),
    ioPaths: codeUnderReview.filter(judgeCall => judgeCall.judgeType === "judge-performance-io-paths").map(summarizeIoPathsCodeUnderReview),
    topByBoundaryRank: topPreviews,
  };
}

const formatThousands = count => count >= 1_000_000 ? `${(count / 1_000_000).toFixed(1)}M` : count >= 1_000 ? `${Math.round(count / 1_000)}K` : String(count);

const formatMinutes = seconds => `${Math.max(1, Math.round(seconds / 60))} min`;

export const formatCostPlanLine = plan =>
  `cost plan: judge calls ${plan.upTo.judgeCalls} up to · ${plan.afterScreen.judgeCalls} after the screen · refuter calls ${plan.upTo.refuterCalls} up to · verifier calls ${plan.upTo.verifierCalls} up to · new tokens ${formatThousands(plan.upTo.newTokens)} up to · ${formatThousands(plan.afterScreen.newTokens)} after the screen · wall ${formatMinutes(plan.upTo.wallSeconds)} up to · judge workflow waves ${plan.waves} · above the threshold of ${THRESHOLD.judgeCalls} calls or ${formatThousands(THRESHOLD.newTokens)} new tokens: ${plan.passesThreshold ? "yes" : "no"}${plan.filter ? " · filtered" : ""}`;
