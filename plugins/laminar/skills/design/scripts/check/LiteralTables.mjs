import { KINDS, getFileOfTheChild, isAText, isATestFileOfTheModel, isMarkedUnchanged, readList } from "../model/DesignModel.mjs";
import { isATableExtension } from "../model/SourceLanguages.mjs";
import { TOKEN_KINDS, isClosingMark, isOpeningMark, isTheMark, isTheName, readCodeTokens } from "./CodeText.mjs";

export const TABLE_FORMS = Object.freeze({ KEYED: "keyed", SET: "set" });

const ENTRIES_OF_A_TABLE = 2;

// The constant of a closed set, as MemberTier.GOLD, or a bare constant, as GOLD after case.
const CLOSED_SET_MEMBER = /^(?:([A-Z][\w$]*(?:\.[A-Z][\w$]*)*)\.)?([A-Z][A-Z\d_]*)$/;

// The calls that build a keyed table from pairs of a key and a value: Map.of and Map.entry of Java, and put of a Java or Kotlin map.
const PAIR_BUILDERS = new Set(["Map.of", "Map.entry", "put"]);

// The calls that build a literal set or list of values: Set.of, List.of and Arrays.asList of Java, setOf and listOf of Kotlin, frozenset, set and tuple of Python.
const SET_BUILDERS = new Set(["Set.of", "List.of", "Arrays.asList", "setOf", "listOf", "frozenset", "set", "tuple"]);

// The boolean literals of the read languages.
const BOOLEAN_WORDS = new Set(["true", "false", "True", "False"]);

// The numbers that every rule uses as a start, a step or a sign, so a set of them is no decision.
const PLAIN_NUMBERS = new Set(["0", "1", "-1"]);

// The marks that end a literal value inside a table.
const VALUE_ENDS = new Set([",", ";", ")", "}", "]"]);

const readNameChain = (tokens, start) => {
  if (tokens[start]?.kind !== TOKEN_KINDS.NAME) return null;

  const names = [tokens[start].text];
  let at = start + 1;
  while (isTheMark(tokens[at], ".") && tokens[at + 1]?.kind === TOKEN_KINDS.NAME) {
    names.push(tokens[at + 1].text);
    at += 2;
  }
  return { text: names.join("."), end: at };
};

const readClosedSetMember = (tokens, start) => {
  const chain = readNameChain(tokens, start);
  const member = chain && CLOSED_SET_MEMBER.exec(chain.text);
  return member ? { closedSetName: member[1] || "", member: member[2], end: chain.end } : null;
};

const endsTheValue = token => !token || token.kind === TOKEN_KINDS.LINE_END || (token.kind === TOKEN_KINDS.MARK && VALUE_ENDS.has(token.text));

