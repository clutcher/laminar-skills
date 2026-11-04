import { readList } from "../model/DesignModel.mjs";

const PLACEHOLDER = /<([A-Za-z]+)>/g;

// Words that open a test name in the test frameworks of every stack, such as JUnit, Jest, pytest and Go, and name no behavior.
const OPENING_WORDS = new Set(["test", "should", "it"]);

const TEST_WORD = "test";

const WORDS_OF_A_BEHAVIOR_AT_LEAST = 2;

const escapeLiteral = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createPlaceholderPattern = placeholder => (/^[A-Z]/.test(placeholder) ? "[A-Z0-9][A-Za-z0-9]*?" : "[a-z0-9][a-z0-9_]*?");

const createFormPattern = form => {
  let pattern = "";
  let last = 0;
  for (const match of form.matchAll(PLACEHOLDER)) {
    pattern += escapeLiteral(form.slice(last, match.index)) + createPlaceholderPattern(match[1]);
    last = match.index + match[0].length;
  }
  return new RegExp(`^${pattern}${escapeLiteral(form.slice(last))}$`);
};

const splitIntoWords = name => name
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .split(/[\s_]+/)
  .filter(Boolean)
  .map(word => word.toLowerCase());

const dropOpeningWords = words => {
  let first = 0;
  while (first < words.length && OPENING_WORDS.has(words[first])) first += 1;
  return words.slice(first);
};

const createBehaviorRule = methodNames => {
  const methodWordsSet = new Set(methodNames.map(methodName => splitIntoWords(methodName).join(" ")));
  return testName => {
    const words = splitIntoWords(testName);
    if (dropOpeningWords(words).length < WORDS_OF_A_BEHAVIOR_AT_LEAST) return false;
    return !(words[0] === TEST_WORD && methodWordsSet.has(words.slice(1).join(" ")));
  };
};

export const createTestNameForm = (forms, methodNames) => {
  const patterns = readList(forms).map(createFormPattern);
  if (!patterns.length) return { describe: () => "states no behavior: 1 word, or test and the name of a method of the model", fits: createBehaviorRule(methodNames) };
  return {
    describe: () => `fits no form of decisions.conventions.testNameForms: ${readList(forms).join(", ")}`,
    fits: testName => patterns.some(pattern => pattern.test(testName)),
  };
};
