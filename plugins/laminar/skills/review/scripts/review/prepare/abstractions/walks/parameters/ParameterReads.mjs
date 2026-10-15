import { isAConstructor } from "../../lookups/MethodParameters.mjs";
import { findDriver, escapeForAPattern, EVERY_OPENER_AND_ANGLE, ONLY_PARENTHESES, isAFileWithBehavior, readLanguageFamily, readParameterNamesOfAList, readParameterTextOfTheHead, readTypeTextOfParameter, splitAtTopLevelCommas, formatDisplayNameOfMethod, findUnmatchedOpenerBefore, findParameterListAfterTheName, findElementType, parseType, parseTypeArguments } from "../../../../../code/index.mjs";
import { ParameterNamesInTheBody, readTheContinuedText, removeTheLambdaHeads } from "./ParameterNamesInTheBody.mjs";

export const MAX_FORWARD_STEPS = 3;

const OPENERS = EVERY_OPENER_AND_ANGLE;

const CLOSERS = ")>]}";

const capitalize = word => word.charAt(0).toUpperCase() + word.slice(1);

const readParameterText = (lines, method) => readParameterTextOfTheHead(lines, method, lines.length);

const splitParameterDeclarations = text => {
  const pieces = splitAtTopLevelCommas(text);
  return pieces[pieces.length - 1].trim() ? pieces : pieces.slice(0, -1);
};

const MAX_ELEMENT_STEPS = 2;

const TYPE_TEXT_PREFIX_PATTERN = /^(?:[&*]\s*|(?:mut|readonly|const)\s+)+/;

