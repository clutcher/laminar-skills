import { collectStems, splitNameWords } from "../../../../../code/index.mjs";

const TRANSPORT_WORDS = ["request", "response", "input", "output", "result", "payload", "dto", "message", "event", "command", "query", "args", "params"];

const STORAGE_WORDS = ["entity", "record", "row", "document", "table", "schema", "model", "data", "info", "details", "view", "form"];

const CODE_ROLE_WORDS = ["service", "repository", "controller", "resolver", "client", "mapper", "factory", "handler", "builder", "impl", "config",
  "configuration", "properties", "exception", "error", "test", "spec", "type", "base", "abstract", "default"];

export const TYPE_WORDS = Object.freeze(new Set([...TRANSPORT_WORDS, ...STORAGE_WORDS, ...CODE_ROLE_WORDS]));

export const VARIANT_WORD_MARK = "*";

const MIN_NAME_WORDS = 2;

const isATypeWord = word => TYPE_WORDS.has(word);

const buildNameKey = (words, position) => words.map((word, at) => (at === position ? VARIANT_WORD_MARK : word)).join(" ");

const holdsAWordOfTheBusiness = (words, position) => words.some((word, at) => at !== position && !isATypeWord(word));

export const readNameWords = name => splitNameWords(name);

export const listNameKeys = words => {
  if (words.length < MIN_NAME_WORDS) return [];
  return words
    .map((word, position) => ({ word, position }))
    .filter(({ word, position }) => !isATypeWord(word) && holdsAWordOfTheBusiness(words, position))
    .map(({ position }) => buildNameKey(words, position));
};

export const readVariantWord = (words, nameKey) => words[nameKey.split(" ").indexOf(VARIANT_WORD_MARK)] || "";

export const shareAStem = (leftWord, rightWord) => {
  const rightStems = new Set(collectStems(rightWord));
  return leftWord === rightWord || collectStems(leftWord).some(stem => rightStems.has(stem));
};

const capitalize = word => (word === VARIANT_WORD_MARK ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`);

export const formatNamePattern = nameKey => nameKey.split(" ").map(capitalize).join("");
