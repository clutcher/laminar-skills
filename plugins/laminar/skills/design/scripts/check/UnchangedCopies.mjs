import path from "node:path";
import { isAText, isMarkedUnchanged, readList } from "../model/DesignModel.mjs";
import { TOKEN_KINDS, isTheMark, isTheName, readCodeTokens } from "./CodeText.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";
import { readTreeFileOfTheClass } from "./LiteralTables.mjs";

// The languages whose method bodies stand in braces, by the extension of the file; the check reads no other body of the current tree.
const BRACE_LANGUAGE_EXTENSIONS = new Set([".java", ".kt", ".kts", ".scala", ".groovy", ".cs", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".mts", ".cts"]);

const TYPE_WORDS = new Set(["class", "interface", "record", "enum", "object"]);

// The marks that only group, close or separate code, so a line of them and of fewer than 3 other tokens, such as a closing brace or return member, carries no decision.
const GROUPING_MARKS = new Set(["{", "}", "(", ")", "[", "]", ";", ","]);

const DECISION_TOKENS_OF_A_LINE = 3;

const COPIED_LINES_OF_A_COPY = 2;

// The tokens before a name that make it a call or a value, never the declaration of a method.
const CALLING_TOKENS = new Set([".", "?.", "new", "=", "return", "@"]);

const isABraceLanguage = file => BRACE_LANGUAGE_EXTENSIONS.has(path.extname(String(file || "")));

