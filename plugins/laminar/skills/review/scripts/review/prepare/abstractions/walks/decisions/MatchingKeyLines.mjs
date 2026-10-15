import { escapeForAPattern, findClosingParenthesis, findUnmatchedOpenerBefore, splitAtTopLevelCommas, STRING_LITERAL_PATTERN } from "../../../../../code/index.mjs";

const NAME_SOURCE = "[A-Za-z_$][\\w$]*";

const BARE_NAME_PATTERN = new RegExp(`^${NAME_SOURCE}$`);

const NAMED_ARGUMENT_PATTERN = new RegExp(`^\\s*(${NAME_SOURCE})\\s*(?:=(?![=>])|:(?!:))\\s*([\\s\\S]*)$`);

const GROWING_SIZE_PATTERN = /\.\s*(?:size|length|count)\b|(?<![\w$.])(?:len|count)\s*\(/;

const COUNTER_STEP_PATTERN = /\+\+|--|\+=\s*1(?![\d.])|\b(?:incrementAndGet|getAndIncrement)\b/;

const LOOP_INDEX_PATTERNS = [
  new RegExp(`\\bfor\\s*\\(\\s*(?:[\\w$]+\\s+)?(${NAME_SOURCE})\\s*(?::\\s*[\\w$]+\\s*)?=\\s*0\\b`),
  new RegExp(`\\bfor\\s+(${NAME_SOURCE})\\s+in\\s+(?:range\\s*\\(|0\\s*\\.\\.|[\\w$.]+\\.indices\\b)`),
  new RegExp(`\\bfor\\s*\\(?\\s*(${NAME_SOURCE})\\s*,\\s*${NAME_SOURCE}\\s*\\)?\\s+in\\s+enumerate\\s*\\(`),
  new RegExp(`\\bfor\\s+(${NAME_SOURCE})\\s*,\\s*${NAME_SOURCE}\\s*:?=\\s*range\\b`),
  new RegExp(`\\bfor\\s*\\(\\s*\\(?\\s*(${NAME_SOURCE})\\s*,\\s*${NAME_SOURCE}\\s*\\)?\\s+in\\b.*\\b(?:withIndex|enumerate|enumerated)\\s*\\(`),
  new RegExp(`\\b(?:forEachIndexed|mapIndexed)\\s*\\{\\s*\\(?\\s*(${NAME_SOURCE})\\s*,`),
];

const CONSTRUCTION_SOURCE = "(?:\\bnew\\s+|(?<![\\w$.:]))";

const TYPE_ARGUMENTS_SOURCE = "(?:<[^()]*>)?";

const ANY_CONSTRUCTION_PATTERN = new RegExp(`${CONSTRUCTION_SOURCE}([A-Z][\\w$]*)\\s*${TYPE_ARGUMENTS_SOURCE}\\s*\\(`, "g");

const ADDED_TO_A_COLLECTION_BEFORE_PATTERN = new RegExp(`(${NAME_SOURCE})\\s*\\.\\s*(?:add|addLast|append|push|offer|insert)\\s*\\(\\s*$`);

const ASSIGNED_AT_THE_START_PATTERN = new RegExp(`^\\s*(?:[\\w$.<>\\[\\],?\\s]+\\s+)?(${NAME_SOURCE})\\s*(?::[^=]*)?=(?![=>])`);

const LOOKUP_WORDS = new Set(["get", "getOrDefault", "getOrElse", "getOrNull", "getOrThrow", "getValue", "TryGetValue", "fetch", "find", "findFirst", "findAny", "first", "firstOrNull", "firstWhere", "FirstOrDefault", "Single", "filter", "Where", "lookup", "index", "indexOf", "at", "remove", "pop", "next"]);

const WORDS_THAT_PASS_NOTHING_OUT = new Set(["for", "foreach", "if", "while", "switch", "return", "len", "size", "count", "range", "enumerate", "iter", "list", "sorted", "print", "println", "assert", "require"]);

const MAX_STATEMENT_LINES = 6;

const MAX_ENCLOSING_STEPS = 4;

const OPENERS = "([{";

const COMMAS_OUTSIDE_THESE = { openers: OPENERS };

const TEXT_STANDING_IN = "\"\"";

const readCode = text => String(text).replace(STRING_LITERAL_PATTERN, TEXT_STANDING_IN);

const capitalize = word => word.charAt(0).toUpperCase() + word.slice(1);

const buildWordUsePattern = name => new RegExp(`(?<![\\w$.])${escapeForAPattern(name)}(?![\\w$])`);

const buildMemberReadPattern = member => new RegExp(`\\??\\.\\s*(?:${escapeForAPattern(member)}|get${escapeForAPattern(capitalize(member))})(?![\\w$])(?!\\s*=(?![=>]))|\\[\\s*["']${escapeForAPattern(member)}["']\\s*\\]`, "g");

const readTheStatementFrom = (body, index) => {
  const texts = [body[index].text];
  for (let next = index + 1; next < body.length && next - index < MAX_STATEMENT_LINES; next++) texts.push(body[next].text);
  return texts.join(" ");
};

export const collectLoopIndexNames = body => new Set(body.flatMap(({ text }) => LOOP_INDEX_PATTERNS.map(pattern => pattern.exec(readCode(text))).filter(Boolean).map(found => found[1])));

export const isAMadeUpValue = (text, loopIndexNames) => {
  const code = readCode(text);
  return GROWING_SIZE_PATTERN.test(code) || COUNTER_STEP_PATTERN.test(code) || [...loopIndexNames].some(name => buildWordUsePattern(name).test(code));
};

const readArgumentsAfter = (code, opening) => {
  const closing = findClosingParenthesis(code, opening, OPENERS);
  return closing < 0 ? null : splitAtTopLevelCommas(code.slice(opening + 1, closing), COMMAS_OUTSIDE_THESE);
};

const readArgumentOfTheMember = (pieces, members, member) => {
  const named = pieces.map(piece => NAMED_ARGUMENT_PATTERN.exec(piece));
  if (named.some(Boolean)) {
    const found = named.find(match => match && match[1] === member);
    return found ? found[2].trim() : "";
  }
  const position = members.indexOf(member);
  return position >= 0 && position < pieces.length ? pieces[position].trim() : "";
};

const findConstructionFills = (code, typeName, members, member) => {
  const pattern = new RegExp(`${CONSTRUCTION_SOURCE}${escapeForAPattern(typeName)}\\s*${TYPE_ARGUMENTS_SOURCE}\\s*\\(`, "g");
  return [...code.matchAll(pattern)].map(found => {
    const pieces = readArgumentsAfter(code, found.index + found[0].length - 1);
    return pieces ? readArgumentOfTheMember(pieces, members, member) : "";
  }).filter(Boolean);
};

const findStepFills = (code, member) => {
  const step = new RegExp(`\\.\\s*(?:${escapeForAPattern(member)}|set${escapeForAPattern(capitalize(member))}|with${escapeForAPattern(capitalize(member))})\\s*\\(`, "g");
  const assigned = new RegExp(`(?:\\.\\s*${escapeForAPattern(member)}|\\[\\s*["']${escapeForAPattern(member)}["']\\s*\\])\\s*=(?![=>])\\s*([^;]+?)\\s*;?\\s*$`);
  const literal = new RegExp(`[{,]\\s*${escapeForAPattern(member)}\\s*:\\s*([^,}]+)`);
  const byAStep = [...code.matchAll(step)].map(found => readArgumentsAfter(code, found.index + found[0].length - 1)).filter(pieces => pieces && pieces.length === 1).map(pieces => pieces[0].trim());
  const byAssignment = assigned.exec(code);
  const byALiteral = literal.exec(code);
  return [...byAStep, ...(byAssignment ? [byAssignment[1]] : []), ...(byALiteral ? [byALiteral[1].trim()] : [])].filter(Boolean);
};

export const findMemberFills = (body, type, member) => {
  const namesTheType = body.some(({ text }) => buildWordUsePattern(type.name).test(text));
  if (!namesTheType) return [];
  return body.flatMap(({ line }, index) => {
    const code = body[index].text;
    const firstLineCode = readCode(code);
    const statement = readTheStatementFrom(body, index);
    const constructions = buildWordUsePattern(type.name).test(firstLineCode) ? findConstructionFills(statement, type.name, type.members, member) : [];
    const values = constructions.length ? constructions : findStepFills(code, member);
    return values.map(value => ({ line, value }));
  });
};

const ASSIGNMENT_OF = name => new RegExp(`(?<![\\w$.])${escapeForAPattern(name)}\\s*(?::[^=]*)?=(?![=>])\\s*(.+?)\\s*;?\\s*$`);

export const resolveTheValue = (body, fill, loopIndexNames) => {
  const value = fill.value.trim();
  if (!BARE_NAME_PATTERN.test(value) || loopIndexNames.has(value)) return { text: value, line: fill.line };
  const assignment = ASSIGNMENT_OF(value);
  const earlier = body.filter(({ line }) => line <= fill.line).reverse();
  for (const { line, text } of earlier) {
    const found = assignment.exec(text);
    if (found) return { text: found[1], line, name: value };
  }
  return { text: value, line: fill.line };
};

const isAnIndexAccessAt = (code, opening) => /[\w$)\]]\s*$/.test(code.slice(0, opening));

