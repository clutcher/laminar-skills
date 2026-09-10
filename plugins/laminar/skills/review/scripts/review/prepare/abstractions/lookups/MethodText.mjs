import { findClosingParenthesisAcrossLines } from "../../../../code/index.mjs";
import { listLinesFromTo } from "./FileLines.mjs";

const MAX_SIGNATURE_LINES = 6;

const listLinesUntilTheParenthesesClose = (lines, method, from) => {
  const last = Math.min(method.to, from + MAX_SIGNATURE_LINES - 1);
  if (last < from) return [];
  const column = String(lines[from - 1] ?? "").indexOf("(");
  if (column < 0) return [from];
  const closing = findClosingParenthesisAcrossLines(lines, { line: from - 1, column }, last - from + 1);
  return listLinesFromTo(from, closing ? closing.line + 1 : last);
};

export class MethodText {
  constructor(fileLines) {
    this.fileLines = fileLines;
  }

  listSignatureLines(method) {
    return listLinesUntilTheParenthesesClose(this.fileLines.readFileLines(method.path), method, method.line);
  }

  listCallLines(method, line) {
    return listLinesUntilTheParenthesesClose(this.fileLines.readFileLines(method.path), method, line);
  }

  readTheHeadOf(method) {
    const lines = this.fileLines.readFileLines(method.path);
    return this.listSignatureLines(method).map(line => String(lines[line - 1] ?? "")).join(" ");
  }
}
