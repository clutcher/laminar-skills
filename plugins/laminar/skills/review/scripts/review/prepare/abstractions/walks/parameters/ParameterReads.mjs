import { isAConstructor } from "../../lookups/MethodParameters.mjs";
import { findDriver, escapeForAPattern, EVERY_OPENER_AND_ANGLE, isAFileWithBehavior, readLanguageFamily, readParameterNamesOfAList, readParameterTextOfTheHead, splitAtTopLevelCommas, formatDisplayNameOfMethod, findUnmatchedOpenerBefore, buildWholeWordPattern } from "../../../../../code/index.mjs";

export const MAX_FORWARD_STEPS = 3;

const OPENERS = EVERY_OPENER_AND_ANGLE;

const CLOSERS = ")>]}";

const capitalize = word => word.charAt(0).toUpperCase() + word.slice(1);

const readParameterText = (lines, method) => readParameterTextOfTheHead(lines, method, lines.length);

const splitParameterDeclarations = text => {
  const pieces = splitAtTopLevelCommas(text);
  return pieces[pieces.length - 1].trim() ? pieces : pieces.slice(0, -1);
};

const stripTypeArguments = text => {
  let depth = 0;
  let kept = "";
  for (const character of text) {
    if (character === "<" || character === "[") depth++;
    else if (character === ">" || character === "]") depth = Math.max(0, depth - 1);
    else if (depth === 0) kept += character;
  }
  return kept;
};

export const findParameterOfType = (parameterText, typeName, driver) => {
  const naming = buildWholeWordPattern(typeName);
  const matchingDeclaration = splitParameterDeclarations(parameterText).find(parameterDeclaration => naming.test(stripTypeArguments(parameterDeclaration)));
  return matchingDeclaration && driver ? readParameterNamesOfAList(`(${matchingDeclaration})`, driver)[0] || "" : "";
};

const buildParameterMemberReadPattern = (parameter, member) => new RegExp(
  `(?<![\\w$])${escapeForAPattern(parameter)}\\s*[?!]?\\.\\s*(?:${escapeForAPattern(member)}|get${escapeForAPattern(capitalize(member))}|is${escapeForAPattern(capitalize(member))})(?![\\w$])`);

const buildWholeUsePattern = parameter => new RegExp(`(?<![\\w$.])${escapeForAPattern(parameter)}(?![\\w$])(?!\\s*[?!]?\\.)`);

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

export const findTheEnclosingConstruction = (text, offset) => {
  const opening = findUnmatchedOpenerBefore(text, offset, EVERY_OPENER_AND_ANGLE);
  if (opening < 0 || text[opening] !== "(") return null;
  const built = CONSTRUCTION_BEFORE_PATTERN.exec(text.slice(0, opening));
  if (!built) return null;
  const argument = readLastArgument(text.slice(opening + 1, offset));
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

const recordTheDirectReadsOnTheLine = ({ method, parameter, line, text }, members, reads, readPlaces) => {
  for (const member of members) {
    if (!buildParameterMemberReadPattern(parameter, member).test(text)) continue;
    reads.add(member);
    readPlaces.push({ member, parameter, path: method.path, methodLine: method.line, line });
  }
};

export class ParameterReads {
  constructor(repositoryText, testCode, callGraphOf, references) {
    this.repositoryText = repositoryText;
    this.testCode = testCode;
    this.findCallGraph = callGraphOf;
    this.references = references;
  }

  readFileLines(filePath) {
    return this.repositoryText.readFileLines(filePath) || [];
  }

  findOperationsTaking(typeName) {
    const operations = [];
    for (const family of this.repositoryText.listFamilies()) {
      const paths = this.references.collectProductionPathsNaming(typeName, family, this.testCode);
      if (!paths.size) continue;
      const callGraph = this.findCallGraph(family);
      if (!callGraph) continue;
      for (const filePath of paths) {
        for (const method of callGraph.methodsByPathMap.get(filePath) || []) {
          if (isAConstructor(method)) continue;
          const parameter = findParameterOfType(readParameterText(this.readFileLines(filePath), method), typeName, findDriver(filePath));
          if (parameter) operations.push({ callGraph, method, parameter });
        }
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
    const whole = buildWholeUsePattern(parameter);
    for (let line = method.line + 1; line <= method.to; line++) {
      const text = String(lines[line - 1] || "");
      recordTheDirectReadsOnTheLine({ method, parameter, line, text }, members, reads, readPlaces);
      if (whole.test(text)) passedOn.push(...this.followPassedOn(operation, line, members, typeName, seen, reads, readPlaces));
    }
    return { reads, passedOn, readPlaces };
  }

  findCalleesTakingTheType({ callGraph, method }, line, typeName) {
    const targets = method.calls.filter(call => call.line === line && call.targets.length === 1).map(call => callGraph.methods[call.targets[0]]);
    return targets.map(target => ({ callGraph, method: target, parameter: findParameterOfType(readParameterText(this.readFileLines(target.path), target), typeName, findDriver(target.path)) }))
      .filter(callee => callee.parameter);
  }

  followIntoCallee(callee, members, typeName, seen, reads, readPlaces) {
    const key = `${callee.method.path}:${callee.method.line}`;
    if (seen.has(key) || seen.size >= MAX_FORWARD_STEPS) return [];
    seen.set(key, callee.method);
    const below = this.collectTheReadsFollowingPassedOnCalls(callee, members, typeName, seen, readPlaces);
    for (const member of below.reads) reads.add(member);
    return below.passedOn;
  }

  followPassedOn(operation, line, members, typeName, seen, reads, readPlaces) {
    const callees = this.findCalleesTakingTheType(operation, line, typeName);
    if (!callees.length) return [{ line, to: "" }];
    return callees.map(callee => {
      const passedOnBelow = this.followIntoCallee(callee, members, typeName, seen, reads, readPlaces);
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

  findOperations(typeName, members) {
    return this.findOperationsTaking(typeName).map(operation => this.findOperation(operation, members, typeName));
  }
}