const findTheClose = (tokens, openAt) => {
  const open = tokens[openAt].text;
  const close = { "{": "}", "(": ")" }[open];
  let depth = 0;
  for (let at = openAt; at < tokens.length; at += 1) {
    if (isTheMark(tokens[at], open)) depth += 1;
    else if (isTheMark(tokens[at], close)) {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return tokens.length;
};

// The tokens of the body of the class of that name, or of the whole file where it declares no such class, such as a file of functions.
const readClassTokens = (tokens, className) => {
  const simpleName = className.split(".").pop();
  const declarationAt = tokens.findIndex((token, at) => token.kind === TOKEN_KINDS.NAME && TYPE_WORDS.has(token.text) && isTheName(tokens[at + 1], simpleName));
  if (declarationAt < 0) return tokens;

  let parenthesisDepth = 0;
  for (let at = declarationAt; at < tokens.length; at += 1) {
    if (isTheMark(tokens[at], "(")) parenthesisDepth += 1;
    else if (isTheMark(tokens[at], ")")) parenthesisDepth -= 1;
    else if (parenthesisDepth === 0 && isTheMark(tokens[at], "{")) return tokens.slice(at + 1, findTheClose(tokens, at));
  }
  return [];
};

const isAMethodDeclarationAt = (tokens, at, methodName) => isTheName(tokens[at], methodName) && isTheMark(tokens[at + 1], "(") && !CALLING_TOKENS.has(tokens[at - 1]?.text);

// A line after the parameters that goes on with the head, as a brace on its own line or a throws clause does; any other line starts the next member.
const HEAD_GOING_ON_TOKENS = new Set(["{", "throws", ":"]);

const isTheEndOfTheHead = (tokens, at) => {
  if (tokens[at].kind !== TOKEN_KINDS.LINE_END) return false;

  const next = tokens.slice(at + 1).find(token => token.kind !== TOKEN_KINDS.LINE_END);
  return !next || !HEAD_GOING_ON_TOKENS.has(next.text);
};

// The tokens of the body that follows the parameters closed at that index: a block in braces, or an expression after = up to its line end; none where a semicolon or the line end ends a declaration with no body.
const readBodyTokensAfter = (tokens, parametersEnd) => {
  for (let at = parametersEnd + 1; at < tokens.length; at += 1) {
    if (isTheMark(tokens[at], "{")) return tokens.slice(at + 1, findTheClose(tokens, at));
    if (isTheMark(tokens[at], ";") || isTheEndOfTheHead(tokens, at)) return [];
    if (isTheMark(tokens[at], "=")) {
      const lineEnd = tokens.findIndex((token, later) => later > at && token.kind === TOKEN_KINDS.LINE_END);
      return tokens.slice(at + 1, lineEnd < 0 ? tokens.length : lineEnd);
    }
  }
  return [];
};

// The bodies of each method of that name that the class declares at its own depth, so an overload of the name counts as the same unchanged method.
const listDeclaredBodyTokens = (classTokens, methodName) => {
  const bodies = [];
  let depth = 0;
  for (let at = 0; at < classTokens.length; at += 1) {
    if (isTheMark(classTokens[at], "{")) depth += 1;
    else if (isTheMark(classTokens[at], "}")) depth -= 1;
    else if (depth === 0 && isAMethodDeclarationAt(classTokens, at, methodName)) {
      const parametersEnd = findTheClose(classTokens, at + 1);
      bodies.push(readBodyTokensAfter(classTokens, parametersEnd));
      at = parametersEnd;
    }
  }
  return bodies;
};

const isADecisionLine = lineTokens => lineTokens.filter(token => !GROUPING_MARKS.has(token.text)).length >= DECISION_TOKENS_OF_A_LINE;

// The lines of a body that carry a decision, each with its key, its tokens joined by 1 space, so the indent, the spacing and the comments never decide a match, and with its text as the body writes it.
const listDecisionLines = (tokens, text) => {
  const lines = [[]];
  for (const token of tokens) {
    if (token.kind === TOKEN_KINDS.LINE_END) lines.push([]);
    else lines[lines.length - 1].push(token);
  }
  return lines.filter(isADecisionLine).map(lineTokens => {
    const lastToken = lineTokens[lineTokens.length - 1];
    return { key: lineTokens.map(token => token.text).join(" "), text: text.slice(lineTokens[0].at, lastToken.at + lastToken.text.length) };
  });
};

// The longest run of lines that stands, line after line, in both lists, as the lines of the first list.
const findLongestSharedRun = (lines, otherLines) => {
  let longestRun = [];
  for (let start = 0; start < lines.length; start += 1) {
    for (let otherStart = 0; otherStart < otherLines.length; otherStart += 1) {
      let length = 0;
      while (start + length < lines.length && otherStart + length < otherLines.length && lines[start + length].key === otherLines[otherStart + length].key) length += 1;
      if (length > longestRun.length) longestRun = lines.slice(start, start + length);
    }
  }
  return longestRun;
};

const listUnchangedBodies = (model, theClass, currentTree) => {
  const file = readTreeFileOfTheClass(model, theClass);
  const text = isABraceLanguage(file) ? currentTree.readFileText(file) : null;
  if (!isAText(text)) return [];

  const classTokens = readClassTokens(readCodeTokens(text, file), theClass.name);
  return readList(theClass.methods).filter(isMarkedUnchanged).map(method => ({
    method,
    lines: listDeclaredBodyTokens(classTokens, method.name).flatMap(bodyTokens => listDecisionLines(bodyTokens, text)),
  }));
};

const isAPrivatePartWithABody = method => method.visibility === "private" && !isMarkedUnchanged(method) && isAText(method.body);

const describeTheCopy = (model, theClass, part, unchanged, copiedLines) => `${model.getMethodDisplayName(theClass, part)} copies ${copiedLines.length} lines of ${model.getMethodDisplayName(theClass, unchanged)}, which the model marks unchanged, from \`${copiedLines[0].text}\`: give the lines 1 owner and take ${unchanged.name} into the change, or say why the 2 copies stay apart`;

// A private part of the model whose body copies 2 or more lines of a method of its class that the model marks unchanged, read in the current tree, writes 1 decision twice, and a writer who finds the copy can only fix it by changing the unchanged method. It is a recheck case, because 2 equal lines can be 2 rules.
export const findUnchangedCopyDefects = (model, currentTree) => {
  if (!currentTree) return [];

  const defects = [];
  for (const theClass of model.classes) {
    const parts = readList(theClass.methods).filter(isAPrivatePartWithABody);
    if (!parts.length || !isAText(theClass.file) || !readList(theClass.methods).some(isMarkedUnchanged)) continue;

    const unchangedBodies = listUnchangedBodies(model, theClass, currentTree);
    for (const part of parts) {
      const partLines = listDecisionLines(readCodeTokens(part.body, theClass.file), part.body);
      for (const unchangedBody of unchangedBodies) {
        const copiedLines = findLongestSharedRun(partLines, unchangedBody.lines);
        if (copiedLines.length >= COPIED_LINES_OF_A_COPY) defects.push(createRecheckDefect(DEFECT_CODES.COPIES_AN_UNCHANGED_METHOD, model.getMethodPath(theClass, part), describeTheCopy(model, theClass, part, unchangedBody.method, copiedLines)));
      }
    }
  }
  return defects;
};
