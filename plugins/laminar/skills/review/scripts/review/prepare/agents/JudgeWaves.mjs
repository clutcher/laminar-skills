import { TRACKS } from "../../../checks/CheckCatalog.mjs";

export const MAX_AGENT_CALLS_PER_WAVE = 900;

export const IO_RULE_SCREEN_CALLS_AT_MOST = 2;

const THE_IO_RULES = "io rules";

export const isAnIoPathsCodeUnderReview = codeUnderReview => codeUnderReview.track === TRACKS.IO_PATHS;

const readNumber = id => Number(String(id).replace(/^[A-Z]+/, ""));

const collectScreenBatchNumbersByAbstraction = screenBatches => {
  const screenBatchNumberByAbstractionMap = new Map();
  screenBatches.forEach((batch, index) => {
    for (const abstraction of batch.abstractions) screenBatchNumberByAbstractionMap.set(abstraction.abstractionId, index + 1);
  });
  return screenBatchNumberByAbstractionMap;
};

class PlannedJudgeCall {
  constructor(codeUnderReview, screenBatchNumber, needsTheIoRules) {
    this.number = readNumber(codeUnderReview.id);
    this.screenBatchNumber = screenBatchNumber;
    this.needsTheIoRules = needsTheIoRules;
  }

  get sharedScreenCalls() {
    return [
      ...(this.screenBatchNumber ? [this.screenBatchNumber] : []),
      ...(this.needsTheIoRules ? [THE_IO_RULES] : []),
    ];
  }
}

class JudgeCallGroup {
  constructor(judgeCalls = []) {
    this.judgeCalls = [];
    for (const judgeCall of judgeCalls) this.add(judgeCall);
  }

  add(judgeCall) {
    this.judgeCalls.push(judgeCall);
  }

  get screenBatchNumbers() {
    return [...new Set(this.judgeCalls.map(judgeCall => judgeCall.screenBatchNumber).filter(Boolean))].sort((left, right) => left - right);
  }

  get needsTheIoRules() {
    return this.judgeCalls.some(judgeCall => judgeCall.needsTheIoRules);
  }

  get firstNumber() {
    return Math.min(...this.judgeCalls.map(judgeCall => judgeCall.number));
  }

  countAgentCalls(ioRuleScreenCalls) {
    return this.judgeCalls.length + this.screenBatchNumbers.length + (this.needsTheIoRules ? ioRuleScreenCalls : 0);
  }
}

const buildGroupsSharingNoScreenCall = plannedJudgeCalls => {
  const groupBySharedScreenCallMap = new Map();
  const groups = new Set();
  for (const judgeCall of plannedJudgeCalls) {
    const joined = [...new Set(judgeCall.sharedScreenCalls.map(shared => groupBySharedScreenCallMap.get(shared)).filter(Boolean))];
    const group = joined.shift() || new JudgeCallGroup();
    groups.add(group);
    for (const other of joined) {
      for (const joinedJudgeCall of other.judgeCalls) group.add(joinedJudgeCall);
      groups.delete(other);
    }
    group.add(judgeCall);
    for (const groupedJudgeCall of group.judgeCalls) for (const shared of groupedJudgeCall.sharedScreenCalls) groupBySharedScreenCallMap.set(shared, group);
  }
  return [...groups].sort((left, right) => left.firstNumber - right.firstNumber);
};

const splitIntoGroupsWithinTheCap = (group, cap, ioRuleScreenCalls) => {
  if (group.countAgentCalls(ioRuleScreenCalls) <= cap) return [group];
  const ordered = [...group.judgeCalls].sort((left, right) => left.number - right.number);
  const pieces = [new JudgeCallGroup()];
  for (const judgeCall of ordered) {
    const last = pieces[pieces.length - 1];
    if (last.judgeCalls.length && new JudgeCallGroup([...last.judgeCalls, judgeCall]).countAgentCalls(ioRuleScreenCalls) > cap) pieces.push(new JudgeCallGroup([judgeCall]));
    else last.add(judgeCall);
  }
  return pieces;
};

const joinIntoIntervals = numbers => {
  const intervals = [];
  for (const number of [...numbers].sort((left, right) => left - right)) {
    const last = intervals[intervals.length - 1];
    if (last && last[1] === number - 1) last[1] = number;
    else intervals.push([number, number]);
  }
  return intervals;
};

const createWave = (group, waveNumber, ioRuleScreenCalls) => {
  const screenBatches = group.screenBatchNumbers;
  const ioRules = group.needsTheIoRules && ioRuleScreenCalls > 0;
  return {
    number: waveNumber,
    agentCalls: group.countAgentCalls(ioRuleScreenCalls),
    screenBatches,
    ioRules,
    codeUnderReview: joinIntoIntervals(group.judgeCalls.map(judgeCall => judgeCall.number)),
  };
};

export function buildJudgeWaves(everyCodeUnderReview, screenBatches, { ioRuleScreenCall = false, cap = MAX_AGENT_CALLS_PER_WAVE } = {}) {
  const ioRuleScreenCalls = ioRuleScreenCall ? IO_RULE_SCREEN_CALLS_AT_MOST : 0;
  const batchNumberOf = collectScreenBatchNumbersByAbstraction(screenBatches);
  const plannedJudgeCalls = everyCodeUnderReview.map(codeUnderReview => new PlannedJudgeCall(codeUnderReview, batchNumberOf.get(codeUnderReview.abstractionId) || 0, ioRuleScreenCall && isAnIoPathsCodeUnderReview(codeUnderReview)));
  const waves = [];
  let filling = new JudgeCallGroup();
  for (const group of buildGroupsSharingNoScreenCall(plannedJudgeCalls).flatMap(judgeCallGroup => splitIntoGroupsWithinTheCap(judgeCallGroup, cap, ioRuleScreenCalls))) {
    const joined = new JudgeCallGroup([...filling.judgeCalls, ...group.judgeCalls]);
    if (filling.judgeCalls.length && joined.countAgentCalls(ioRuleScreenCalls) > cap) {
      waves.push(filling);
      filling = group;
    } else filling = joined;
  }
  if (filling.judgeCalls.length || !waves.length) waves.push(filling);
  return waves.map((group, index) => createWave(group, index + 1, ioRuleScreenCalls));
}
