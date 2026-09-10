import { splitNameWords } from "./NameWords.mjs";

const SUFFIXES = ["ures", "ure", "ings", "ing", "ions", "ion", "ers", "er", "ed", "es", "s"];

const WORDS_THAT_NAME_NOTHING = new Set(["a", "an", "the", "and", "or", "of", "to", "in", "on", "at", "by", "for",
  "with", "from", "is", "ar", "be", "do", "get", "set", "has", "any", "all", "new", "this", "that", "it", "when",
  "where", "if", "not", "no", "test", "abstract", "public", "privat", "static", "final", "return", "void", "class",
  "string", "boolean", "int", "long", "list", "map", "set", "object", "overrid", "import", "packag"]);

const MIN_STEM_LENGTH = 3;

const readStem = word => {
  let stem = word.toLowerCase();
  for (const suffix of SUFFIXES) {
    if (stem.length > suffix.length + 2 && stem.endsWith(suffix)) { stem = stem.slice(0, -suffix.length); break; }
  }
  return stem.endsWith("e") ? stem.slice(0, -1) : stem;
};

const carriesMeaning = stem => stem.length >= MIN_STEM_LENGTH && !WORDS_THAT_NAME_NOTHING.has(stem);

export function collectStems(name) {
  const found = new Set();
  for (const word of splitNameWords(name)) {
    const stem = readStem(word);
    if (carriesMeaning(stem)) found.add(stem);
  }
  return [...found];
}

export const findSharedStems = (stems, name) => collectStems(name).filter(stem => stems.has(stem));