const QUOTES_PATTERN = /^["']|["']$/g;

const cleanTheTypeText = typeText => String(typeText || "").trim().replace(TYPE_TEXT_PREFIX_PATTERN, "").replace(QUOTES_PATTERN, "");

const readTheElementTypeTexts = typeText => {
  const element = findElementType(typeText);
  if (element) return [element];
  const typeArguments = parseTypeArguments(typeText);
  return typeArguments.length ? [typeArguments[typeArguments.length - 1]] : [];
};

const WILDCARD_OR_VARIANCE_PATTERN = /^(?:\?\s*(?:extends|super)\s+|(?:out|in)\s+)/;

const namesTheTypeOrItsElement = (typeText, typeName, steps = 0) => {
  const cleaned = cleanTheTypeText(typeText).replace(WILDCARD_OR_VARIANCE_PATTERN, "");
  const type = parseType(cleaned);
  if (type && !type.collection && type.simple === typeName) return true;
  return steps < MAX_ELEMENT_STEPS && readTheElementTypeTexts(cleaned).some(element => namesTheTypeOrItsElement(element, typeName, steps + 1));
};

export const findParameterOfType = (parameterText, typeName, driver) => {
  if (!driver) return "";
  const matchingDeclaration = splitParameterDeclarations(parameterText).find(parameterDeclaration => namesTheTypeOrItsElement(readTypeTextOfParameter(parameterDeclaration, driver.diffDriver), typeName));
  return matchingDeclaration ? readParameterNamesOfAList(`(${matchingDeclaration})`, driver)[0] || "" : "";
};

const buildParameterMemberReadPattern = (parameter, member) => new RegExp(
  `(?<![\\w$])${escapeForAPattern(parameter)}\\s*[?!]?\\.\\s*(?:${escapeForAPattern(member)}|get${escapeForAPattern(capitalize(member))}|is${escapeForAPattern(capitalize(member))})(?![\\w$])`);

const buildWholeUsePattern = parameter => new RegExp(`(?<![\\w$.])${escapeForAPattern(parameter)}(?![\\w$])(?!\\s*[?!]?\\.)`);

const usesTheWholeValue = (names, text) => {
  const withoutLambdaHeads = removeTheLambdaHeads(text);
  return names.some(name => buildWholeUsePattern(name).test(withoutLambdaHeads));
};

const CONSTRUCTION_BEFORE_PATTERN = /(?:(?<![\w$.:])|\bnew\s+)([A-Z][\w$]*)\s*(?:<[^()]*>)?\s*$/;

const NAMED_ARGUMENT_PATTERN = /^\s*([A-Za-z_$][\w$]*)\s*(?:=(?!=)|:(?!:))/;

const readLastArgument = text => {
  let depth = 0;
  let position = 0;
  let start = 0;
  for (let at = 0; at < text.length; at++) {
    if (OPENERS.includes(text[at])) depth++;
    else if (CLOSERS.includes(text[at])) depth--;
    else if (text[at] === "," && depth === 0) { position++; start = at + 1; }
  }
  return { position, text: text.slice(start) };
};

const BUILDER_STEP_BEFORE_PATTERN = /[?!]?\.\s*([A-Za-z_$][\w$]*)\s*$/;

const BUILDER_START_PATTERN = /(?<![\w$.])([A-Z][\w$]*)\s*(?:\.|::)\s*(?:builder|newBuilder)\s*$/;

const TO_BUILDER_PATTERN = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*[?!]?\.\s*toBuilder\s*$/;

const NO_POSITION = -1;

const buildDeclaredTypePatterns = name => [
  new RegExp(`(?<![\\w$.])([A-Z][\\w$]*)(?:\\s*<[^<>()]*>)?\\s+${escapeForAPattern(name)}(?![\\w$])`),
  new RegExp(`(?<![\\w$.])${escapeForAPattern(name)}\\s*:\\s*([A-Z][\\w$]*)`),
];

const findTheDeclaredTypeOf = (text, name) => {
  for (const pattern of buildDeclaredTypePatterns(name)) {
    const declared = pattern.exec(text);
    if (declared) return declared[1];
  }
  return "";
};

const findTheTypeABuilderChainBuilds = (text, stepAt) => {
  for (let at = stepAt; ;) {
    const before = text.slice(0, at).trimEnd();
    if (!before.endsWith(")")) return "";
    const opening = findUnmatchedOpenerBefore(before, before.length - 1, ONLY_PARENTHESES);
    if (opening < 0) return "";
    const head = before.slice(0, opening);
    const start = BUILDER_START_PATTERN.exec(head);
    if (start) return start[1];
    const toBuilder = TO_BUILDER_PATTERN.exec(head);
    if (toBuilder) return findTheDeclaredTypeOf(text, toBuilder[1]);
    const step = BUILDER_STEP_BEFORE_PATTERN.exec(head);
    if (!step) return "";
    at = step.index;
  }
};

const findTheBuilderConstruction = (before, argument, text) => {
  const step = BUILDER_STEP_BEFORE_PATTERN.exec(before);
  if (!step || argument.position !== 0) return null;
  const typeName = findTheTypeABuilderChainBuilds(text, step.index);
  return typeName ? { typeName, position: NO_POSITION, name: step[1] } : null;
};

export const findTheEnclosingConstruction = (text, offset) => {
  const opening = findUnmatchedOpenerBefore(text, offset, EVERY_OPENER_AND_ANGLE);
  if (opening < 0 || text[opening] !== "(") return null;
  const before = text.slice(0, opening);
  const argument = readLastArgument(text.slice(opening + 1, offset));
  const built = CONSTRUCTION_BEFORE_PATTERN.exec(before);
  if (!built) return findTheBuilderConstruction(before, argument, text);
  const named = NAMED_ARGUMENT_PATTERN.exec(argument.text);
  return { typeName: built[1], position: argument.position, name: named ? named[1] : "" };
};

const readNumberedLines = (lines, from, to) => {
  const numbered = [];
  for (let line = from; line <= to; line++) numbered.push({ line, text: String(lines[line - 1] || "") });
  return numbered;
};

const collectCalledIds = methods => {
  const followedIds = new Set(methods.map(method => method.id));
  return [...new Set(methods.flatMap(method => method.calls.flatMap(call => call.targets)))].filter(id => !followedIds.has(id));
};

const recordTheDirectReadsOnTheLine = ({ method, names, line, text }, members, reads, readPlaces) => {
  for (const member of members) {
    const reader = names.find(name => buildParameterMemberReadPattern(name, member).test(text));
    if (!reader) continue;
    reads.add(member);
    readPlaces.push({ member, parameter: reader, path: method.path, methodLine: method.line, line });
  }
};

const findTheFirstBodyLine = (lines, method) => Math.max(method.line + 1, findParameterListAfterTheName(lines.map(String), method.line - 1, method.name).endLine + 2);

export class ParameterReads {
  constructor(repositoryText, testCode, callGraphOf, references, typeAbstractions) {
    this.repositoryText = repositoryText;
    this.testCode = testCode;
    this.findCallGraph = callGraphOf;
    this.references = references;
    this.typeAbstractions = typeAbstractions;
  }

  readFileLines(filePath) {
    return this.repositoryText.readFileLines(filePath) || [];
  }

  findPathsWhereTheTypeIsInScope(type, family) {
    return [...this.references.collectProductionPathsNaming(type.name, family, this.testCode)].filter(filePath => this.typeAbstractions.isTheTypeInScopeAt(type, filePath));
  }

  findOperationsTaking(type) {
    const family = readLanguageFamily(type.path);
    const callGraph = this.findCallGraph(family);
    if (!callGraph) return [];
    const operations = [];
    for (const filePath of this.findPathsWhereTheTypeIsInScope(type, family)) {
      for (const method of callGraph.methodsByPathMap.get(filePath) || []) {
        if (isAConstructor(method)) continue;
        const parameter = findParameterOfType(readParameterText(this.readFileLines(filePath), method), type.name, findDriver(filePath));
        if (parameter) operations.push({ callGraph, method, parameter });
      }
    }
    return operations;
  }

  hasABody(method) {
    return isAFileWithBehavior(method.path);
  }

  collectTheReadsFollowingPassedOnCalls(operation, members, typeName, seen, readPlaces = []) {
    const reads = new Set();
    const passedOn = [];
    const { method, parameter } = operation;
    if (!this.hasABody(method)) return { reads, passedOn, readPlaces };
    const lines = this.readFileLines(method.path);
    const namesInTheBody = new ParameterNamesInTheBody(parameter, typeName, members);
    for (let line = findTheFirstBodyLine(lines, method); line <= method.to; line++) {
      const text = String(lines[line - 1] || "");
      const { introduced, referencedMembers } = namesInTheBody.findTheNamesIntroducedBy(readTheContinuedText(lines, line, method.to));
      namesInTheBody.add(introduced);
      for (const member of referencedMembers) reads.add(member);
      recordTheDirectReadsOnTheLine({ method, names: namesInTheBody.list(), line, text }, members, reads, readPlaces);
      const usesTheWholeValueAlone = usesTheWholeValue(namesInTheBody.list(), text);
      if (usesTheWholeValueAlone || namesInTheBody.isUsedWithoutAMemberRead(removeTheLambdaHeads(text))) {
        passedOn.push(...this.followPassedOn(operation, line, { members, typeName, seen, reads, readPlaces }, usesTheWholeValueAlone && !introduced.length));
      }
    }
    return { reads, passedOn, readPlaces };
  }

  findCalleesTakingTheType({ callGraph, method }, line, typeName) {
    const targets = method.calls.filter(call => call.line === line && call.targets.length === 1).map(call => callGraph.methods[call.targets[0]]);
    return targets.map(target => ({ callGraph, method: target, parameter: findParameterOfType(readParameterText(this.readFileLines(target.path), target), typeName, findDriver(target.path)) }))
      .filter(callee => callee.parameter);
  }

  followIntoCallee(callee, { members, typeName, seen, reads, readPlaces }) {
    const key = `${callee.method.path}:${callee.method.line}`;
    if (seen.has(key) || seen.size >= MAX_FORWARD_STEPS) return [];
    seen.set(key, callee.method);
    const below = this.collectTheReadsFollowingPassedOnCalls(callee, members, typeName, seen, readPlaces);
    for (const member of below.reads) reads.add(member);
    return below.passedOn;
  }

  followPassedOn(operation, line, following, keepsWhatItCannotFollow) {
    const callees = this.findCalleesTakingTheType(operation, line, following.typeName);
    if (!callees.length) return keepsWhatItCannotFollow ? [{ line, to: "" }] : [];
    return callees.map(callee => {
      const passedOnBelow = this.followIntoCallee(callee, following);
      const passedOn = { line, to: formatDisplayNameOfMethod(callee.method) };
      return passedOnBelow.some(passed => !passed.to) ? { ...passedOn, unknownBelow: true } : passedOn;
    });
  }

  findTheConstructionOfTheRead({ member, parameter, path: filePath, methodLine, line }) {
    const lines = this.readFileLines(filePath);
    const head = [];
    for (let headLineNumber = methodLine; headLineNumber < line; headLineNumber++) head.push(String(lines[headLineNumber - 1] || ""));
    const text = String(lines[line - 1] || "");
    const read = buildParameterMemberReadPattern(parameter, member).exec(text);
    if (!read) return null;
    const before = head.length ? `${head.join("\n")}\n` : "";
    return findTheEnclosingConstruction(`${before}${text}`, before.length + read.index);
  }

  findOperation(operation, members, typeName) {
    const { method, parameter } = operation;
    const followedByPlaceMap = new Map([[`${method.path}:${method.line}`, method]]);
    const { reads, passedOn, readPlaces } = this.collectTheReadsFollowingPassedOnCalls(operation, members, typeName, followedByPlaceMap);
    const hasBody = this.hasABody(method);
    return {
      id: method.id,
      displayName: formatDisplayNameOfMethod(method),
      family: readLanguageFamily(method.path),
      path: method.path,
      from: method.line,
      to: method.to,
      parameter,
      hasBody,
      reads: members.filter(member => reads.has(member)),
      readsKnown: hasBody && !passedOn.some(passed => !passed.to || passed.unknownBelow),
      passedOn: passedOn.map(({ line, to }) => ({ line, to })),
      readPlaces,
      called: collectCalledIds([...followedByPlaceMap.values()]),
      lines: readNumberedLines(this.readFileLines(method.path), method.line, hasBody ? method.to : method.line),
    };
  }

  findOperations(type) {
    return this.findOperationsTaking(type).map(operation => this.findOperation(operation, type.members, type.name));
  }
}