const readTheWordBefore = (code, opening) => {
  const word = /([A-Za-z_$][\w$]*)\s*$/.exec(code.slice(0, opening));
  return word ? word[1] : "";
};

const sitsInsideALookup = (code, at) => {
  let from = at;
  for (let step = 0; step < MAX_ENCLOSING_STEPS; step++) {
    const opening = findUnmatchedOpenerBefore(code, from, "([");
    if (opening < 0) return false;
    if (code[opening] === "[" && isAnIndexAccessAt(code, opening)) return true;
    if (code[opening] === "(" && LOOKUP_WORDS.has(readTheWordBefore(code, opening))) return true;
    from = opening;
  }
  return false;
};

export const findLookupsBy = (body, members) => body.filter(({ text }) => members.some(member => [...String(text).matchAll(buildMemberReadPattern(member))].some(read => sitsInsideALookup(String(text), read.index))));

export const findLinesUsingTheName = (body, name) => body.filter(({ text }) => buildWordUsePattern(name).test(readCode(text)));

const readTheCollectionOf = (code, constructionAt) => {
  const added = ADDED_TO_A_COLLECTION_BEFORE_PATTERN.exec(code.slice(0, constructionAt));
  if (added) return added[1];
  const assigned = ASSIGNED_AT_THE_START_PATTERN.exec(code);
  return assigned ? assigned[1] : "";
};

