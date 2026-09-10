const findFirstAnswer = (strategies, ask, isAnAnswer) => {
  for (const strategy of strategies) {
    const answer = ask(strategy);
    if (isAnAnswer(answer)) return answer;
  }
  return undefined;
};

const isDefined = answer => answer !== undefined;

export const findFirstFoundAnswer = (strategies, ask) => findFirstAnswer(strategies, ask, Boolean) || null;

export const findFirstDefinedAnswer = (strategies, ask) => findFirstAnswer(strategies, ask, isDefined);
