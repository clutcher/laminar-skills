export const RULE_ANSWERS = Object.freeze({ IO: "io", NOT_IO: "not_io" });

export const MIN_LITERAL_PREFIX = 2;

const RULE_MARK = "R";

const WILDCARDS = new Set(["*", "?"]);

export function matchesGlob(glob, text) {
  let at = 0;
  let from = 0;
  let star = -1;
  let mark = 0;
  while (from < text.length) {
    if (at < glob.length && (glob[at] === "?" || glob[at] === text[from])) { at++; from++; }
    else if (at < glob.length && glob[at] === "*") { star = at++; mark = from; }
    else if (star >= 0) { at = star + 1; from = ++mark; }
    else return false;
  }
  while (at < glob.length && glob[at] === "*") at++;
  return at === glob.length;
}

const readLiteralPrefix = glob => {
  let length = 0;
  while (length < glob.length && !WILDCARDS.has(glob[length])) length++;
  return glob.slice(0, length);
};

const isText = given => typeof given === "string" && given.trim() === given && given.length > 0 && !/\s/.test(given);

export const restsOnATypeOrModule = on => isText(on) && readLiteralPrefix(on).length >= MIN_LITERAL_PREFIX;

export const isAUsableRule = rule => Boolean(rule)
  && restsOnATypeOrModule(rule.on)
  && Array.isArray(rule.callee) && rule.callee.length > 0 && rule.callee.every(isText)
  && Object.values(RULE_ANSWERS).includes(rule.answer);

export function parseRules(given) {
  const listed = Array.isArray(given) ? given : [];
  const kept = listed.filter(isAUsableRule).map((rule, index) => ({ id: `${RULE_MARK}${index + 1}`, on: rule.on, callee: [...rule.callee], answer: rule.answer }));
  return { rules: kept, dropped: listed.filter(rule => !isAUsableRule(rule)) };
}

const coversTheCall = (rule, names, callee) => names.some(name => matchesGlob(rule.on, name)) && rule.callee.some(glob => matchesGlob(glob, callee));

export function findRuleAnswer(rules, call) {
  const names = call.on || [];
  if (!names.length || !call.callee) return null;
  const covering = rules.filter(rule => coversTheCall(rule, names, call.callee));
  if (!covering.length) return null;
  const deciding = covering.find(rule => rule.answer === RULE_ANSWERS.IO) || covering[0];
  return { answer: deciding.answer, rule: deciding.id };
}

export function collectRuleAnswers(rules, ends) {
  const answersByCallIdMap = new Map();
  for (const end of ends) {
    for (const call of end.calls) {
      const answer = findRuleAnswer(rules, call);
      if (answer) answersByCallIdMap.set(call.id, answer);
    }
  }
  return answersByCallIdMap;
}

export const countEndCallsByRule = answers => {
  const countByRuleMap = new Map();
  for (const { rule } of answers.values()) countByRuleMap.set(rule, (countByRuleMap.get(rule) || 0) + 1);
  return countByRuleMap;
};
