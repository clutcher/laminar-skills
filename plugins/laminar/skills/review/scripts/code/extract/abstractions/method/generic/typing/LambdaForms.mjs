import { escapeForAPattern } from "../../../../../inputs/source/text/PatternText.mjs";

export const LAMBDA_HINT_PATTERN = /=>|->|\blambda\b|\|/;

const lambdaFormsByNameMap = new Map();

export const readLambdaParameterForm = name => {
  if (!lambdaFormsByNameMap.has(name)) {
    const word = escapeForAPattern(name);
    const alone = `(?<![\\w$.])${word}`;
    const listed = `\\((?:[^()]*?,\\s*)?${word}(?:\\s*:[^,()]+)?\\s*(?:,[^()]*)?\\)`;
    const piped = `\\|(?:[^|]*?,\\s*)?${word}(?:\\s*:[^,|]+)?\\s*(?:,[^|]*)?\\|`;
    lambdaFormsByNameMap.set(name, new RegExp(`(?:(?:${alone}|${listed})\\s*(?::\\s*[\\w$<>\\[\\]]+\\s*)?(?:=>|->))|\\{\\s*${piped}|\\{\\s*(?:[\\w$]+\\s*,\\s*)*${word}(?:\\s*,\\s*[\\w$]+)*\\s*->|\\blambda\\s+(?:[\\w$]+\\s*,\\s*)*${word}\\b[^:]*:`));
  }
  return lambdaFormsByNameMap.get(name);
};
