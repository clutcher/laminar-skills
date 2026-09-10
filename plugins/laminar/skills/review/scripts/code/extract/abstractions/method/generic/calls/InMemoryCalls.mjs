import { readCallEffects } from "../../../../finders/LanguageStrategies.mjs";
import { splitNameWords } from "../../../../../inputs/source/names/NameWords.mjs";
import { parseType } from "../../../../../inputs/source/text/TypeText.mjs";

const WORDS_THAT_END_OR_WAIT = new Set(["close", "shutdown", "stop", "dispose", "await", "wait", "sleep", "interrupt", "unlock"]);

const GETTER_PREFIX_PATTERN = /^(?:get|is|has)(?=[A-Z_]|$)/i;

const ACCESSOR_PREFIX_PATTERN = /^(?:[Ss]et|[Ww]ith|[Tt]o|[Ii]s|[Hh]as)(?=[A-Z_])/;

const LEADING_SIGILS_PATTERN = /^[$@_]+/;

const readWords = name => splitNameWords(String(name || "").replace(LEADING_SIGILS_PATTERN, ""));

export const isInMemoryTypeName = (name, diffDriver) => readCallEffects(diffDriver).holdsInMemory(name);

export const isInMemoryType = (type, diffDriver) => Boolean(type)
  && (isInMemoryTypeName(type.qualified, diffDriver) || isInMemoryTypeName(type.simple, diffDriver) || type.collection);

export const doesSomeTypeLeaveMemory = (typeTexts, diffDriver) => typeTexts.some(text => !isInMemoryType(parseType(text), diffDriver));

export const endsOrWaits = callee => {
  const words = readWords(callee);
  return WORDS_THAT_END_OR_WAIT.has(words[0] || "") || words[words.length - 1] === "termination";
};

export const isGetterShaped = (callee, args, diffDriver) => (args === 0 && GETTER_PREFIX_PATTERN.test(callee))
  || ACCESSOR_PREFIX_PATTERN.test(callee)
  || readCallEffects(diffDriver).isAnObjectProtocolCallee(callee);

export const isAnInMemoryCallee = (callee, diffDriver) => readCallEffects(diffDriver).staysInMemoryWhenCalled(callee);

export const staysInMemoryByShape = (call, diffDriver) => readCallEffects(diffDriver).isALoopCallee(call.callee)
  || endsOrWaits(call.callee)
  || isGetterShaped(call.callee, call.args, diffDriver)
  || isAnInMemoryCallee(call.callee, diffDriver);