export const findConstructionsWithAMadeUpValue = (body, loopIndexNames, findTheType) => body.flatMap(({ line, text }) => {
  const code = readCode(text);
  return [...code.matchAll(ANY_CONSTRUCTION_PATTERN)].flatMap(found => {
    const type = findTheType(found[1]);
    const pieces = type ? readArgumentsAfter(code, found.index + found[0].length - 1) : null;
    if (!pieces) return [];
    const collection = readTheCollectionOf(code, found.index);
    return type.members
      .map(member => ({ member, value: readArgumentOfTheMember(pieces, type.members, member) }))
      .filter(({ value }) => value && isAMadeUpValue(value, loopIndexNames))
      .map(({ member }) => ({ line, typeName: type.name, member, collection }));
  });
});

const passesTheNameOutAt = (code, at) => {
  const opening = findUnmatchedOpenerBefore(code, at, "(");
  return opening >= 0 && !WORDS_THAT_PASS_NOTHING_OUT.has(readTheWordBefore(code, opening));
};

export const findTheLinePassingOut = (body, name, afterLine) => body.find(({ line, text }) => {
  if (line <= afterLine) return false;
  const code = readCode(text);
  const pattern = new RegExp(`(?<![\\w$.])${escapeForAPattern(name)}(?![\\w$])(?!\\s*[.[(])`, "g");
  return [...code.matchAll(pattern)].some(use => passesTheNameOutAt(code, use.index));
}) || null;