// A string by its content in double quotes, so the same text in 2 kinds of quotes is 1 value.
const readStringContent = stringText => `"${stringText.replace(/^(?:"""|["'`])|(?:"""|["'`])$/g, "")}"`;

// A literal value of a table: a number with its sign, a string or a boolean, which the next mark ends.
const readLiteralValue = (tokens, start) => {
  const sign = isTheMark(tokens[start], "-") ? "-" : "";
  const token = tokens[start + sign.length];
  if (!token) return null;

  const isALiteral = token.kind === TOKEN_KINDS.NUMBER || (!sign && (token.kind === TOKEN_KINDS.TEXT || BOOLEAN_WORDS.has(token.text)));
  if (!isALiteral || !endsTheValue(tokens[start + sign.length + 1])) return null;
  return { text: token.kind === TOKEN_KINDS.TEXT ? readStringContent(token.text) : `${sign}${token.text}`, kind: token.kind, end: start + sign.length + 1 };
};

const skipLineEnds = (tokens, start) => {
  let at = start;
  while (tokens[at]?.kind === TOKEN_KINDS.LINE_END) at += 1;
  return at;
};

const createEntry = (groupAt, key, value) => ({ groupAt, closedSetName: key.closedSetName, member: key.member, value: value.text });

// [E.K]: v of JavaScript and TypeScript.
const readComputedKeyEntry = (tokens, at, enclosingAt) => {
  if (!isTheMark(tokens[at], "[")) return null;
  const key = readClosedSetMember(tokens, at + 1);
  if (!key || !key.closedSetName || !isTheMark(tokens[key.end], "]") || !isTheMark(tokens[key.end + 1], ":")) return null;
  const value = readLiteralValue(tokens, key.end + 2);
  return value ? [createEntry(enclosingAt, key, value)] : null;
};

// E.K: v of a Python dict, E.K to v of Kotlin, and E.K -> v of a Kotlin when.
const readNamedKeyEntry = (tokens, at, enclosingAt) => {
  const before = tokens[at - 1];
  if (before && !(isOpeningMark(before) || isTheMark(before, ",") || before.kind === TOKEN_KINDS.LINE_END)) return null;
  const key = readClosedSetMember(tokens, at);
  if (!key || !key.closedSetName) return null;

  const separator = tokens[key.end];
  const isASeparator = isTheMark(separator, ":") || isTheName(separator, "to") || isTheMark(separator, "->");
  const value = isASeparator ? readLiteralValue(tokens, key.end + 1) : null;
  return value ? [createEntry(enclosingAt, key, value)] : null;
};

// case K -> v, case E.K -> v, case A, B -> v, and case K: return v of Java, Kotlin, JavaScript, TypeScript and Python.
const readCaseEntries = (tokens, at, enclosingAt) => {
  if (!isTheName(tokens[at], "case")) return null;

  const keys = [];
  let next = at + 1;
  for (let key = readClosedSetMember(tokens, next); key; key = isTheMark(tokens[next], ",") ? readClosedSetMember(tokens, next + 1) : null) {
    keys.push(key);
    next = key.end;
  }
  if (!keys.length) return null;

  let valueAt = next + 1;
  if (isTheMark(tokens[next], ":")) {
    valueAt = skipLineEnds(tokens, next + 1);
    if (!isTheName(tokens[valueAt], "return")) return null;
    valueAt += 1;
  } else if (!isTheMark(tokens[next], "->")) return null;

  const value = readLiteralValue(tokens, valueAt);
  return value ? keys.map(key => createEntry(enclosingAt, key, value)) : null;
};

const findClosingMark = (tokens, openAt) => {
  let depth = 0;
  for (let at = openAt; at < tokens.length; at += 1) {
    if (isOpeningMark(tokens[at])) depth += 1;
    if (isClosingMark(tokens[at])) depth -= 1;
    if (depth === 0) return at;
  }
  return tokens.length;
};

// The arguments of a call, each a list of tokens with no line end.
const readArguments = (tokens, openAt) => {
  const closeAt = findClosingMark(tokens, openAt);
  const argumentList = [[]];
  let depth = 0;
  for (let at = openAt + 1; at < closeAt; at += 1) {
    const token = tokens[at];
    if (isOpeningMark(token)) depth += 1;
    if (isClosingMark(token)) depth -= 1;
    if (depth === 0 && isTheMark(token, ",")) argumentList.push([]);
    else if (token.kind !== TOKEN_KINDS.LINE_END) argumentList[argumentList.length - 1].push(token);
  }
  return argumentList.filter(argumentTokens => argumentTokens.length);
};

const readWholeMember = argumentTokens => {
  const key = readClosedSetMember(argumentTokens, 0);
  return key && key.closedSetName && key.end === argumentTokens.length ? key : null;
};

const readWholeValue = argumentTokens => {
  const value = readLiteralValue([...argumentTokens, { kind: TOKEN_KINDS.MARK, text: ")" }], 0);
  return value && value.end === argumentTokens.length ? value : null;
};

const readPairBuilder = chainText => [...PAIR_BUILDERS].find(builder => chainText === builder || chainText.endsWith(`.${builder}`)) || "";

// Map.of(E.K, v, E.L, w), Map.entry(E.K, v) and map.put(E.K, v) of Java and Kotlin: the arguments in pairs of a key and a value.
const readPairEntries = (tokens, at, enclosingAt) => {
  const chain = readNameChain(tokens, at);
  if (!chain || isTheMark(tokens[at - 1], ".") || !isTheMark(tokens[chain.end], "(")) return null;
  const builder = readPairBuilder(chain.text);
  if (!builder) return null;

  const argumentList = readArguments(tokens, chain.end);
  const groupAt = builder === "Map.of" ? chain.end : enclosingAt;
  const entries = [];
  for (let pairAt = 0; pairAt + 1 < argumentList.length; pairAt += 2) {
    const key = readWholeMember(argumentList[pairAt]);
    const value = readWholeValue(argumentList[pairAt + 1]);
    if (key && value) entries.push(createEntry(groupAt, key, value));
  }
  return entries.length ? entries : null;
};

// [E.K, v] of a JavaScript or TypeScript Map built from a list of pairs.
const readListPairEntry = (tokens, at, enclosingAt) => {
  const before = tokens[at - 1];
  const startsAPair = isTheMark(tokens[at], "[") && (isTheMark(before, "[") || isTheMark(before, ",") || before?.kind === TOKEN_KINDS.LINE_END);
  if (!startsAPair) return null;

  const pair = readArguments(tokens, at);
  const key = pair.length === 2 ? readWholeMember(pair[0]) : null;
  const value = key ? readWholeValue(pair[1]) : null;
  return value ? [createEntry(enclosingAt, key, value)] : null;
};

const ENTRY_READERS = [readComputedKeyEntry, readListPairEntry, readCaseEntries, readPairEntries, readNamedKeyEntry];

const listTableEntries = (tokens, enclosingAts) => {
  const entries = [];
  for (let at = 0; at < tokens.length; at += 1) {
    for (const readEntries of ENTRY_READERS) {
      const read = readEntries(tokens, at, enclosingAts[at]);
      if (!read) continue;
      entries.push(...read);
      break;
    }
  }
  return entries;
};

// The innermost open bracket around each token, or -1 outside every bracket.
const listEnclosingAts = tokens => {
  const openAts = [];
  return tokens.map((token, at) => {
    const enclosingAt = openAts.length ? openAts[openAts.length - 1] : -1;
    if (isOpeningMark(token)) openAts.push(at);
    if (isClosingMark(token)) openAts.pop();
    return enclosingAt;
  });
};

// The name a statement declares for the table that opens at the bracket: the name before =, or before the : of its type.
const readDeclaredName = (tokens, openAt) => {
  let depth = 0;
  for (let at = openAt - 1; at >= 0; at -= 1) {
    const token = tokens[at];
    if (isClosingMark(token)) depth += 1;
    if (isOpeningMark(token)) depth -= 1;
    // The parenthesis of a call that builds the table, as Object.freeze( or Map.of(, stands between the table and its name.
    if (depth < 0 && isTheMark(token, "(") && tokens[at - 1]?.kind === TOKEN_KINDS.NAME) depth = 0;
    if (depth < 0 || (depth === 0 && (isTheMark(token, ";") || token.kind === TOKEN_KINDS.LINE_END))) return "";
    if (depth !== 0 || !isTheMark(token, "=")) continue;

    let colonAt = -1;
    for (let before = at - 1; before >= 0 && !isTheMark(tokens[before], ";") && tokens[before].kind !== TOKEN_KINDS.LINE_END && !isOpeningMark(tokens[before]) && !isClosingMark(tokens[before]); before -= 1) {
      if (isTheMark(tokens[before], ":")) colonAt = before;
    }
    const nameToken = colonAt > 0 ? tokens[colonAt - 1] : tokens[at - 1];
    return nameToken?.kind === TOKEN_KINDS.NAME ? nameToken.text : "";
  }
  return "";
};

const createKeyedTable = (tokens, groupAt, entries) => {
  const closedSetName = entries.map(entry => entry.closedSetName).find(Boolean) || "";
  const valueOfMemberMap = new Map();
  for (const entry of entries) {
    if (entry.closedSetName && entry.closedSetName !== closedSetName) continue;
    if (!valueOfMemberMap.has(entry.member)) valueOfMemberMap.set(entry.member, entry.value);
  }
  return { form: TABLE_FORMS.KEYED, closedSetName, valueOfMemberMap, declaredName: groupAt >= 0 ? readDeclaredName(tokens, groupAt) : "" };
};

const listKeyedTables = (tokens, enclosingAts) => {
  const entriesOfGroupMap = new Map();
  for (const entry of listTableEntries(tokens, enclosingAts)) entriesOfGroupMap.set(entry.groupAt, [...(entriesOfGroupMap.get(entry.groupAt) || []), entry]);
  return [...entriesOfGroupMap]
    .map(([groupAt, entries]) => createKeyedTable(tokens, groupAt, entries))
    .filter(table => table.valueOfMemberMap.size >= ENTRIES_OF_A_TABLE);
};

// A bracket that opens a literal list or set: a [ that indexes nothing, a { of a Python set or a Java array, or the ( of a call that builds a set or a list.
const opensALiteralCollection = (tokens, openAt) => {
  const opening = tokens[openAt].text;
  const before = tokens[openAt - 1];
  if (opening === "[") return !before || !(before.kind === TOKEN_KINDS.NAME || isTheMark(before, ")") || isTheMark(before, "]"));
  if (opening === "{") return true;

  let chainStart = openAt - 1;
  while (chainStart >= 2 && isTheMark(tokens[chainStart - 1], ".") && tokens[chainStart - 2]?.kind === TOKEN_KINDS.NAME) chainStart -= 2;
  const chain = readNameChain(tokens, chainStart);
  return Boolean(chain) && chain.end === openAt && SET_BUILDERS.has(chain.text);
};

const isADecisionValue = value => value.kind === TOKEN_KINDS.TEXT || !PLAIN_NUMBERS.has(value.text);

// The values of a literal collection, where it holds 2 or more literals of 1 kind, none of them a plain number, and nothing else.
const readSetValues = (tokens, openAt) => {
  const values = readArguments(tokens, openAt).map(readWholeValue);
  if (values.length < ENTRIES_OF_A_TABLE || values.some(value => !value || !isADecisionValue(value))) return null;
  return values.every(value => value.kind === values[0].kind) ? values.map(value => value.text) : null;
};

const listLiteralSets = tokens => {
  const sets = [];
  tokens.forEach((token, openAt) => {
    if (!isOpeningMark(token) || !opensALiteralCollection(tokens, openAt)) return;
    const values = readSetValues(tokens, openAt);
    if (values) sets.push({ form: TABLE_FORMS.SET, values: [...new Set(values)].sort(), declaredName: readDeclaredName(tokens, openAt) });
  });
  return sets;
};

// The literal tables of a code text: each keyed table of 2 or more entries whose keys are constants of 1 closed set, and each literal set of 2 or more literals of 1 kind. The text inside quotes and the comments are no code, so a number of a message or of a comment counts for nothing.
export const readLiteralTables = (codeText, file) => {
  if (!isAText(codeText) || !isATableExtension(file)) return [];

  const tokens = readCodeTokens(codeText, file);
  return [...listKeyedTables(tokens, listEnclosingAts(tokens)), ...listLiteralSets(tokens)];
};

const KINDS_OF_A_TREE_FILE = new Set([KINDS.UNCHANGED, KINDS.MODIFIED, KINDS.MOVED]);

const readTreeFileOfTheChild = (folder, child) => (child.kind === KINDS.MOVED && isAText(child.oldPath) ? child.oldPath : getFileOfTheChild(folder, child));

// The names of the tables that the model moves or removes out of each tree file, by removed of a class of that file and removedClasses of its child.
const listRemovedNamesOfTheFile = (model, file, child) => new Set([
  ...model.classes.filter(theClass => theClass.file === file || readTreeFileOfTheClass(model, theClass) === file).flatMap(theClass => readList(theClass.removed)),
  ...readList(child?.removedClasses),
]);

export const readTreeFileOfTheClass = (model, theClass) => {
  const child = model.findChildOfTheFile(theClass.file);
  return child && isAText(child.oldPath) ? child.oldPath : theClass.file;
};

const listTreeFilesOfTheModel = model => {
  const childOfFileMap = new Map();
  for (const folder of model.folders) {
    for (const child of readList(folder.children)) {
      if (KINDS_OF_A_TREE_FILE.has(child.kind)) childOfFileMap.set(readTreeFileOfTheChild(folder, child), child);
    }
  }
  for (const theClass of model.classes) {
    if (KINDS_OF_A_TREE_FILE.has(model.getKindOfClass(theClass)) && isAText(theClass.file)) {
      const file = readTreeFileOfTheClass(model, theClass);
      if (!childOfFileMap.has(file)) childOfFileMap.set(file, model.findChildOfTheFile(theClass.file));
    }
  }
  return childOfFileMap;
};

// The tables of each file of the current tree that the model names, by a child of a folder or by a class, that is unchanged, modified or moved; a test file and a table that the model removes from its class are left out.
export const listTreeTables = (model, currentTree) => {
  const treeTables = [];
  for (const [file, child] of listTreeFilesOfTheModel(model)) {
    if (!isATableExtension(file) || isATestFileOfTheModel(model, file) || !currentTree.holdsTheFile(file)) continue;

    const removedNames = listRemovedNamesOfTheFile(model, file, child);
    const tables = readLiteralTables(currentTree.readFileText(file), file).filter(table => !removedNames.has(table.declaredName));
    if (tables.length) treeTables.push({ file, tables });
  }
  return treeTables;
};

// The tables of each body of a class of the model outside a test file, with the class and the method that hold it.
export const listBodyTables = model => {
  const bodyTables = [];
  for (const { theClass, method, displayName } of model.listMethodsWithClass()) {
    if (!isAText(method.body) || isMarkedUnchanged(method) || isATestFileOfTheModel(model, theClass.file)) continue;

    const tables = readLiteralTables(method.body, theClass.file);
    if (tables.length) bodyTables.push({ theClass, method, displayName, tables });
  }
  return bodyTables;
};

const readLastName = name => String(name || "").split(".").pop();

export const isKeyedByTheClosedSet = (table, closedSetName) => table.form === TABLE_FORMS.KEYED && readLastName(table.closedSetName) === readLastName(closedSetName);
