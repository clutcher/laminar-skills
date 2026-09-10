import { isANonBlankCodeLine } from "../../../../../inputs/source/lines/LineKinds.mjs";
import { splitDeclarationHead } from "../signatures/MethodSignatures.mjs";
import { countOpened } from "../../../../../inputs/source/text/Brackets.mjs";

const BARE_CLOSER_PATTERN = /^\s*[)}\]]+[;,]?\s*$/;
const STATEMENT_END_PATTERN = /[;{}:]\s*$/;
const STRING_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;
const BRANCH_WORD_PATTERN = /(?<![\w$])(if|elif|elsif|case|when|match)(?![\w$])/g;
const TERNARY_PATTERN = /(?<![?\w$])\?(?![?.:])(?=[^?]*:)/g;
const SHORT_CIRCUIT_PATTERN = /&&|\|\||\?\?/g;
const CATCH_CLAUSE_PATTERN = /(?<![\w$])(catch|except|rescue)(?![\w$])/g;

const filterCodeLines = lines => lines.filter(isANonBlankCodeLine);

function countSteps(bodyLines) {
  let depth = 0;
  let steps = 0;
  let previous = null;
  for (const line of filterCodeLines(bodyLines)) {
    const startsAStep = depth === 0 && !BARE_CLOSER_PATTERN.test(line) && (previous === null || STATEMENT_END_PATTERN.test(previous));
    if (startsAStep) steps++;
    depth = Math.max(0, depth + countOpened(line));
    previous = line;
  }
  return steps;
}

const countTimes = (lines, pattern) => lines
  .reduce((total, line) => total + (String(line).replace(STRING_PATTERN, '""').match(pattern) || []).length, 0);

export function countBranches(lines) {
  const code = filterCodeLines(lines);
  return {
    explicitBranchCount: countTimes(code, BRANCH_WORD_PATTERN) + countTimes(code, TERNARY_PATTERN),
    shortCircuitCount: countTimes(code, SHORT_CIRCUIT_PATTERN),
    catchClauseCount: countTimes(code, CATCH_CLAUSE_PATTERN),
  };
}

export const countBranchesOfLine = text => {
  const counts = countBranches([text]);
  return counts.explicitBranchCount + counts.shortCircuitCount + counts.catchClauseCount;
};

export function measureMethod(declarationLines) {
  const { bodyLines } = splitDeclarationHead(declarationLines);
  return {
    stepCount: countSteps(bodyLines),
    ...countBranches(bodyLines),
  };
}
