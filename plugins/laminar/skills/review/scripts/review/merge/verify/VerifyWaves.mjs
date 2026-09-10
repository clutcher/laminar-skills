import { MAX_AGENT_CALLS_PER_WAVE } from "../../prepare/agents/JudgeWaves.mjs";

export const MAX_REFUTER_CALLS_PER_WAVE = MAX_AGENT_CALLS_PER_WAVE / 2;

const readItemNumber = ([itemNumber]) => itemNumber;

const countRefuterCalls = ([, possibleFindingNumbers]) => possibleFindingNumbers.length;

const joinIntoIntervals = numbers => numbers.reduce((intervals, number) => {
  const last = intervals[intervals.length - 1];
  if (last && last[1] === number - 1) last[1] = number;
  else intervals.push([number, number]);
  return intervals;
}, []);

const groupWholeItemsWithinTheCap = (list, cap) => {
  const waves = [[]];
  let refuterCalls = 0;
  for (const itemTuple of list) {
    const calls = countRefuterCalls(itemTuple);
    if (waves[waves.length - 1].length && refuterCalls + calls > cap) {
      waves.push([]);
      refuterCalls = 0;
    }
    waves[waves.length - 1].push(itemTuple);
    refuterCalls += calls;
  }
  return waves;
};

export const splitIntoVerifyWaves = (list, cap = MAX_REFUTER_CALLS_PER_WAVE) => (list.length
  ? groupWholeItemsWithinTheCap(list, cap).map((itemTuples, index) => ({ number: index + 1, items: joinIntoIntervals(itemTuples.map(readItemNumber)) }))
  : []);
