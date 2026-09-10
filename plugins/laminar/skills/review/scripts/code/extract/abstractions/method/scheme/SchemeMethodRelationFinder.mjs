import { createBareCall } from "../generic/calls/CallScanner.mjs";
import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

const SCHEME_WORDS = new Set(["define", "lambda", "let", "let*", "letrec", "if", "cond", "else", "begin", "set!", "quote", "and",
  "or", "when", "unless", "case", "do", "define-syntax", "syntax-rules", "define-record-type"]);

const SCHEME_HEAD_PATTERN = /\(\s*([^\s()'"`;#[\]]+)/g;

function findSchemeCalls(code, from) {
  const calls = [];
  for (const found of code.matchAll(SCHEME_HEAD_PATTERN)) {
    if (found.index < from || SCHEME_WORDS.has(found[1])) continue;
    calls.push(createBareCall({ col: found.index, callee: found[1], opening: found.index }));
  }
  return calls;
}

export class SchemeMethodRelationFinder extends GenericMethodRelationFinder {
  language = "scheme";

  findCallsOnLine(text, from) {
    return findSchemeCalls(text, from);
  }
}
