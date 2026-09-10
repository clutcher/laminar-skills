import { IN_OUT_SIDES, changesTheCode, isADecisionLine, ROLE_KINDS, Scale } from "../../../../code/index.mjs";
import { listLinesFromTo } from "../lookups/FileLines.mjs";

export const MAX_IN_OUT_METHOD_LINES = 40;

const CONSTRUCTOR_NAMES = new Set(["constructor", "__init__", "init", "new", "initialize", "__construct"]);

const isAChangedMethod = abstraction => abstraction.scale === Scale.METHOD.name && !abstraction.isTest && Boolean(abstraction.lines)
  && changesTheCode(abstraction.changeKind) && !CONSTRUCTOR_NAMES.has(abstraction.name) && abstraction.name !== abstraction.enclosingTypeName;

const KNOWN_IN_OUT_SIDES = new Set(Object.values(IN_OUT_SIDES));

const findTheInOutRole = roles => roles.find(role => role.kind === ROLE_KINDS.IN_OUT_CODE && KNOWN_IN_OUT_SIDES.has(role.facts.side)) || null;

const holdsTheSpanStart = (fileLines, abstraction) => abstraction.lines.from >= 1 && abstraction.lines.from <= fileLines.length;

const readNumberedMethodLines = (fileLines, abstraction) => {
  const lastShownLine = Math.min(abstraction.lines.to, abstraction.lines.from + MAX_IN_OUT_METHOD_LINES - 1, fileLines.length);
  return listLinesFromTo(abstraction.lines.from, lastShownLine).map(line => ({ line, text: String(fileLines[line - 1] ?? "") }));
};

export class InOutOperationsWalk {
  constructor(codeGraph, linesOf) {
    this.codeGraph = codeGraph;
    this.readFileLines = filePath => linesOf(filePath) || [];
  }

  findRelations(abstractions) {
    return abstractions.filter(isAChangedMethod).map(abstraction => this.findTheDecidingInOutRelation(abstraction)).filter(Boolean);
  }

  findTheDecidingInOutRelation(abstraction) {
    const inOutRole = findTheInOutRole(this.codeGraph.findFolderRoles(abstraction.path));
    if (!inOutRole) return null;
    const fileLines = this.readFileLines(abstraction.path);
    if (!holdsTheSpanStart(fileLines, abstraction)) return null;
    const numberedMethodLines = readNumberedMethodLines(fileLines, abstraction);
    const decisionLineNumbers = numberedMethodLines.slice(1).filter(numberedMethodLine => isADecisionLine(numberedMethodLine.text)).map(numberedMethodLine => numberedMethodLine.line);
    if (!decisionLineNumbers.length) return null;
    return {
      abstractionIds: [abstraction.id],
      displayName: abstraction.displayName,
      name: abstraction.name,
      path: abstraction.path,
      from: abstraction.lines.from,
      to: abstraction.lines.to,
      changeKind: abstraction.changeKind,
      side: inOutRole.facts.side,
      shape: inOutRole.evidence.detail,
      decisionLines: decisionLineNumbers,
      lines: numberedMethodLines,
    };
  }
}
